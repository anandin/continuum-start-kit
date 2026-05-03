import { db } from "../db";
import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import {
  safetyEvents,
  agentVersions,
  personaExamples,
  calibrationSessions,
  clientMemory,
  engagements,
  seekers,
  sessions,
  messages,
  type InsertSafetyEvent,
  type InsertAgentVersion,
  type InsertPersonaExample,
  type InsertCalibrationSession,
  type InsertClientMemory,
  type SafetyEvent,
  type AgentVersion,
  type PersonaExample,
  type CalibrationSession,
  type ClientMemory,
  type Message,
} from "@workspace/db";

// ============ Safety events (L1 audit log) ============
export async function logSafetyEvent(data: InsertSafetyEvent): Promise<SafetyEvent> {
  const [row] = await db.insert(safetyEvents).values(data).returning();
  return row;
}

export async function listSafetyEventsByProvider(providerId: string, limit = 200): Promise<SafetyEvent[]> {
  return db
    .select()
    .from(safetyEvents)
    .where(eq(safetyEvents.providerId, providerId))
    .orderBy(desc(safetyEvents.createdAt))
    .limit(limit);
}

// Per-client (engagement-scoped) audit log — what one client triggered.
export async function listSafetyEventsByEngagement(
  engagementId: string,
  limit = 200,
): Promise<SafetyEvent[]> {
  return db
    .select()
    .from(safetyEvents)
    .where(eq(safetyEvents.engagementId, engagementId))
    .orderBy(desc(safetyEvents.createdAt))
    .limit(limit);
}

// ============ Agent versions (L2 reproducibility) ============
export async function createAgentVersion(data: InsertAgentVersion): Promise<AgentVersion> {
  const [row] = await db.insert(agentVersions).values(data).returning();
  return row;
}

export async function getActiveAgentVersionForProvider(providerId: string): Promise<AgentVersion | undefined> {
  const [row] = await db
    .select()
    .from(agentVersions)
    .where(and(eq(agentVersions.providerId, providerId), eq(agentVersions.isActive, true)))
    .orderBy(desc(agentVersions.version))
    .limit(1);
  return row;
}

// Ensure exactly one active version per provider; called before inserting a new active row.
async function deactivateAllAgentVersionsForProvider(providerId: string): Promise<void> {
  await db
    .update(agentVersions)
    .set({ isActive: false })
    .where(and(eq(agentVersions.providerId, providerId), eq(agentVersions.isActive, true)));
}

// Snapshot current persona config + active example IDs on material change
// (onboarding apply, calibration approve/correct, review-queue label).
export async function bumpAgentVersion(opts: {
  providerId: string;
  reason: string;
  createdBy?: string | null;
  agentConfig: Record<string, unknown> | null;
  providerConfig: Record<string, unknown> | null;
  compiledSystemPrompt: string;
  exampleIds: string[];
}): Promise<AgentVersion> {
  const prev = await getActiveAgentVersionForProvider(opts.providerId);
  const nextVersion = (prev?.version ?? 0) + 1;
  await deactivateAllAgentVersionsForProvider(opts.providerId);
  const snapshot = {
    reason: opts.reason,
    agentConfig: opts.agentConfig,
    providerConfig: opts.providerConfig,
  };
  const [row] = await db
    .insert(agentVersions)
    .values({
      providerId: opts.providerId,
      version: nextVersion,
      compiledSystemPrompt: opts.compiledSystemPrompt,
      agentConfigSnapshot: snapshot,
      exampleIds: opts.exampleIds,
      isActive: true,
      createdBy: opts.createdBy ?? null,
    })
    .returning();
  return row;
}

// ============ Persona examples (L2) ============
export async function createPersonaExample(
  data: InsertPersonaExample,
  embedding: number[] | null,
): Promise<PersonaExample> {
  const insertVal = embedding ? { ...data, embedding } : data;
  const [row] = await db.insert(personaExamples).values(insertVal).returning();
  return row;
}

export async function listPersonaExamplesByProvider(providerId: string): Promise<PersonaExample[]> {
  return db
    .select()
    .from(personaExamples)
    .where(and(eq(personaExamples.providerId, providerId), eq(personaExamples.isActive, true)))
    .orderBy(desc(personaExamples.createdAt));
}

