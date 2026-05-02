/**
 * AI Session Prep Brief composer.
 *
 * Given an engagement, gathers recent context (L3 client memory, last 3
 * session summaries, active goals, recent mood/journal entries, open
 * provider alerts) and asks the LLM to produce a 4-section brief the
 * coach reads before a session:
 *   - whatsChanged       — what's shifted since the last session
 *   - suggestedOpening   — a single warm opener line the coach can adapt
 *   - topicsToRevisit    — 2-4 threads worth picking up again
 *   - safetyContext      — concise note on safety signals & open alerts
 *
 * The composed text is wrapped through L1 `checkOutput` defense-in-depth
 * before persistence — if the gate softens or blocks, we store the L1
 * template instead and mark the brief `templated_safety`.
 */

import { storage } from "../storage";
import {
  listClientMemoryByEngagement,
  listSafetyEventsByEngagement,
} from "./twinStorage";
import { chat, llmConfigured } from "../lib/llm";
import { checkOutput, type SafetyContext } from "./safety";
import { logger } from "../lib/logger";
import { createSessionBrief } from "./sessionBriefStorage";
import type { Engagement, SessionBrief } from "@workspace/db";

export interface BriefSections {
  whatsChanged: string;
  suggestedOpening: string;
  topicsToRevisit: string[];
  safetyContext: string;
}

const COMPOSE_MODEL = "google/gemini-2.5-flash";

const FALLBACK_SECTIONS: BriefSections = {
  whatsChanged:
    "We couldn't generate a fresh summary right now. Open the Sessions, Mood, and Journal tabs for the latest signal before your meeting.",
  suggestedOpening:
    "How have things been since we last talked?",
  topicsToRevisit: [
    "Anything the client flagged as unresolved at the end of the last session.",
    "Active goals — review status together.",
  ],
  safetyContext:
    "Brief generation was unavailable. Check the Safety/Audit log directly for any recent events before opening the session.",
};

function clip(text: string, n: number): string {
  if (!text) return "";
  return text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text;
}

