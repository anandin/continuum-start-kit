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
    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId" }),
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

    console.log("Finishing session:", sessionId);

    // 1. Load session and engagement details
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

    // 2. Load provider config
    const { data: config, error: configError } = await supabase
      .from("provider_configs")
      .select("*")
      .eq("provider_id", session.engagement.provider_id)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) throw new Error("Provider config not found");

    // 3. Load full transcript
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    // 4. Load progress indicators
    const { data: indicators, error: indicatorsError } = await supabase
      .from("progress_indicators")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (indicatorsError) console.error("Error loading indicators:", indicatorsError);

    // 5. Build transcript for Gemini
    const transcript = messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join("\n\n");

    const indicatorsSummary = indicators && indicators.length > 0
      ? "\n\n**Progress Indicators Detected:**\n" + 
        indicators.map(ind => `- ${ind.type}: ${JSON.stringify(ind.detail)}`).join("\n")
      : "";

    const stagesList = (config.stages as any[])
      .map((s, idx) => `${idx + 1}. ${s.name} - ${s.description}`)
      .join("\n");

    const prompt = `You are analyzing a completed coaching session to create a comprehensive summary.

**Session Context:**
- Initial Stage: ${session.initial_stage || "Not set"}
- Methodology: ${config.methodology || "Standard coaching"}

**Available Stages:**
${stagesList}

**Full Transcript:**
${transcript}
${indicatorsSummary}

**Your Task:**
Analyze this session and provide a structured summary. Consider:
1. What stage is the seeker currently at based on the conversation?
2. What are the key insights and patterns from this session?
3. What should be the next action for the seeker?
4. What is their trajectory status (steady, drifting, stalling, accelerating)?
5. Calculate a sentiment score from -1 (very negative/resistant) to +1 (very positive/engaged) based on the seeker's overall tone and engagement.

Respond with JSON only in this exact format:
{
  "assigned_stage": "exact stage name from the list",
  "session_summary": "2-3 paragraph summary of the session covering main topics, breakthroughs, and challenges",
  "key_insights": [
    "First key insight or pattern observed",
    "Second key insight or pattern observed",
    "Third key insight or pattern observed",
    {"label": "sentiment", "score": 0.7}
  ],
  "next_action": "Clear, actionable next step for the seeker (1-2 sentences)",
  "trajectory_status": "steady" | "drifting" | "stalling" | "accelerating"
}

IMPORTANT: The last item in key_insights MUST be the sentiment object with label and score.`;

    console.log("Calling Gemini for session summary...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert coaching session analyst. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error("No content in Gemini response");

    // Parse JSON response
    let summary;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      summary = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error("Invalid JSON response from AI");
    }

    console.log("Generated summary:", summary);

    // Validate required fields
    if (!summary.assigned_stage || !summary.session_summary || !summary.next_action || !summary.trajectory_status) {
      throw new Error("AI summary missing required fields");
    }

    // 6. Insert summary into database
    const { data: summaryRecord, error: summaryError } = await supabase
      .from("summaries")
      .insert({
        session_id: sessionId,
        assigned_stage: summary.assigned_stage,
        session_summary: summary.session_summary,
        key_insights: summary.key_insights || [],
        next_action: summary.next_action,
        trajectory_status: summary.trajectory_status,
      })
      .select()
      .single();

    if (summaryError) throw summaryError;

    // 7. Update session status
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    console.log("Session finished successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        summary: summaryRecord
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in session-finish:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
