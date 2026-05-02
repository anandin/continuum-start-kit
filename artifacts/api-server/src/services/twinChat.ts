/**
 * Therapist Twin orchestration: L1 input → L2/L3 compose → LLM → L1 output.
 */

import { chat, llmConfigured } from "../lib/llm";
import { checkInput, checkOutput, withConstitution, crisisTemplateFor, type SafetyRegion } from "./safety";
import { getActiveAgentVersionForProvider } from "./twinStorage";
import { compilePersonaForTurn } from "./persona";
import { buildMemoryContext } from "./memory";
import { storage } from "../storage";
import type { Message } from "@workspace/db";

/** Resolve user region for crisis-template localization; defaults to US. */
async function resolveRegion(userId: string): Promise<SafetyRegion> {
  try {
    const user = await storage.getUserById(userId);
    const raw = (user as unknown as { region?: string } | undefined)?.region;
    return raw === "INTL" ? "INTL" : "US";
  } catch {
    return "US";
  }
}

export interface TwinTurnInput {
  providerId: string;
  // Null for non-persisted contexts (calibration, dry runs).
  engagementId: string | null;
  sessionId: string | null;
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

function buildFailClosedTemplate(region: SafetyRegion): string {
  const intro =
    "I want to pause for a moment. I'm having trouble safely processing that. Please reach out to your therapist directly.";
  return `${intro}\n\n${crisisTemplateFor({ region })}`;
}

export async function runTwinTurn(input: TwinTurnInput): Promise<TwinTurnResult> {
  const region = await resolveRegion(input.userId);
  // Pin agent_version once so every safety_event for this turn references
  // the exact persona version the model was prompted with.
  const activeVersion = await getActiveAgentVersionForProvider(input.providerId).catch(() => undefined);
  const ctx = {
    sessionId: input.sessionId ?? undefined,
    engagementId: input.engagementId ?? undefined,
    userId: input.userId,
    providerId: input.providerId,
    region,
    agentVersionId: activeVersion?.id,
  };

  // L1 input gate (fail-closed)
  let inVerdict;
  try {
    inVerdict = await checkInput(input.userMessage, ctx);
  } catch {
    return {
      reply: buildFailClosedTemplate(region),
      templated: true,
      decision: "block_with_template",
      severity: "high",
      alertProvider: true,
      exampleIds: [],
      memoryIds: [],
    };
  }
  if (inVerdict.decision !== "allow") {
    return {
      reply: inVerdict.templatedResponse ?? buildFailClosedTemplate(region),
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

  // L2 + L3 composition
  const [persona, memory] = await Promise.all([
    compilePersonaForTurn({
      providerId: input.providerId,
      query: input.userMessage,
      currentStage: input.initialStage,
    }),
    input.engagementId
      ? buildMemoryContext({ engagementId: input.engagementId, query: input.userMessage })
      : Promise.resolve({ block: "", entryIds: [] as string[] }),
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

  // Guarded LLM invocation — chat + L1 output check inside one helper so
  // no model reply can escape without checkOutput.
  type GuardedOk = { kind: "ok"; cleaned: string };
  type GuardedSafe = {
    kind: "safe";
    result: TwinTurnResult;
  };
  const guardedChatTurn = async (): Promise<GuardedOk | GuardedSafe> => {
    let raw: string;
    try {
      raw = await chat({ model: persona.selectedModel, messages: aiMessages });
    } catch {
      return {
        kind: "safe",
        result: {
          reply:
            "Something went wrong on my end. Could you try again, or let your therapist know if it keeps happening?",
          templated: true,
          decision: "block_with_template",
          severity: "low",
          alertProvider: false,
          exampleIds: persona.exampleIds,
          memoryIds: memory.entryIds,
        },
      };
    }
    const cleaned = raw.trim() || "Could you tell me a little more about what's on your mind?";

    // L1 output gate (fail-closed)
    let outVerdict;
    try {
      outVerdict = await checkOutput(cleaned, input.userMessage, ctx);
    } catch {
      return {
        kind: "safe",
        result: {
          reply: buildFailClosedTemplate(region),
          templated: true,
          decision: "block_with_template",
          severity: "high",
          alertProvider: true,
          exampleIds: persona.exampleIds,
          memoryIds: memory.entryIds,
        },
      };
    }
    if (outVerdict.decision !== "allow") {
      return {
        kind: "safe",
        result: {
          reply: outVerdict.templatedResponse ?? buildFailClosedTemplate(region),
          templated: true,
          decision: outVerdict.decision,
          severity: outVerdict.severity,
          alertProvider: Boolean(outVerdict.alertProvider),
          exampleIds: persona.exampleIds,
          memoryIds: memory.entryIds,
        },
      };
    }
    return { kind: "ok", cleaned };
  };

  const guarded = await guardedChatTurn();
  if (guarded.kind === "safe") return guarded.result;

  return {
    reply: guarded.cleaned,
    templated: false,
    decision: "allow",
    severity: "info",
    alertProvider: false,
    exampleIds: persona.exampleIds,
    memoryIds: memory.entryIds,
  };
}