// ---------------------------------------------------------------------------
// PII scrubbing for LLM prompt construction.
//
// Free-text fields (session summaries, journal bodies, memory entries, goal
// descriptions, mood notes, alert messages, safety reasons) can contain real
// names, emails, phone numbers, and other identifiers that the seeker or
// coach typed in. We never want to forward that to the LLM provider, even
// when the prompt is otherwise scoped to a single engagement.
//
// `scrubPii` applies a deterministic regex pass:
//   - email-shaped tokens          → [email]
//   - URLs                          → [url]
//   - phone-number-shaped sequences → [phone]
//   - long bare digit runs (≥9)     → [number]   (covers SSN, account #s)
//   - any literal "known identifier" (the seeker's or provider's own email
//     or local-part) supplied by the caller → [name]
//
// This is deliberately conservative — it will over-redact rather than leak.
// Names of third parties (siblings, employers, etc.) cannot be detected
// without an NER model, so the disclaimer in the UI also tells coaches the
// brief is AI-composed and may omit nuance.
// ---------------------------------------------------------------------------

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const URL_RE = /\bhttps?:\/\/\S+/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const LONG_DIGITS_RE = /\b\d{9,}\b/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scrubPii(text: string | null | undefined, knownIdentifiers: string[] = []): string {
  if (!text) return "";
  let out = text;
  // Order matters: emails before URL (so user@host.tld doesn't get caught as
  // a URL fragment) and before LONG_DIGITS_RE.
  out = out.replace(EMAIL_RE, "[email]");
  out = out.replace(URL_RE, "[url]");
  out = out.replace(PHONE_RE, "[phone]");
  out = out.replace(LONG_DIGITS_RE, "[number]");
  for (const id of knownIdentifiers) {
    if (!id || id.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegExp(id)}\\b`, "gi");
    out = out.replace(re, "[name]");
  }
  return out;
}

// Builds the list of identifiers (emails + local-parts) we know belong to
// the seeker and the coach so we can mask them by name. We can't enumerate
// third-party names, but covering the two participants of the engagement
// catches the most common accidental self-references.
async function gatherKnownIdentifiers(engagement: Engagement): Promise<string[]> {
  const ids = new Set<string>();
  const userIds: string[] = [];
  if (engagement.providerId) userIds.push(engagement.providerId);
  if (engagement.seekerId) {
    const seeker = await storage.getSeekerById(engagement.seekerId);
    if (seeker?.ownerId) userIds.push(seeker.ownerId);
  }
  for (const uid of userIds) {
    try {
      const user = await storage.getUserById(uid);
      if (user?.email) {
        ids.add(user.email);
        const local = user.email.split("@")[0];
        if (local && local.length >= 3) ids.add(local);
      }
      const profile = await storage.getProfileByUserId(uid);
      if (profile?.email) {
        ids.add(profile.email);
        const local = profile.email.split("@")[0];
        if (local && local.length >= 3) ids.add(local);
      }
    } catch {
      // Best-effort; if a lookup fails we still apply the regex scrub.
    }
  }
  return Array.from(ids);
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "unknown date";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "unknown date";
  return dt.toISOString().slice(0, 10);
}

function isoDayNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

interface GatheredContext {
  engagement: Engagement;
  seekerAlias: string;
  lastSummaries: Array<{ sessionStartedAt: Date | null; summary: string; nextAction: string | null }>;
  openGoals: Array<{ title: string; description: string | null; status: string | null }>;
  recentMoods: Array<{ day: string; rating: number | null; note: string | null }>;
  recentJournalEntries: Array<{ at: Date | null; promptText: string | null; content: string }>;
  memoryEntries: Array<{ kind: string; content: string; tags: string[]; importance: number }>;
  openSafetyEvents: Array<{ at: Date | null; severity: string; reason: string; stage: string }>;
  openAlerts: Array<{ at: Date | null; type: string; message: string }>;
}

async function gatherContext(engagementId: string): Promise<GatheredContext | { error: string }> {
  const engagement = await storage.getEngagementById(engagementId);
  if (!engagement) return { error: "engagement_not_found" };

  // Seeker alias for the LLM prompt — never pass real names. Match the
  // anonymized "Client {first 8 chars of seekerId}" convention used in the
  // provider UI so the brief reads consistently with what the coach sees.
  const aliasSeed = engagement.seekerId ?? engagement.id;
  const seekerAlias = `Client ${aliasSeed.slice(0, 8)}`;

  // PII scrub list — emails / local-parts of the engagement's seeker and
  // provider. Free-text from either party that name-drops themselves will
  // be masked before the prompt is sent to the LLM provider.
  const knownIds = await gatherKnownIdentifiers(engagement);
  const scrub = (t: string | null | undefined) => scrubPii(t, knownIds);

  // Last 3 session summaries (chronological newest-first from storage).
  const sessions = await storage.getSessionsByEngagementId(engagementId);
  const lastSummaries: GatheredContext["lastSummaries"] = [];
  for (const s of sessions.slice(0, 3)) {
    const summary = await storage.getSummaryBySessionId(s.id);
    if (summary?.sessionSummary) {
      lastSummaries.push({
        sessionStartedAt: s.startedAt ?? null,
        summary: scrub(summary.sessionSummary),
        nextAction: summary.nextAction ? scrub(summary.nextAction) : null,
      });
    }
  }

  // Open goals only.
  const allGoals = await storage.getGoalsByEngagementId(engagementId);
  const openGoals = allGoals
    .filter((g) => (g.status ?? "active") === "active")
    .slice(0, 8)
    .map((g) => ({
      title: scrub(g.title),
      description: g.description ? scrub(g.description) : null,
      status: g.status ?? null,
    }));

  // Recent mood (14 days) + journal (last 6 shared).
  const recentMoods = (await storage.getMoodEntriesByEngagementId(engagementId, isoDayNDaysAgo(14)))
    .slice(-14)
    .map((m) => ({
      day: typeof m.day === "string" ? m.day : fmtDate(m.day as unknown as Date),
      rating: m.score ?? null,
      note: m.note ? scrub(m.note) : null,
    }));
  const sharedJournal = await storage.listSharedJournalEntriesByEngagementId(engagementId);
  const recentJournalEntries = sharedJournal.slice(0, 6).map((j) => ({
    at: j.sharedAt ?? j.createdAt ?? null,
    promptText: null as string | null,
    content: scrub(clip(j.body ?? "", 600)),
  }));

  // L3 memory — top by importance/recency. Use the simple recency listing
  // rather than topClientMemory(query) since the brief needs a broad view,
  // not a query-specific slice.
  const memRows = await listClientMemoryByEngagement(engagementId);
  const memoryEntries = memRows
    .slice(0, 12)
    .map((m) => ({
      kind: m.kind,
      content: scrub(clip(m.content, 500)),
      tags: Array.isArray(m.tags) ? (m.tags as string[]) : [],
      importance: typeof m.importance === "number" ? m.importance : 0.5,
    }));

  // Safety events scoped to this engagement: only high/critical signals
  // from the last 14 days. The full audit log is informational and would
  // otherwise drown the brief's safety section in routine "allow" rows.
  const SAFETY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
  const safetyCutoff = Date.now() - SAFETY_WINDOW_MS;
  const safetyRows = await listSafetyEventsByEngagement(engagementId, 50);
  const openSafetyEvents = safetyRows
    .filter((e) => {
      const sev = (e.severity ?? "").toLowerCase();
      if (sev !== "high" && sev !== "critical") return false;
      const at = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      return Number.isFinite(at) && at >= safetyCutoff;
    })
    .slice(0, 10)
    .map((e) => ({
      at: e.createdAt ?? null,
      severity: e.severity ?? "info",
      reason: scrub(e.reason ?? ""),
      stage: e.stage ?? "",
    }));

  // Open (unread) alerts for this provider, filtered to this engagement.
  const allAlerts = engagement.providerId
    ? await storage.getAlertsByProviderId(engagement.providerId)
    : [];
  const openAlerts = allAlerts
    .filter((a) => a.engagementId === engagementId && !a.isRead)
    .slice(0, 12)
    .map((a) => ({
      at: a.createdAt ?? null,
      type: a.type ?? "alert",
      message: scrub(a.message ?? ""),
    }));

  return {
    engagement,
    seekerAlias,
    lastSummaries,
    openGoals,
    recentMoods,
    recentJournalEntries,
    memoryEntries,
    openSafetyEvents,
    openAlerts,
  };
}

function renderContextPrompt(ctx: GatheredContext): string {
  const lines: string[] = [];
  lines.push(`CLIENT_ALIAS: ${ctx.seekerAlias}`);

  lines.push("\nLAST_SESSION_SUMMARIES (newest first):");
  if (ctx.lastSummaries.length === 0) {
    lines.push("  (none)");
  } else {
    for (const s of ctx.lastSummaries) {
      lines.push(`- date=${fmtDate(s.sessionStartedAt)}`);
      lines.push(`  summary: ${clip(s.summary, 700)}`);
      if (s.nextAction) lines.push(`  next_action: ${clip(s.nextAction, 250)}`);
    }
  }

  lines.push("\nOPEN_GOALS:");
  if (ctx.openGoals.length === 0) lines.push("  (none)");
  else {
    for (const g of ctx.openGoals) {
      lines.push(`- ${g.title}${g.description ? ` — ${clip(g.description, 200)}` : ""}`);
    }
  }

  lines.push("\nRECENT_MOOD (last 14 days, 1-5 scale):");
  if (ctx.recentMoods.length === 0) lines.push("  (none)");
  else {
    for (const m of ctx.recentMoods) {
      const note = m.note ? ` — ${clip(m.note, 120)}` : "";
      lines.push(`- ${m.day}: ${m.rating ?? "?"}${note}`);
    }
  }

  lines.push("\nRECENT_SHARED_JOURNAL:");
  if (ctx.recentJournalEntries.length === 0) lines.push("  (none)");
  else {
    for (const j of ctx.recentJournalEntries) {
      const prompt = j.promptText ? ` (prompt: "${clip(j.promptText, 100)}")` : "";
      lines.push(`- ${fmtDate(j.at)}${prompt}: ${j.content}`);
    }
  }

  lines.push("\nL3_CLIENT_MEMORY (top entries by recency):");
  if (ctx.memoryEntries.length === 0) lines.push("  (none)");
  else {
    for (const m of ctx.memoryEntries) {
      const tags = m.tags.length ? ` [${m.tags.join(", ")}]` : "";
      lines.push(`- (${m.kind}, importance=${m.importance.toFixed(2)})${tags} ${m.content}`);
    }
  }

  lines.push("\nRECENT_SAFETY_EVENTS:");
  if (ctx.openSafetyEvents.length === 0) lines.push("  (none)");
  else {
    for (const e of ctx.openSafetyEvents) {
      lines.push(`- ${fmtDate(e.at)} severity=${e.severity} stage=${e.stage} reason=${e.reason}`);
    }
  }

  lines.push("\nOPEN_PROVIDER_ALERTS (unread):");
  if (ctx.openAlerts.length === 0) lines.push("  (none)");
  else {
    for (const a of ctx.openAlerts) {
      lines.push(`- ${fmtDate(a.at)} type=${a.type}: ${clip(a.message, 200)}`);
    }
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are a clinical-support assistant generating a session prep brief for a licensed therapist who is about to meet with their client. You are NOT speaking to the client.

Your audience is the therapist. Be concise, professional, non-prescriptive. You are an AI assistant, not a clinician — never give a clinical diagnosis or recommend specific medications. Do not invent facts. If a section has no data, say so plainly ("No new signal since last session.") rather than fabricating.

Output ONLY a JSON object with this exact shape:
{
  "whatsChanged": string,         // 1-3 sentences on what shifted since the last session
  "suggestedOpening": string,     // ONE sentence the therapist can adapt as their opener — warm, open-ended, no jargon
  "topicsToRevisit": string[],    // 2-4 short bullet strings (each ≤ 140 chars)
  "safetyContext": string         // 1-3 sentences naming any safety signals + open alerts; "No active safety concerns." if none
}

Do not include markdown, headings, or commentary outside the JSON.`;

function parseSections(raw: string): BriefSections | null {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    const obj = JSON.parse(cleaned);
    if (!obj || typeof obj !== "object") return null;
    const whatsChanged = typeof obj.whatsChanged === "string" ? obj.whatsChanged.trim() : "";
    const suggestedOpening = typeof obj.suggestedOpening === "string" ? obj.suggestedOpening.trim() : "";
    const topicsRaw = Array.isArray(obj.topicsToRevisit) ? obj.topicsToRevisit : [];
    const topicsToRevisit = topicsRaw
      .filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t: string) => t.trim())
      .slice(0, 6);
    const safetyContext = typeof obj.safetyContext === "string" ? obj.safetyContext.trim() : "";
    if (!whatsChanged && !suggestedOpening && topicsToRevisit.length === 0 && !safetyContext) {
      return null;
    }
    return {
      whatsChanged: whatsChanged || FALLBACK_SECTIONS.whatsChanged,
      suggestedOpening: suggestedOpening || FALLBACK_SECTIONS.suggestedOpening,
      topicsToRevisit: topicsToRevisit.length > 0 ? topicsToRevisit : FALLBACK_SECTIONS.topicsToRevisit,
      safetyContext: safetyContext || FALLBACK_SECTIONS.safetyContext,
    };
  } catch {
    return null;
  }
}

