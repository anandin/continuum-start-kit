import { logger } from "../lib/logger";
import { storage } from "../storage";
import { chat, llmConfigured, type ChatMessage } from "../lib/llm";
import { checkOutput } from "./safety";
import { sendPushToUser } from "../lib/push";
import {
  createOrGetTodaysNudge,
  getTodaysNudgeForSeeker,
  hasRecentHighSeveritySafetyEvent,
  markNudgeSent,
} from "./nudgeStorage";
import type { Engagement, Goal, Nudge, Session, Summary } from "@workspace/db";

// ----- helpers -----

function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStartedAt(s: Session): number {
  return new Date(s.startedAt ?? 0).getTime();
}

interface NudgeContext {
  seekerUserId: string;
  engagement: Engagement | null;
  lastSession: Session | null;
  summary: Summary | null;
  activeGoals: Goal[];
}

async function gatherContext(seekerUserId: string): Promise<NudgeContext> {
  const seeker = await storage.getSeekerByOwnerId(seekerUserId);
  if (!seeker) {
    return { seekerUserId, engagement: null, lastSession: null, summary: null, activeGoals: [] };
  }

  const engagements = await storage.getEngagementsBySeekerId(seeker.id);
  const engagement =
    engagements.find((e) => (e.status ?? "active") === "active") ?? engagements[0] ?? null;

  if (!engagement) {
    return { seekerUserId, engagement: null, lastSession: null, summary: null, activeGoals: [] };
  }

  const sessions = await storage.getSessionsByEngagementId(engagement.id);
  const ended = sessions.filter((s) => s.status === "ended");
  ended.sort((a, b) => getStartedAt(b) - getStartedAt(a));
  const lastSession = ended[0] ?? null;

  const summary = lastSession
    ? ((await storage.getSummaryBySessionId(lastSession.id)) ?? null)
    : null;

  const goals = await storage.getGoalsByEngagementId(engagement.id);
  const activeGoals = goals.filter((g) => g.status !== "completed");

  return { seekerUserId, engagement, lastSession, summary, activeGoals };
}

const FALLBACK_NUDGES = [
  "Take three slow breaths right now — in for four, hold for two, out for six.",
  "Name one small thing you can do for yourself in the next ten minutes.",
  "Notice one thing you're grateful for today and let it land for a moment.",
  "Step outside for two minutes if you can — just notice the air and the light.",
];

function pickFallback(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % FALLBACK_NUDGES.length;
  return FALLBACK_NUDGES[idx];
}

async function composeWithLlm(ctx: NudgeContext): Promise<{ body: string; source: string }> {
  if (!llmConfigured()) {
    return { body: pickFallback(ctx.seekerUserId), source: "fallback" };
  }

  const nextAction = ctx.summary?.nextAction?.trim();
  const goalTitles = ctx.activeGoals.slice(0, 3).map((g) => g.title);
  const insights = Array.isArray(ctx.summary?.keyInsights)
    ? (ctx.summary?.keyInsights as Array<string | { insight?: string }>)
        .map((it) => (typeof it === "string" ? it : it?.insight ?? ""))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const system: ChatMessage = {
    role: "system",
    content:
      "You write a single 30-second between-session prompt for someone working with a coach. " +
      "Constraints: ONE sentence, max 22 words, second-person ('you'), warm but not saccharine, " +
      "concrete and doable in under 2 minutes, NEVER claim to be a therapist or licensed clinician, " +
      "NEVER reference suicide, self-harm, hotlines, or medical advice. " +
      "Output ONLY the sentence — no preamble, no quotes.",
  };

  const contextLines: string[] = [];
  if (nextAction) contextLines.push(`Coach's suggested next step: ${nextAction}`);
  if (insights.length) contextLines.push(`Recent session insights:\n- ${insights.join("\n- ")}`);
  if (goalTitles.length) contextLines.push(`Active goals:\n- ${goalTitles.join("\n- ")}`);
  if (!contextLines.length) {
    contextLines.push("No prior session yet — write a gentle, generic centering prompt.");
  }

  const user: ChatMessage = {
    role: "user",
    content: `${contextLines.join("\n\n")}\n\nWrite the prompt now.`,
  };

  let preferredSource: "next_action" | "goal" | "fallback" = "fallback";
  if (nextAction) preferredSource = "next_action";
  else if (goalTitles.length) preferredSource = "goal";

  try {
    const raw = (await chat({ messages: [system, user], temperature: 0.7 })).trim();
    // Strip surrounding quotes the model sometimes adds despite instructions.
    const cleaned = raw.replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, "").trim();
    if (!cleaned) return { body: pickFallback(ctx.seekerUserId), source: "fallback" };
    return { body: cleaned, source: preferredSource };
  } catch (err) {
    logger.warn({ err }, "nudge LLM compose failed; using fallback");
    return { body: pickFallback(ctx.seekerUserId), source: "fallback" };
  }
}

