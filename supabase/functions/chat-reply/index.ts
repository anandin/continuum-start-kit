import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Insert the user's message
    const { error: insertError } = await supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        role: "seeker",
        content: message,
      });

    if (insertError) throw insertError;

    // 2. Load session and engagement details with null-safe guards
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        *,
        engagement:engagements (
          id,
          provider_id,
          seeker_id,
          status
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session || !session.engagement) {
      throw new Error("Session or engagement not found");
    }

    // 3. Load provider config and agent config
    const { data: providerConfig } = await supabase
      .from("provider_configs")
      .select("*")
      .eq("provider_id", session.engagement.provider_id)
      .maybeSingle();

    const { data: agentConfig } = await supabase
      .from("provider_agent_configs")
      .select("*")
      .eq("provider_id", session.engagement.provider_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Build system prompt from agent config
    let systemPrompt = 'You are a helpful AI coaching assistant.';
    
    if (agentConfig) {
      systemPrompt = '';
      if (agentConfig.core_identity) systemPrompt += `## Core Identity\n${agentConfig.core_identity}\n\n`;
      if (agentConfig.guiding_principles) systemPrompt += `## Guiding Principles\n${agentConfig.guiding_principles}\n\n`;
      if (agentConfig.tone || agentConfig.voice) {
        systemPrompt += `## Communication Style\n`;
        if (agentConfig.tone) systemPrompt += `Tone: ${agentConfig.tone}\n`;
        if (agentConfig.voice) systemPrompt += `Voice: ${agentConfig.voice}\n`;
        systemPrompt += '\n';
      }
      if (agentConfig.rules) systemPrompt += `## Rules\n${agentConfig.rules}\n\n`;
      if (agentConfig.boundaries) systemPrompt += `## Boundaries\n${agentConfig.boundaries}\n\n`;
    }
    
    if (providerConfig) {
      systemPrompt += `## Program Context\n`;
      if (providerConfig.title) systemPrompt += `Program: ${providerConfig.title}\n`;
      if (providerConfig.methodology) systemPrompt += `Methodology: ${providerConfig.methodology}\n`;
      if (session.initial_stage) systemPrompt += `Current Stage: ${session.initial_stage}\n`;
    }

    // 5. Load conversation history
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(20);

    const messagesInOrder = (recentMessages || []).reverse();

    // 6. Call Lovable AI with selected model
    const selectedModel = agentConfig?.selected_model || 'google/gemini-2.5-flash';
    console.log('Using model:', selectedModel);

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messagesInOrder.map((m: any) => ({
        role: m.role === "seeker" ? "user" : "assistant",
        content: m.content
      }))
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    // 7. Stream response back to client
    let fullResponse = "";
    
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  
                  if (content) {
                    fullResponse += content;
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }

          // Save complete response to database
          if (fullResponse) {
            await supabase.from("messages").insert({
              session_id: sessionId,
              role: "agent",
              content: fullResponse,
            });
          }

          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("Error in chat-reply:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
