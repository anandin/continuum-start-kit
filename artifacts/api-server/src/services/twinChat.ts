/**
 * Therapist Twin orchestration.
 *
 * Flow for every seeker turn:
 *   1. L1.checkInput  →  may short-circuit with a templated response
 *   2. L2.compilePersona  +  L3.buildMemoryContext  →  composed system prompt
 *   3. L1.withConstitution  wraps the prompt (non-overridable identity)
 *   4. LLM call
 *   5. L1.checkOutput  →  may replace the model output with a template
 *   6. Return to caller, who persists messages and (optionally) flags an alert
 */

import { chat, llmConfigured } from "../lib/llm";
import { checkInput, checkOutput, withConstitution } from "./safety";
import { compilePersonaForTurn } from "./persona";
import { buildMemoryContext } from "./memory";
import type { Message } from "@workspace/db";

export interface TwinTurnInput {
  providerId: string;
  engagementId: string;
  sessionId: string;
  userId: string;
  initialStage?: string | null;
  userMessage: string;
  recentMessages: Message[];
}

export interface TwinTurnResult {
  reply: string;
  templated: boolean;
  decision: string;
  severity: string;
  alertProvider: boolean;
  exampleIds: string[];
  memoryIds: string[];
}

const NO_LLM_TEMPLATE =
  "I'm here to listen, but my AI service isn't configured right now. Could you save what you'd like to share — I'll let your therapist know.";

const SAFETY_FAIL_CLOSED_TEMPLATE =
  "I want to pause for a moment. I'm having trouble safely processing that. Please reach out to your therapist directly, and if you're in crisis, call or text 988 (US) or your local emergency number.";

export async function runTwinTurn(input: TwinTurnInput): Promise<TwinTurnResult> {
  const ctx = {
    sessionId: input.sessionId,
    engagementId: input.engagementId,
    userId: input.userId,
    providerId: input.providerId,
  };

  // ---- L1 input gate (fail-closed: if it throws, refuse the turn)
  let inVerdict;
  try {
    inVerdict = await checkInput(input.userMessage, ctx);
  } catch {
    return {
      reply: SAFETY_FAIL_CLOSED_TEMPLATE,
      templated: true,
      decision: "block_with_template",
      severity: "high",
      alertProvider: true,
      exampleIds: [],
      memoryIds: [],
    };
  }
  if (inVerdict.decision !== "allow") {
    // Any non-allow verdict MUST short-circuit. If the verdict didn't carry a
    // template (shouldn't happen, but defense-in-depth), use the fail-closed
    // template — never proceed to the LLM.
    return {
      reply: inVerdict.templatedResponse ?? SAFETY_FAIL_CLOSED_TEMPLATE,
      templated: true,
      decision: inVerdict.decision,
      severity: inVerdict.severity,
      alertProvider: Boolean(inVerdict.alertProvider),
      exampleIds: [],
      memoryIds: [],
    };
  }

  if (!llmConfigured()) {
    return {
      reply: NO_LLM_TEMPLATE,
      templated: true,
      decision: "block_with_template",
      severity: "info",
      alertProvider: false,
      exampleIds: [],
      memoryIds: [],
    };
  }

  // ---- L2 + L3 composition
  const [persona, memory] = await Promise.all([
    compilePersonaForTurn({
      providerId: input.providerId,
      query: input.userMessage,
      currentStage: input.initialStage,
    }),
    buildMemoryContext({ engagementId: input.engagementId, query: input.userMessage }),
  ]);

  const composed = [persona.systemPrompt, memory.block].filter(Boolean).join("\n\n");
  const finalSystem = withConstitution(composed);

  const aiMessages = [
    { role: "system" as const, content: finalSystem },
    ...input.recentMessages.slice(-20).map((m) => ({
      role: m.role === "seeker" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    { role: "user" as const, content: input.userMessage },
  ];

  let raw: string;
  try {
    raw = await chat({ model: persona.selectedModel, messages: aiMessages });
  } catch {
    return {
      reply:
        "Something went wrong on my end. Could you try again, or let your therapist know if it keeps happening?",
      templated: true,
      decision: "block_with_template",
      severity: "low",
      alertProvider: false,
      exampleIds: persona.exampleIds,
      memoryIds: memory.entryIds,
    };
  }
  const cleaned = raw.trim() || "Could you tell me a little more about what's on your mind?";

  // ---- L1 output gate (fail-closed)
  let outVerdict;
  try {
    outVerdict = await checkOutput(cleaned, input.userMessage, ctx);
  } catch {
    return {
      reply: SAFETY_FAIL_CLOSED_TEMPLATE,
      templated: true,
      decision: "block_with_template",
      severity: "high",
      alertProvider: true,
      exampleIds: persona.exampleIds,
      memoryIds: memory.entryIds,
    };
  }
  if (outVerdict.decision !== "allow") {
    return {
      reply: outVerdict.templatedResponse ?? SAFETY_FAIL_CLOSED_TEMPLATE,
      templated: true,
      decision: outVerdict.decision,
      severity: outVerdict.severity,
      alertProvider: Boolean(outVerdict.alertProvider),
      exampleIds: persona.exampleIds,
      memoryIds: memory.entryIds,
    };
  }

  return {
    reply: cleaned,
    templated: false,
    decision: "allow",
    severity: "info",
    alertProvider: false,
    exampleIds: persona.exampleIds,
    memoryIds: memory.entryIds,
  };
}
