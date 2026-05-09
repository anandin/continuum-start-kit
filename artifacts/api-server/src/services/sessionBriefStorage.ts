import { db } from "../db";
import { eq, and, desc, isNull } from "drizzle-orm";
import {
  sessionBriefs,
  type SessionBrief,
  type InsertSessionBrief,
} from "@workspace/db";

export async function createSessionBrief(
  data: InsertSessionBrief,
): Promise<SessionBrief> {
  const [row] = await db.insert(sessionBriefs).values(data).returning();
  return row;
}

export async function getSessionBriefById(
  id: string,
): Promise<SessionBrief | undefined> {
  const [row] = await db
    .select()
    .from(sessionBriefs)
    .where(eq(sessionBriefs.id, id));
  return row;
}

/**
 * Returns the most recent UNUSED brief for the engagement (or undefined).
 *
 * "Latest" deliberately means "latest unused" so the main panel naturally
 * archives a brief once the coach marks it used in session — it disappears
 * from the active view and only the history list still shows it. Without
 * this filter, a stale used brief would keep appearing as if it were the
 * current prep until a new one was generated.
 */
export async function getLatestSessionBriefForEngagement(
  engagementId: string,
): Promise<SessionBrief | undefined> {
  const [row] = await db
    .select()
    .from(sessionBriefs)
    .where(
      and(
        eq(sessionBriefs.engagementId, engagementId),
        isNull(sessionBriefs.usedAt),
      ),
    )
    .orderBy(desc(sessionBriefs.generatedAt))
    .limit(1);
  return row;
}

export async function listSessionBriefsForEngagement(
  engagementId: string,
  limit = 25,
): Promise<SessionBrief[]> {
  return db
    .select()
    .from(sessionBriefs)
    .where(eq(sessionBriefs.engagementId, engagementId))
    .orderBy(desc(sessionBriefs.generatedAt))
    .limit(limit);
}

// Atomic mark-used: only succeeds if the brief is still unused. Prevents
// double-marking races between two coach tabs and avoids overwriting an
// earlier "used" timestamp with a later one.
export async function markSessionBriefUsed(
  id: string,
  opts: { sessionId?: string | null; now?: Date } = {},
): Promise<{ brief: SessionBrief } | { error: "not_found" | "already_used" }> {
  const now = opts.now ?? new Date();
  const [row] = await db
    .update(sessionBriefs)
    .set({
      usedAt: now,
      usedInSessionId: opts.sessionId ?? null,
    })
    .where(and(eq(sessionBriefs.id, id), isNull(sessionBriefs.usedAt)))
    .returning();
  if (row) return { brief: row };
  const [existing] = await db
    .select()
    .from(sessionBriefs)
    .where(eq(sessionBriefs.id, id));
  return { error: existing ? "already_used" : "not_found" };
}
