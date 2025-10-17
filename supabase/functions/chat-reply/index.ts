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

    // 2. Load session and engagement details
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        *,
        engagement:engagements (
          id,
          provider_id,
          provider:profiles!engagements_provider_id_fkey (
            id,
            email
          )
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) throw new Error("Session not found");

    // 3. Load provider config
    const { data: config, error: configError } = await supabase
      .from("provider_configs")
      .select("*")
      .eq("provider_id", session.engagement.provider_id)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) throw new Error("Provider config not found");

    // 4. Load last 20 messages
    const { data: recentMessages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (messagesError) throw messagesError;

    // Reverse to get chronological order
    const messagesInOrder = (recentMessages || []).reverse();

    // 5. Check trajectory (optional - detect patterns and nudges)
    let trajectoryIndicator = null;
    if (config.trajectory_rules && (config.trajectory_rules as any[]).length > 0) {
      console.log("Checking trajectory patterns...");
      
      try {
        const { data: trajectoryResult, error: trajectoryError } = await supabase.functions.invoke(
          'trajectory-check',
          {
            body: {
              sessionId,
              recentMessages: messagesInOrder.slice(-10), // Last 10 for analysis
              trajectoryRules: config.trajectory_rules
            }
          }
        );

        if (trajectoryError) {
          console.error("Trajectory check error:", trajectoryError);
        } else if (trajectoryResult?.matched && trajectoryResult?.indicator) {
          trajectoryIndicator = trajectoryResult.indicator;
          console.log("Trajectory indicator detected:", trajectoryIndicator);
        }
      } catch (err) {
        console.error("Error calling trajectory-check:", err);
      }
    }

    // 6. Load recent progress indicators
    const { data: indicators, error: indicatorsError } = await supabase
      .from("progress_indicators")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (indicatorsError) console.error("Error loading indicators:", indicatorsError);

    // 7. Build system prompt
    const stagesList = (config.stages as any[]).map(s => `- ${s.name}: ${s.description}`).join("\n");
    
    let indicatorsContext = "";
    if (indicators && indicators.length > 0) {
      indicatorsContext = "\n\n**Recent Progress Indicators:**\n" + 
        indicators.map(ind => `- ${ind.type}: ${JSON.stringify(ind.detail)}`).join("\n");
    }

    // Add trajectory nudge if detected
    let trajectoryNudge = "";
    if (trajectoryIndicator) {
      trajectoryNudge = `\n\n**IMPORTANT - Trajectory Alert:**
The seeker is showing signs of ${trajectoryIndicator.type}. 
Context: ${JSON.stringify(trajectoryIndicator.detail)}
Suggested approach: ${trajectoryIndicator.detail?.message || 'Address this pattern naturally in your response'}

Weave this insight naturally into your response (1-2 sentences). Don't be robotic or explicitly reference "trajectory" - just gently guide them based on this pattern.`;
    }

    const systemPrompt = `You are an AI coaching agent supporting a seeker in their growth journey. Your role is to:
1. Listen actively and ask thoughtful questions
2. Provide insights and guidance based on the seeker's responses
3. Help them progress through the coaching stages
4. Recognize and celebrate wins
5. Support them through challenges

**Current Session Context:**
- Initial Stage: ${session.initial_stage || "Not set"}
- Methodology: ${config.methodology || "Standard coaching"}

**Available Stages:**
${stagesList}
${indicatorsContext}
${trajectoryNudge}

**Guidelines:**
- Be empathetic, supportive, and professional
- Ask open-ended questions to deepen understanding
- Provide actionable insights when appropriate
- Keep responses concise but meaningful (2-4 sentences typically)
- Reference the seeker's previous messages to show continuity
- Help identify patterns and progress

Engage naturally as a supportive coach having a conversation with the seeker.`;

    // 8. Build conversation history for Gemini
    const conversationMessages = messagesInOrder.map((msg: any) => ({
      role: msg.role === "seeker" ? "user" : "assistant",
      content: msg.content
    }));

    console.log("Calling Gemini with system prompt and", conversationMessages.length, "messages");

    // 9. Call Gemini with streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages
        ],
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    // 10. Stream response back to client and collect for DB
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
