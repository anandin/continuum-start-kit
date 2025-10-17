import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: string;
  content: string;
  created_at: string;
}

interface TrajectoryRule {
  stage: string;
  indicator_type: 'drift' | 'leap' | 'stall' | 'steady';
  pattern: string;
  message: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, recentMessages, trajectoryRules } = await req.json();

    if (!sessionId || !recentMessages || !trajectoryRules) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Trajectory check for session:", sessionId);
    console.log("Recent messages count:", recentMessages.length);
    console.log("Trajectory rules count:", trajectoryRules.length);

    // Tier 1: Heuristic checks
    const tier1Result = runTier1Heuristics(recentMessages);
    
    if (tier1Result) {
      console.log("Tier 1 match:", tier1Result);
      
      // Insert progress indicator
      const { data: indicator, error: insertError } = await supabase
        .from("progress_indicators")
        .insert({
          session_id: sessionId,
          type: tier1Result.type,
          detail: tier1Result.detail,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting indicator:", insertError);
      } else {
        console.log("Created indicator:", indicator);
      }

      return new Response(
        JSON.stringify({ 
          indicator: indicator || tier1Result,
          matched: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tier 2: Optional Gemini analysis (if API key available and rules defined)
    if (LOVABLE_API_KEY && trajectoryRules.length > 0) {
      console.log("Running Tier 2 Gemini analysis");
      
      const tier2Result = await runTier2GeminiAnalysis(
        recentMessages,
        trajectoryRules,
        LOVABLE_API_KEY
      );

      if (tier2Result) {
        console.log("Tier 2 match:", tier2Result);
        
        // Insert progress indicator
        const { data: indicator, error: insertError } = await supabase
          .from("progress_indicators")
          .insert({
            session_id: sessionId,
            type: tier2Result.type,
            detail: tier2Result.detail,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error inserting indicator:", insertError);
        } else {
          console.log("Created indicator:", indicator);
        }

        return new Response(
          JSON.stringify({ 
            indicator: indicator || tier2Result,
            matched: true 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // No trajectory issues detected
    console.log("No trajectory issues detected");
    return new Response(
      JSON.stringify({ indicator: null, matched: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in trajectory-check:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function runTier1Heuristics(messages: Message[]) {
  // Only check seeker messages
  const seekerMessages = messages.filter(m => m.role === 'seeker');
  
  if (seekerMessages.length < 3) {
    return null; // Not enough messages to detect patterns
  }

  const recentSeeker = seekerMessages.slice(-5); // Last 5 seeker messages
  
  // Check 1: Keyword repetition (same topic/words repeated 3+ times)
  const repetitionResult = checkKeywordRepetition(recentSeeker);
  if (repetitionResult) {
    return {
      type: 'drift',
      detail: {
        rule_index: -1,
        message: "I notice you've been circling back to the same topic. Let's explore what might be keeping you there.",
        reason: repetitionResult.reason,
        keywords: repetitionResult.keywords
      }
    };
  }

  // Check 2: No new action/progress for N turns (5+ turns)
  if (recentSeeker.length >= 5) {
    const noProgressResult = checkNoProgress(recentSeeker);
    if (noProgressResult) {
      return {
        type: 'stall',
        detail: {
          rule_index: -1,
          message: "It seems like we're at a standstill. What's one small step you could take to move forward?",
          reason: noProgressResult.reason,
          turns: recentSeeker.length
        }
      };
    }
  }

  // Check 3: Short responses / disengagement
  const disengagementResult = checkDisengagement(recentSeeker);
  if (disengagementResult) {
    return {
      type: 'drift',
      detail: {
        rule_index: -1,
        message: "I'm sensing some distance. What's on your mind right now?",
        reason: disengagementResult.reason,
        avgLength: disengagementResult.avgLength
      }
    };
  }

  return null;
}

function checkKeywordRepetition(messages: Message[]) {
  // Extract meaningful words (3+ chars, not common words)
  const commonWords = new Set(['the', 'and', 'but', 'for', 'with', 'this', 'that', 'have', 'from', 'they', 'what', 'when', 'been', 'have', 'their', 'said', 'each', 'which', 'about', 'would', 'there', 'could', 'other', 'into', 'than', 'then', 'them', 'these', 'some', 'just', 'like', 'also', 'can', 'not', 'are', 'was', 'were', 'will', 'been', 'more']);
  
  const wordCounts = new Map<string, number>();
  
  messages.forEach(msg => {
    const words = msg.content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !commonWords.has(w));
    
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });

  // Find words repeated 3+ times
  const repeatedWords = Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word, _]) => word);

  if (repeatedWords.length >= 2) {
    return {
      reason: `Keywords repeated across messages: ${repeatedWords.join(', ')}`,
      keywords: repeatedWords
    };
  }

  return null;
}

function checkNoProgress(messages: Message[]) {
  // Look for action words in messages
  const actionWords = ['will', 'going', 'plan', 'start', 'begin', 'try', 'attempt', 'commit', 'decide', 'choose', 'change', 'do', 'make', 'create', 'build'];
  
  let actionCount = 0;
  messages.forEach(msg => {
    const lower = msg.content.toLowerCase();
    if (actionWords.some(word => lower.includes(word))) {
      actionCount++;
    }
  });

  // If less than 40% of messages contain action words
  if (actionCount < messages.length * 0.4) {
    return {
      reason: `Only ${actionCount} out of ${messages.length} recent messages mentioned actions or plans`
    };
  }

  return null;
}

function checkDisengagement(messages: Message[]) {
  const avgLength = messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;
  
  // If average message length is very short (< 50 chars) for 3+ messages
  if (avgLength < 50 && messages.length >= 3) {
    return {
      reason: `Average message length is ${avgLength.toFixed(0)} characters, indicating possible disengagement`,
      avgLength: Math.round(avgLength)
    };
  }

  return null;
}

async function runTier2GeminiAnalysis(
  messages: Message[],
  trajectoryRules: TrajectoryRule[],
  apiKey: string
) {
  const recentMessagesForAI = messages.map(m => ({
    role: m.role,
    content: m.content
  }));

  const trajectoryRulesForAI = trajectoryRules.map((rule, idx) => ({
    index: idx,
    stage: rule.stage,
    indicator_type: rule.indicator_type,
    pattern: rule.pattern,
    message: rule.message
  }));

  const prompt = `Classify the seeker's recent direction vs the provider's trajectory_rules.

Output STRICT JSON ONLY:
{
  "indicator_type": "drift"|"leap"|"stall"|"steady",
  "matched_rule_index": number|null,
  "reason": string
}

Inputs:
- recent_messages: ${JSON.stringify(recentMessagesForAI)}
- provider_config.trajectory_rules: ${JSON.stringify(trajectoryRulesForAI)}

Rules:
- drift: repetition/rumination in same stage without new behavior
- leap: jumping to advanced outcomes before foundations
- stall: active talk without cognitive/behavioral shift across several turns
- steady: normal incremental movement

If none match: {"indicator_type":"steady","matched_rule_index":null,"reason":"no rule matched"}.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a trajectory analysis expert. Respond only with valid JSON."
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
      console.error("Gemini API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return null;

    // Parse JSON response
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanContent);

    console.log("Tier 2 analysis result:", result);

    // Check if we got a meaningful indicator (not just "steady" with no match)
    if (result.indicator_type && result.indicator_type !== 'steady') {
      const matchedRule = result.matched_rule_index !== null && result.matched_rule_index >= 0 
        ? trajectoryRules[result.matched_rule_index] 
        : null;
      
      return {
        type: result.indicator_type,
        detail: {
          rule_index: result.matched_rule_index,
          message: matchedRule?.message || "Let's explore what's happening in your journey right now.",
          reason: result.reason,
          pattern: matchedRule?.pattern || "Detected by AI analysis"
        }
      };
    }

    return null;
  } catch (error) {
    console.error("Error in Tier 2 analysis:", error);
    return null;
  }
}
