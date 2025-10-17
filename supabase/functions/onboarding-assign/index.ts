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
    const { answers, stages } = await req.json();
    
    if (!answers || !stages) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: answers and stages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt for Gemini
    const stageNames = stages.map((s: any) => s.name);
    
    const answersForAI = {
      current_pain: answers.current_pain,
      desired_outcome: answers.desired_outcome,
      present_challenge: answers.present_challenge,
      recent_win: answers.recent_win
    };

    const prompt = `Assign an initial stage for a new seeker.

Output STRICT JSON ONLY:
{
  "initial_stage": string,   // must be an element of provider_config.stages
  "rationale": string        // one sentence explanation
}

Inputs:
- answers: ${JSON.stringify(answersForAI)}
- provider_config.stages: ${JSON.stringify(stageNames)}

If ambiguous, choose the earliest relevant stage.`;

    console.log("Calling Gemini API with prompt:", prompt);

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
    console.log("Gemini response:", data);

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in Gemini response");
    }

    // Parse the JSON response from Gemini
    let result;
    try {
      // Remove markdown code blocks if present
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
