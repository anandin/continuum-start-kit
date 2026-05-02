import { db } from "../db";
import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import {
  safetyEvents,
  agentVersions,
  personaExamples,
  calibrationSessions,
  clientMemory,
  engagements,
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
export async function topPersonaExamples(
  providerId: string,
  query: string,
  queryEmbedding: number[] | null,
  k = 4,
): Promise<PersonaExample[]> {
  if (queryEmbedding) {
    const literal = `[${queryEmbedding.join(",")}]`;
    const rows = await db.execute(sql`
      SELECT * FROM ${personaExamples}
      WHERE ${personaExamples.providerId} = ${providerId}
        AND ${personaExamples.isActive} = true
        AND ${personaExamples.embedding} IS NOT NULL
      ORDER BY ${personaExamples.embedding} <=> ${literal}::vector
      LIMIT ${k}
    `);
    return (rows.rows as PersonaExample[]) ?? [];
  }
  const all = await listPersonaExamplesByProvider(providerId);
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

export async function topClientMemory(
  engagementId: string,
  query: string,
  queryEmbedding: number[] | null,
  k = 6,
): Promise<ClientMemory[]> {
  if (queryEmbedding) {
    const literal = `[${queryEmbedding.join(",")}]`;
    const rows = await db.execute(sql`
      SELECT * FROM ${clientMemory}
      WHERE ${clientMemory.engagementId} = ${engagementId}
        AND ${clientMemory.redactedAt} IS NULL
        AND ${clientMemory.embedding} IS NOT NULL
      ORDER BY ${clientMemory.embedding} <=> ${literal}::vector
      LIMIT ${k}
    `);
    return (rows.rows as ClientMemory[]) ?? [];
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

// Edit a memory entry's content/tags/importance/kind. Used by the Memory
// Inspector. Embedding is recomputed by the caller when content changes.
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
// Sample recent assistant messages from this provider's engagements that the
// therapist hasn't already labelled (no persona_example with the same scenario).
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
  // 1. Find this provider's engagements
  const engs = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(eq(engagements.providerId, providerId));
  if (engs.length === 0) return [];
  const engIds = engs.map((e) => e.id);

  // 2. Find sessions for those engagements
  const sess = await db
    .select({ id: sessions.id, engagementId: sessions.engagementId })
    .from(sessions)
    .where(inArray(sessions.engagementId, engIds));
  if (sess.length === 0) return [];
  const sessionIdToEng = new Map(sess.map((s) => [s.id, s.engagementId ?? ""]));
  const sessIds = sess.map((s) => s.id);

  // 3. Pull recent agent messages
  const agentMsgs = await db
    .select()
    .from(messages)
    .where(and(inArray(messages.sessionId, sessIds), eq(messages.role, "agent")))
    .orderBy(desc(messages.createdAt))
    .limit(limit * 3); // overfetch so we can pair with prior user msg

  if (agentMsgs.length === 0) return [];

  // 4. For each, fetch the immediately-prior user message in the same session
  //    (cheap: one batched query per session is overkill — just walk recent).
  const allMsgs: Message[] = await db
    .select()
    .from(messages)
    .where(inArray(messages.sessionId, agentMsgs.map((m) => m.sessionId).filter((s): s is string => !!s)))
    .orderBy(messages.createdAt);

  const bySession = new Map<string, Message[]>();
  for (const m of allMsgs) {
    if (!m.sessionId) continue;
    const arr = bySession.get(m.sessionId) ?? [];
    arr.push(m);
    bySession.set(m.sessionId, arr);
  }

  const items: ReviewItem[] = [];
  for (const am of agentMsgs) {
    if (!am.sessionId) continue;
    const session = bySession.get(am.sessionId) ?? [];
    const idx = session.findIndex((m) => m.id === am.id);
    const prior = idx > 0 ? session.slice(0, idx).reverse().find((m) => m.role === "seeker") : undefined;
    items.push({
      messageId: am.id,
      sessionId: am.sessionId,
      engagementId: sessionIdToEng.get(am.sessionId) ?? "",
      scenario: prior?.content ?? "",
      draft: am.content,
      createdAt: am.createdAt,
    });
    if (items.length >= limit) break;
  }
  return items;
}

// Server-side lookup for the review-queue label endpoint. Loads a single
// agent message + its prior user message + the engagement so the route can
// derive draft/scenario/sessionId/engagementId WITHOUT trusting client input.
// Returns null if the message doesn't exist or isn't an agent message.
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

  // Find the immediately-prior seeker message in this session for context.
  const sessionMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, msg.sessionId))
    .orderBy(messages.createdAt);
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
