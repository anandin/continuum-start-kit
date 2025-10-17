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
    // Verify Authorization header
    const authHeader = req.headers.get("Authorization");
    const CRON_SECRET = Deno.env.get("CRON_SECRET");

    if (!CRON_SECRET) {
      console.error("CRON_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error("Unauthorized cron attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Starting backfill job...");

    // Find all sessions with status='ended' but no summaries
    const { data: sessionsToBackfill, error: sessionsError } = await supabase
      .from("sessions")
      .select(`
        id,
        initial_stage,
        engagement_id,
        engagements!inner (
          id,
          provider_id,
          profiles!engagements_provider_id_fkey (
            id,
            email
          )
        )
      `)
      .eq("status", "ended");

    if (sessionsError) {
      console.error("Error fetching sessions:", sessionsError);
      throw sessionsError;
    }

    if (!sessionsToBackfill || sessionsToBackfill.length === 0) {
      console.log("No sessions found");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No sessions found",
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out sessions that already have summaries
    const sessionIdsToCheck = sessionsToBackfill.map(s => s.id);
    const { data: existingSummaries } = await supabase
      .from("summaries")
      .select("session_id")
      .in("session_id", sessionIdsToCheck);

    const existingSummaryIds = new Set(existingSummaries?.map(s => s.session_id) || []);
    const sessionsNeedingBackfill = sessionsToBackfill.filter(s => !existingSummaryIds.has(s.id));

    if (sessionsNeedingBackfill.length === 0) {
      console.log("No sessions to backfill");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No sessions to backfill",
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${sessionsNeedingBackfill.length} sessions to backfill`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each session
    for (const session of sessionsNeedingBackfill) {
      try {
        results.processed++;
        console.log(`Processing session ${session.id}...`);

        const engagement = (session as any).engagements;
        const providerId = engagement?.provider_id;

        if (!providerId) {
          console.error(`No provider ID found for session ${session.id}`);
          results.failed++;
          results.errors.push(`Session ${session.id}: No provider ID found`);
          continue;
        }

        // Load provider config
        const { data: config, error: configError } = await supabase
          .from("provider_configs")
          .select("*")
          .eq("provider_id", providerId)
          .maybeSingle();

        if (configError) throw configError;
        if (!config) {
          console.error(`No config found for session ${session.id}`);
          results.failed++;
          results.errors.push(`Session ${session.id}: No provider config found`);
          continue;
        }

        // Load messages
        const { data: messages, error: messagesError } = await supabase
          .from("messages")
          .select("*")
          .eq("session_id", session.id)
          .order("created_at", { ascending: true });

        if (messagesError) throw messagesError;

        // Load progress indicators
        const { data: indicators, error: indicatorsError } = await supabase
          .from("progress_indicators")
          .select("*")
          .eq("session_id", session.id)
          .order("created_at", { ascending: true });

        if (indicatorsError) console.error("Error loading indicators:", indicatorsError);

        // Build transcript
        const transcriptForAI = messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at
        }));

        // Build provider config structure for prompt
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

        console.log(`Calling Gemini for session ${session.id}...`);

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
          console.error(`Gemini API error for session ${session.id}:`, response.status, errorText);
          results.failed++;
          results.errors.push(`Session ${session.id}: Gemini API error ${response.status}`);
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          console.error(`No content in Gemini response for session ${session.id}`);
          results.failed++;
          results.errors.push(`Session ${session.id}: No content in AI response`);
          continue;
        }

        // Parse JSON response
        let summary;
        try {
          const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          summary = JSON.parse(cleanContent);
        } catch (parseError) {
          console.error(`Failed to parse Gemini response for session ${session.id}:`, content);
          results.failed++;
          results.errors.push(`Session ${session.id}: Invalid JSON from AI`);
          continue;
        }

        // Validate required fields
        if (!summary.assigned_stage || !summary.session_summary || !summary.next_action || !summary.trajectory_status) {
          console.error(`Missing required fields for session ${session.id}`);
          results.failed++;
          results.errors.push(`Session ${session.id}: Missing required summary fields`);
          continue;
        }

        // Insert summary
        const { error: summaryError } = await supabase
          .from("summaries")
          .insert({
            session_id: session.id,
            assigned_stage: summary.assigned_stage,
            session_summary: summary.session_summary,
            key_insights: summary.key_insights || [],
            next_action: summary.next_action,
            trajectory_status: summary.trajectory_status,
          });

        if (summaryError) {
          console.error(`Error inserting summary for session ${session.id}:`, summaryError);
          results.failed++;
          results.errors.push(`Session ${session.id}: Database error`);
          continue;
        }

        console.log(`Successfully backfilled session ${session.id}`);
        results.succeeded++;

      } catch (error: any) {
        console.error(`Error processing session ${session.id}:`, error);
        results.failed++;
        results.errors.push(`Session ${session.id}: ${error.message}`);
      }
    }

    console.log("Backfill job completed:", results);

    return new Response(
      JSON.stringify({ 
        success: true,
        ...results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in cron-backfill:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