// Render the four sections as a single text blob so L1 checkOutput can
// inspect the entire brief in one pass.
function sectionsToText(s: BriefSections): string {
  const topics = s.topicsToRevisit.map((t) => `- ${t}`).join("\n");
  return [
    `What's changed: ${s.whatsChanged}`,
    `Suggested opening: ${s.suggestedOpening}`,
    `Topics to revisit:\n${topics}`,
    `Safety context: ${s.safetyContext}`,
  ].join("\n\n");
}

export interface GenerateBriefResult {
  brief: SessionBrief;
}

export async function generateAndSaveBriefForEngagement(opts: {
  engagementId: string;
  providerId: string;
}): Promise<GenerateBriefResult | { error: string }> {
  const { engagementId, providerId } = opts;

  const gathered = await gatherContext(engagementId);
  if ("error" in gathered) return { error: gathered.error };

  const safetyCtx: SafetyContext = {
    engagementId,
    providerId,
    userId: providerId,
  };

  let sections: BriefSections = FALLBACK_SECTIONS;
  let model: string | null = null;
  let composedOk = false;

  if (llmConfigured()) {
    try {
      const userPrompt = renderContextPrompt(gathered);
      const raw = await chat({
        model: COMPOSE_MODEL,
        temperature: 0.4,
        jsonMode: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
      const parsed = parseSections(raw);
      if (parsed) {
        sections = parsed;
        model = COMPOSE_MODEL;
        composedOk = true;
      } else {
        logger.warn({ engagementId }, "session-brief: LLM returned unparseable JSON");
      }
    } catch (err) {
      logger.error({ err, engagementId }, "session-brief: LLM compose failed");
    }
  } else {
    logger.warn({ engagementId }, "session-brief: LLM not configured, using fallback");
  }

  // L1 output gate (defense-in-depth). Wraps everything: even the
  // fallback text gets checked. If the gate softens/blocks, we replace
  // the entire brief body with the templated response and flag status.
  let status: "ready" | "templated_safety" | "failed" = composedOk ? "ready" : "failed";
  let safetyDecision: string | null = null;
  let safetyReason: string | null = null;

  try {
    const briefText = sectionsToText(sections);
    const verdict = await checkOutput(briefText, "[session_prep_brief]", safetyCtx);
    safetyDecision = verdict.decision;
    safetyReason = verdict.reason;
    if (verdict.decision !== "allow" && verdict.templatedResponse) {
      sections = {
        whatsChanged: verdict.templatedResponse,
        suggestedOpening: FALLBACK_SECTIONS.suggestedOpening,
        topicsToRevisit: ["Review safety log directly before this session."],
        safetyContext:
          "The auto-generated brief was withheld by the safety gate; review the audit log and recent messages directly.",
      };
      status = "templated_safety";
    }
  } catch (err) {
    // Safety persist failed — fail closed. Keep the brief but mark it.
    logger.error({ err, engagementId }, "session-brief: L1 output gate threw");
    sections = FALLBACK_SECTIONS;
    status = "failed";
    safetyDecision = "fail_closed";
    safetyReason = "output_gate_failure";
  }

  const brief = await createSessionBrief({
    engagementId,
    providerId,
    sections: sections as unknown as Record<string, unknown>,
    status,
    safetyDecision,
    safetyReason,
    model,
  });

  return { brief };
}
