import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation function
function validateSessionFinishInput(input: any) {
  if (!input.sessionId || typeof input.sessionId !== 'string') {
    throw new Error('Invalid sessionId');
  }
  return { sessionId: input.sessionId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract and verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    // Create client with user's JWT for RLS
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    const rawInput = await req.json();
    const { sessionId } = validateSessionFinishInput(rawInput);

    // Verify user owns the session
    const { data: session, error: sessionError } = await supabaseUser
      .from("sessions")
      .select(`
        *,
        engagement:engagements (
          id,
          provider_id,
          seeker_id,
          seeker:seekers (
            owner_id
          )
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session || !session.engagement) {
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check ownership
    const isProvider = session.engagement.provider_id === user.id;
    const isSeeker = session.engagement.seeker?.owner_id === user.id;

    if (!isProvider && !isSeeker) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - You do not have access to this session' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load provider config
    const { data: config, error: configError } = await supabase
      .from("provider_configs")
      .select("*")
      .eq("provider_id", session.engagement.provider_id)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) throw new Error("Provider config not found");

    // Load full transcript
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    // Build transcript for Gemini
    const transcriptForAI = messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.created_at
    }));

    const providerConfigForAI = {
      stages: config.stages || [],
      labels: config.labels || [],
      summary_template: config.summary_template || [],
      tagging_rules: config.tagging_rules || [],
      trajectory_rules: config.trajectory_rules || []
    };

    const stagesList = (config.stages as any[])
      .map(s => s.name)
      .join(", ");

    const prompt = `Summarize this session for durable storage.

Output STRICT JSON ONLY:
{
  "session_summary": string,                       // <= 180 words, behavior-focused
  "assigned_stage": string,                        // must be one of provider_config.stages
  "key_insights": [ { "label": string, "insight": string, "score": number (optional -1..+1) } ],
  "next_action": string,                           // one concrete next step
  "trajectory_status": "steady"|"drifting"|"stalling"|"accelerating"
}

Inputs:
- transcript: ${JSON.stringify(transcriptForAI)}
- provider_config: ${JSON.stringify(providerConfigForAI)}

Available stages: ${stagesList}

Guidance:
- Prefer earlier stages when ambiguous.
- Reference specific phrases or patterns from the transcript in key_insights.
- If you infer sentiment, include a single insight { "label":"sentiment", "score": -1..+1 }.
- Only return JSON. No extra text.`;

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

    let summary;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      summary = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error("Invalid JSON response from AI");
    }

    if (!summary.assigned_stage || !summary.session_summary || !summary.next_action || !summary.trajectory_status) {
      throw new Error("AI summary missing required fields");
    }

    // Insert summary into database
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

    // Update session status
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

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
