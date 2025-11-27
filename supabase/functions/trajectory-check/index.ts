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

// Validation function
function validateTrajectoryInput(input: any) {
  if (!input.sessionId || typeof input.sessionId !== 'string') {
    throw new Error('Invalid sessionId');
  }
  if (!Array.isArray(input.recentMessages)) {
    throw new Error('recentMessages must be an array');
  }
  if (!Array.isArray(input.trajectoryRules)) {
    throw new Error('trajectoryRules must be an array');
  }
  return {
    sessionId: input.sessionId,
    recentMessages: input.recentMessages,
    trajectoryRules: input.trajectoryRules
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
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
    const { sessionId, recentMessages, trajectoryRules } = validateTrajectoryInput(rawInput);

    // Verify user owns the session
    const { data: session, error: sessionError } = await supabaseUser
      .from("sessions")
      .select(`
        engagement_id,
        engagement:engagements!inner (
          provider_id,
          seeker:seekers!inner (
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

    // Check ownership - with type assertion for nested objects
    const engagement = session.engagement as any;
    const isProvider = engagement.provider_id === user.id;
    const isSeeker = engagement.seeker?.owner_id === user.id;

    if (!isProvider && !isSeeker) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - You do not have access to this session' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Tier 1: Heuristic checks
    const tier1Result = runTier1Heuristics(recentMessages);
    
    if (tier1Result) {
      const { data: indicator, error: insertError } = await supabase
        .from("progress_indicators")
        .insert({
          session_id: sessionId,
          engagement_id: session.engagement_id || null,
          type: tier1Result.type,
          detail: tier1Result.detail,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting indicator:", insertError);
      }

      return new Response(
        JSON.stringify({ 
          indicator: indicator || tier1Result,
          matched: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tier 2: Optional Gemini analysis
    if (LOVABLE_API_KEY && trajectoryRules.length > 0) {
      const tier2Result = await runTier2GeminiAnalysis(
        recentMessages,
        trajectoryRules,
        LOVABLE_API_KEY
      );

      if (tier2Result) {
        const { data: indicator, error: insertError } = await supabase
          .from("progress_indicators")
          .insert({
            session_id: sessionId,
            engagement_id: session.engagement_id || null,
            type: tier2Result.type,
            detail: tier2Result.detail,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error inserting indicator:", insertError);
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
  const seekerMessages = messages.filter(m => m.role === 'seeker');
  
  if (seekerMessages.length < 3) {
    return null;
  }

  const recentSeeker = seekerMessages.slice(-5);
  
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
  const actionWords = ['will', 'going', 'plan', 'start', 'begin', 'try', 'attempt', 'commit', 'decide', 'choose', 'change', 'do', 'make', 'create', 'build'];
  
  let actionCount = 0;
  messages.forEach(msg => {
    const lower = msg.content.toLowerCase();
    if (actionWords.some(word => lower.includes(word))) {
      actionCount++;
    }
  });

  if (actionCount < messages.length * 0.4) {
    return {
      reason: `Only ${actionCount} out of ${messages.length} recent messages mentioned actions or plans`
    };
  }

  return null;
}

function checkDisengagement(messages: Message[]) {
  const avgLength = messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;
  
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

    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanContent);

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