export async function getPersonaExampleById(id: string): Promise<PersonaExample | undefined> {
  const [row] = await db.select().from(personaExamples).where(eq(personaExamples.id, id)).limit(1);
  return row;
}

export async function deactivatePersonaExample(id: string): Promise<void> {
  await db.update(personaExamples).set({ isActive: false }).where(eq(personaExamples.id, id));
}

// Top-K most relevant persona examples for a query (vector search if embedding given,
// otherwise recency + tag overlap fallback).
//
// `playbookId` (when supplied) restricts retrieval to that playbook only — used
// when an engagement has been assigned a playbook. When null, the legacy
// behavior (all of the provider's active examples) is preserved so seekers
// without an assigned playbook keep working.
export async function topPersonaExamples(
  providerId: string,
  query: string,
  queryEmbedding: number[] | null,
  k = 4,
  playbookId: string | null = null,
): Promise<PersonaExample[]> {
  if (queryEmbedding) {
    const literal = `[${queryEmbedding.join(",")}]`;
    const playbookClause = playbookId
      ? sql`AND ${personaExamples.playbookId} = ${playbookId}`
      : sql``;
    // Vector search picks the IDs; Drizzle loads the typed rows in proper order.
    const ranked = await db.execute<{ id: string }>(sql`
      SELECT id FROM ${personaExamples}
      WHERE ${personaExamples.providerId} = ${providerId}
        AND ${personaExamples.isActive} = true
        AND ${personaExamples.embedding} IS NOT NULL
        ${playbookClause}
      ORDER BY ${personaExamples.embedding} <=> ${literal}::vector
      LIMIT ${k}
    `);
    const ids = (ranked.rows as { id: string }[]).map((r) => r.id);
    if (ids.length === 0) return [];
    const rows = await db.select().from(personaExamples).where(inArray(personaExamples.id, ids));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is PersonaExample => Boolean(r));
  }
  // Lexical fallback. When scoped to a playbook, only consider rows in that playbook.
  const allBase = await listPersonaExamplesByProvider(providerId);
  const all = playbookId ? allBase.filter((e) => e.playbookId === playbookId) : allBase;
  if (all.length === 0) return [];
  const lc = query.toLowerCase();
  const scored = all.map((ex) => {
    const tagHits = Array.isArray(ex.tags)
      ? (ex.tags as string[]).filter((t) => lc.includes(String(t).toLowerCase())).length
      : 0;
    const scenarioHit = ex.scenario.toLowerCase().split(/\W+/).some((w: string) => w.length > 4 && lc.includes(w));
    return { ex, score: tagHits * 2 + (scenarioHit ? 1 : 0) + (ex.weight ?? 1) * 0.1 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.ex);
}

// ============ Calibration sessions ============
export async function createCalibrationSession(data: InsertCalibrationSession): Promise<CalibrationSession> {
  const [row] = await db.insert(calibrationSessions).values(data).returning();
  return row;
}

export async function getCalibrationSession(id: string): Promise<CalibrationSession | undefined> {
  const [row] = await db.select().from(calibrationSessions).where(eq(calibrationSessions.id, id)).limit(1);
  return row;
}

export async function listCalibrationSessionsByProvider(providerId: string): Promise<CalibrationSession[]> {
  return db
    .select()
    .from(calibrationSessions)
    .where(eq(calibrationSessions.providerId, providerId))
    .orderBy(desc(calibrationSessions.createdAt));
}

export async function updateCalibrationSession(
  id: string,
  data: Partial<{ transcript: unknown; status: "in_progress" | "completed" | "abandoned"; completedAt: Date }>,
): Promise<CalibrationSession | undefined> {
  const [row] = await db.update(calibrationSessions).set(data).where(eq(calibrationSessions.id, id)).returning();
  return row;
}

// ============ Client memory (L3) ============
export async function writeClientMemory(
  data: InsertClientMemory,
  embedding: number[] | null,
): Promise<ClientMemory> {
  const insertVal = embedding ? { ...data, embedding } : data;
  const [row] = await db.insert(clientMemory).values(insertVal).returning();
  return row;
}

export async function getClientMemoryById(id: string): Promise<ClientMemory | undefined> {
  const [row] = await db.select().from(clientMemory).where(eq(clientMemory.id, id)).limit(1);
  return row;
}

export async function listClientMemoryByEngagement(engagementId: string): Promise<ClientMemory[]> {
  return db
    .select()
    .from(clientMemory)
    .where(and(eq(clientMemory.engagementId, engagementId), isNull(clientMemory.redactedAt)))
    .orderBy(desc(clientMemory.createdAt));
}

export async function redactClientMemory(id: string, redactedBy: string): Promise<void> {
  await db
    .update(clientMemory)
    .set({ redactedAt: new Date(), redactedBy })
    .where(eq(clientMemory.id, id));
}

// Cascade: when a seeker redacts a message, soft-redact every L3 memory row
// that was attributed to it. Returns the affected ids so the caller can
// audit each one in safety_events.
export async function redactClientMemoryBySourceMessage(
  sourceMessageId: string,
  redactedBy: string,
): Promise<string[]> {
  const rows = await db
    .update(clientMemory)
    .set({ redactedAt: new Date(), redactedBy })
    .where(
      and(
        eq(clientMemory.sourceMessageId, sourceMessageId),
        isNull(clientMemory.redactedAt),
      ),
    )
    .returning({ id: clientMemory.id });
  return rows.map((r) => r.id);
}

// Seeker-facing list: every non-redacted L3 entry across all engagements
// the seeker owns. Used by the "Manage memory" page so seekers can see
// (and forget) anything the twin remembers about them.
export async function listClientMemoryForSeekerOwner(
  ownerUserId: string,
): Promise<ClientMemory[]> {
  return db
    .select({
      id: clientMemory.id,
      engagementId: clientMemory.engagementId,
      sessionId: clientMemory.sessionId,
      sourceMessageId: clientMemory.sourceMessageId,
      kind: clientMemory.kind,
      content: clientMemory.content,
      tags: clientMemory.tags,
      importance: clientMemory.importance,
      embedding: clientMemory.embedding,
      redactedAt: clientMemory.redactedAt,
      redactedBy: clientMemory.redactedBy,
      createdAt: clientMemory.createdAt,
    })
    .from(clientMemory)
    .innerJoin(engagements, eq(engagements.id, clientMemory.engagementId))
    .innerJoin(seekers, eq(seekers.id, engagements.seekerId))
    .where(and(eq(seekers.ownerId, ownerUserId), isNull(clientMemory.redactedAt)))
    .orderBy(desc(clientMemory.createdAt));
}

export async function topClientMemory(
  engagementId: string,
  query: string,
  queryEmbedding: number[] | null,
  k = 6,
): Promise<ClientMemory[]> {
  if (queryEmbedding) {
    const literal = `[${queryEmbedding.join(",")}]`;
    // Vector search picks the IDs; Drizzle loads the typed rows in proper order.
    const ranked = await db.execute<{ id: string }>(sql`
      SELECT id FROM ${clientMemory}
      WHERE ${clientMemory.engagementId} = ${engagementId}
        AND ${clientMemory.redactedAt} IS NULL
        AND ${clientMemory.embedding} IS NOT NULL
      ORDER BY ${clientMemory.embedding} <=> ${literal}::vector
      LIMIT ${k}
    `);
    const ids = (ranked.rows as { id: string }[]).map((r) => r.id);
    if (ids.length === 0) return [];
    const rows = await db.select().from(clientMemory).where(inArray(clientMemory.id, ids));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is ClientMemory => Boolean(r));
  }
  const all = await listClientMemoryByEngagement(engagementId);
  if (all.length === 0) return [];
  const lc = query.toLowerCase();
  const scored = all.map((m) => {
    const tagHits = Array.isArray(m.tags)
      ? (m.tags as string[]).filter((t) => lc.includes(String(t).toLowerCase())).length
      : 0;
    const contentHit = m.content.toLowerCase().split(/\W+/).some((w: string) => w.length > 4 && lc.includes(w));
    return { m, score: tagHits * 2 + (contentHit ? 1 : 0) + (m.importance ?? 0.5) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.m);
}

// Edit a memory entry; embedding is recomputed by the caller when content changes.
export async function updateClientMemory(
  id: string,
  patch: Partial<{
    kind: string;
    content: string;
    tags: string[];
    importance: number;
  }>,
  embedding: number[] | null,
): Promise<ClientMemory | undefined> {
  const setVal = embedding ? { ...patch, embedding } : patch;
  const [row] = await db
    .update(clientMemory)
    .set(setVal)
    .where(eq(clientMemory.id, id))
    .returning();
  return row;
}

// ============ Review queue ============
// Sample recent agent messages this provider hasn't labeled, scored by
// uncertainty (L1 flags) + client feedback proxy + topic coverage + recency.
export interface ReviewItem {
  messageId: string;
  sessionId: string;
  engagementId: string;
  scenario: string; // the prior user message, or "" if none
  draft: string;   // the assistant message text
  createdAt: Date | null;
}

export async function listReviewQueueForProvider(
  providerId: string,
  limit = 20,
): Promise<ReviewItem[]> {
  // 1. Provider engagements → sessions → agent messages (overfetch for scoring).
  const engs = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(eq(engagements.providerId, providerId));
  if (engs.length === 0) return [];
  const engIds = engs.map((e) => e.id);

  const sess = await db
    .select({ id: sessions.id, engagementId: sessions.engagementId })
    .from(sessions)
    .where(inArray(sessions.engagementId, engIds));
  if (sess.length === 0) return [];
  const sessionIdToEng = new Map(sess.map((s) => [s.id, s.engagementId ?? ""]));
  const sessIds = sess.map((s) => s.id);

  const overfetch = Math.max(limit * 5, 60);
  const agentMsgs = await db
    .select()
    .from(messages)
    .where(and(inArray(messages.sessionId, sessIds), eq(messages.role, "agent")))
    .orderBy(desc(messages.createdAt))
    .limit(overfetch);

  if (agentMsgs.length === 0) return [];

  // 2. All messages in touched sessions (for prior seeker + next-seeker feedback).
  const touchedSessIds = agentMsgs
    .map((m) => m.sessionId)
    .filter((s): s is string => !!s);
  const allMsgsRaw: Message[] = await db
    .select()
    .from(messages)
    .where(inArray(messages.sessionId, touchedSessIds))
    .orderBy(messages.createdAt);
  // Scrub redacted seeker text so it can't surface in the review queue's
  // scenario field or be re-embedded into persona examples on labeling.
  const allMsgs: Message[] = allMsgsRaw.map((m) =>
    m.redactedAt ? { ...m, content: "" } : m,
  );

  const bySession = new Map<string, Message[]>();
  for (const m of allMsgs) {
    if (!m.sessionId) continue;
    const arr = bySession.get(m.sessionId) ?? [];
    arr.push(m);
    bySession.set(m.sessionId, arr);
  }

  // 3. Skip already-labeled drafts.
  const labeled = await db
    .select({
      approvedResponse: personaExamples.approvedResponse,
      rejectedResponse: personaExamples.rejectedResponse,
    })
    .from(personaExamples)
    .where(eq(personaExamples.providerId, providerId));
  const labeledDrafts = new Set<string>();
  for (const row of labeled) {
    if (row.approvedResponse) labeledDrafts.add(row.approvedResponse.trim());
    if (row.rejectedResponse) labeledDrafts.add(row.rejectedResponse.trim());
  }

  // 4. L1 output-stage events as uncertainty signal.
  const safetyRows = await db
    .select({
      sessionId: safetyEvents.sessionId,
      decision: safetyEvents.decision,
      severity: safetyEvents.severity,
      reason: safetyEvents.reason,
      createdAt: safetyEvents.createdAt,
      stage: safetyEvents.stage,
    })
    .from(safetyEvents)
    .where(and(
      inArray(safetyEvents.sessionId, touchedSessIds),
      eq(safetyEvents.stage, "output"),
    ))
    .orderBy(desc(safetyEvents.createdAt));
  const safetyBySession = new Map<string, typeof safetyRows>();
  for (const ev of safetyRows) {
    if (!ev.sessionId) continue;
    const arr = safetyBySession.get(ev.sessionId) ?? [];
    arr.push(ev);
    safetyBySession.set(ev.sessionId, arr);
  }

  // 5. Score: uncertainty + client-feedback proxy + topic-coverage penalty + recency.
  type Scored = { item: ReviewItem; score: number };
  const scored: Scored[] = [];
  const seenTopicHashes = new Set<string>();
  function topicKey(scenario: string): string {
    return scenario
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6)
      .join(" ");
  }

  for (const am of agentMsgs) {
    if (!am.sessionId) continue;
    const draftKey = am.content.trim();
    if (labeledDrafts.has(draftKey)) continue;

    const session = bySession.get(am.sessionId) ?? [];
    const idx = session.findIndex((m) => m.id === am.id);
    const prior = idx > 0 ? session.slice(0, idx).reverse().find((m) => m.role === "seeker") : undefined;

    // Client-feedback proxy: terse / "no/that's not" / "I already said" follow-ups.
    const nextSeeker = idx >= 0 ? session.slice(idx + 1).find((m) => m.role === "seeker") : undefined;
    let clientFeedbackScore = 0;
    if (nextSeeker) {
      const t = nextSeeker.content.toLowerCase();
      if (t.length < 20) clientFeedbackScore += 1;
      if (/\b(no|not|wrong|that'?s not|don'?t|doesn'?t|didn'?t)\b/.test(t)) clientFeedbackScore += 2;
      if (/\bi (already|just) said\b/.test(t)) clientFeedbackScore += 2;
    }

    // Uncertainty: closest output safety event within 60s.
    let uncertaintyScore = 0;
    const evs = safetyBySession.get(am.sessionId) ?? [];
    const amTime = am.createdAt ? new Date(am.createdAt).getTime() : 0;
    let bestEv: (typeof safetyRows)[number] | undefined;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const ev of evs) {
      const evTime = ev.createdAt ? new Date(ev.createdAt).getTime() : 0;
      const delta = Math.abs(evTime - amTime);
      if (delta < bestDelta && delta < 60_000) {
        bestDelta = delta;
        bestEv = ev;
      }
    }
    if (bestEv) {
      if (bestEv.decision && bestEv.decision !== "allow") uncertaintyScore += 3;
      if (bestEv.severity && bestEv.severity !== "info") uncertaintyScore += 2;
      const r = bestEv.reason || "";
      if (r.startsWith("moderation_")) uncertaintyScore += 2;
      if (r === "model_improvised_crisis_response" || r === "output_claims_to_be_human_or_licensed") {
        uncertaintyScore += 4;
      }
    }

    // Coverage: penalise repeat topics so the queue spans the conversation.
    const tk = topicKey(prior?.content ?? "");
    const coveragePenalty = tk && seenTopicHashes.has(tk) ? -1 : 0;
    if (tk) seenTopicHashes.add(tk);

    const recencyRank = agentMsgs.indexOf(am);
    const recencyScore = Math.max(0, 1 - recencyRank / overfetch);

    const score =
      uncertaintyScore * 1.5 +
      clientFeedbackScore * 1.0 +
      coveragePenalty * 1.5 +
      recencyScore * 0.5;

    scored.push({
      score,
      item: {
        messageId: am.id,
        sessionId: am.sessionId,
        engagementId: sessionIdToEng.get(am.sessionId) ?? "",
        scenario: prior?.content ?? "",
        draft: am.content,
        createdAt: am.createdAt,
      },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

// Server-side review-queue lookup; derives draft/scenario/session/engagement
// from messageId without trusting client input. Returns null if not an agent message.
export async function getReviewItemForMessage(
  messageId: string,
): Promise<ReviewItem | null> {
  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!msg || msg.role !== "agent" || !msg.sessionId) return null;

  const [sess] = await db
    .select({ id: sessions.id, engagementId: sessions.engagementId })
    .from(sessions)
    .where(eq(sessions.id, msg.sessionId))
    .limit(1);
  if (!sess?.engagementId) return null;

  const sessionMsgsRaw = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, msg.sessionId))
    .orderBy(messages.createdAt);
  // Same redaction scrub as the queue listing — keeps redacted seeker
  // content out of the labeling scenario and out of any downstream
  // persona example written when a coach labels this draft.
  const sessionMsgs = sessionMsgsRaw.map((m) =>
    m.redactedAt ? { ...m, content: "" } : m,
  );
  const idx = sessionMsgs.findIndex((m) => m.id === msg.id);
  const prior = idx > 0
    ? sessionMsgs.slice(0, idx).reverse().find((m) => m.role === "seeker")
    : undefined;

  return {
    messageId: msg.id,
    sessionId: msg.sessionId,
    engagementId: sess.engagementId,
    scenario: prior?.content ?? "",
    draft: msg.content,
    createdAt: msg.createdAt,
  };
}