/**
 * Generate today's nudge for the seeker if one doesn't exist yet, or return
 * the existing one. Returns null when nudges are suppressed (active high-
 * severity safety event in the last 24h) and no row exists for today — the
 * client should treat null as "no nudge today".
 */
export async function generateOrFetchTodaysNudge(seekerUserId: string): Promise<Nudge | null> {
  const today = todayYmdUtc();

  const existing = await getTodaysNudgeForSeeker(seekerUserId, today);
  if (existing) return existing;

  // Crisis suppression — never push small "try this" prompts in a crisis.
  const inCrisis = await hasRecentHighSeveritySafetyEvent(seekerUserId);
  if (inCrisis) {
    logger.info({ seekerUserId }, "nudge: skipped (recent high-severity safety event)");
    return null;
  }

  const ctx = await gatherContext(seekerUserId);

  // Need at least an engagement to anchor; otherwise skip silently.
  if (!ctx.engagement) {
    return null;
  }

  const { body, source } = await composeWithLlm(ctx);

  // L1 output gate — defense in depth in case the model improvises crisis
  // resources or claims to be a clinician. If the gate refuses, persist a
  // 'blocked' row so we don't keep regenerating the same problem all day.
  // If the gate itself throws (safety service down), fall back to a
  // hardcoded pre-vetted prompt rather than fail the whole request.
  let verdictDecision: "allow" | "block" = "allow";
  let blockedTemplate: string | null = null;
  let blockedReason: string | null = null;
  try {
    const verdict = await checkOutput(body, "[nudge composition]", {
      engagementId: ctx.engagement.id,
      userId: seekerUserId,
      providerId: ctx.engagement.providerId ?? undefined,
    });
    if (verdict.decision !== "allow") {
      verdictDecision = "block";
      blockedTemplate = verdict.templatedResponse ?? null;
      blockedReason = verdict.reason ?? null;
    }
  } catch (err) {
    logger.warn({ err, seekerUserId }, "nudge: L1 output gate threw; using safe fallback");
    verdictDecision = "block";
    blockedReason = "safety_service_error";
  }

  if (verdictDecision === "block") {
    await createOrGetTodaysNudge(
      {
        seekerUserId,
        engagementId: ctx.engagement.id,
        sourceSessionId: ctx.lastSession?.id ?? null,
        sourceGoalId: null,
        body: blockedTemplate ?? pickFallback(seekerUserId),
        source: "fallback",
        status: "blocked",
        day: today,
        snoozeUntil: null,
      },
      today,
    );
    logger.warn({ seekerUserId, reason: blockedReason }, "nudge blocked by L1 output gate");
    return null;
  }

  const sourceGoalId = source === "goal" ? ctx.activeGoals[0]?.id ?? null : null;

  const created = await createOrGetTodaysNudge(
    {
      seekerUserId,
      engagementId: ctx.engagement.id,
      sourceSessionId: ctx.lastSession?.id ?? null,
      sourceGoalId,
      body,
      source,
      status: "pending",
      day: today,
      snoozeUntil: null,
    },
    today,
  );

  // If a concurrent request already created today's nudge, just return it as-is
  // (don't double-send a push or re-mark sent).
  if (created.status !== "pending") {
    return created;
  }

  // Best-effort push delivery; mark sent regardless of token availability so
  // the in-app card is the source of truth.
  try {
    await sendPushToUser(seekerUserId, {
      title: "A small nudge for today",
      body,
      data: { kind: "nudge", id: created.id },
    });
  } catch (err) {
    logger.warn({ err, nudgeId: created.id }, "nudge push delivery failed");
  }

  const sent = await markNudgeSent(created.id);
  return sent ?? created;
}
