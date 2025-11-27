import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation function
function validateOnboardingInput(input: any) {
  if (!input.answers || typeof input.answers !== 'object') {
    throw new Error('Invalid answers object');
  }
  if (!Array.isArray(input.stages) || input.stages.length === 0) {
    throw new Error('stages must be a non-empty array');
  }
  
  // Validate answer fields
  const { current_pain, desired_outcome, present_challenge, recent_win } = input.answers;
  
  if (!current_pain || typeof current_pain !== 'string' || current_pain.trim().length === 0) {
    throw new Error('current_pain is required');
  }
  if (current_pain.length > 1000) {
    throw new Error('current_pain exceeds maximum length of 1000 characters');
  }
  
  if (!desired_outcome || typeof desired_outcome !== 'string' || desired_outcome.trim().length === 0) {
    throw new Error('desired_outcome is required');
  }
  if (desired_outcome.length > 1000) {
    throw new Error('desired_outcome exceeds maximum length of 1000 characters');
  }
  
  if (!present_challenge || typeof present_challenge !== 'string' || present_challenge.trim().length === 0) {
    throw new Error('present_challenge is required');
  }
  if (present_challenge.length > 1000) {
    throw new Error('present_challenge exceeds maximum length of 1000 characters');
  }
  
  if (!recent_win || typeof recent_win !== 'string' || recent_win.trim().length === 0) {
    throw new Error('recent_win is required');
  }
  if (recent_win.length > 1000) {
    throw new Error('recent_win exceeds maximum length of 1000 characters');
  }
  
  return {
    answers: {
      current_pain: current_pain.trim(),
      desired_outcome: desired_outcome.trim(),
      present_challenge: present_challenge.trim(),
      recent_win: recent_win.trim()
    },
    stages: input.stages
  };
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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    // Create client with user's JWT
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    const rawInput = await req.json();
    const { answers, stages } = validateOnboardingInput(rawInput);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt for Gemini
    const stageNames = stages.map((s: any) => s.name);

    const prompt = `Assign an initial stage for a new seeker.

Output STRICT JSON ONLY:
{
  "initial_stage": string,   // must be an element of provider_config.stages
  "rationale": string        // one sentence explanation
}

Inputs:
- answers: ${JSON.stringify(answers)}
- provider_config.stages: ${JSON.stringify(stageNames)}

If ambiguous, choose the earliest relevant stage.`;

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
            content: "You are a stage assignment expert. Always respond with valid JSON only, no additional text."
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in Gemini response");
    }

    // Parse the JSON response from Gemini
    let result;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error("Invalid JSON response from AI");
    }

    // Validate the response
    if (!result.initial_stage || !result.rationale) {
      throw new Error("AI response missing required fields");
    }

    // Verify the stage exists in the provided stages
    const stageExists = stages.some((s: any) => s.name === result.initial_stage);
    if (!stageExists) {
      console.warn(`AI suggested stage "${result.initial_stage}" not in available stages. Using first stage.`);
      result.initial_stage = stages[0].name;
      result.rationale = `Assigned to ${stages[0].name} as a starting point.`;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in onboarding-assign:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
