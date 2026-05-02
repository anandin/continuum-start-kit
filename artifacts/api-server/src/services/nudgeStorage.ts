import { db } from "../db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  nudges,
  safetyEvents,
  type InsertNudge,
  type Nudge,
  type SafetyEvent,
} from "@workspace/db";

// ============ Nudges (daily inter-session AI micro-nudges) ============

export async function createNudge(data: InsertNudge): Promise<Nudge> {
  const [row] = await db.insert(nudges).values(data).returning();
  return row;
}

/**
 * Insert-or-fetch helper for the lazy daily generator. The unique index on
 * (seekerUserId, day) means two concurrent GETs would otherwise crash one
 * request with a unique-violation 500. Catch error code 23505 and return
 * the existing row instead.
 */
export async function createOrGetTodaysNudge(
  data: InsertNudge,
  todayYmd: string,
): Promise<Nudge> {
  try {
    const [row] = await db.insert(nudges).values(data).returning();
    return row;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      const existing = await getTodaysNudgeForSeeker(data.seekerUserId, todayYmd);
      if (existing) return existing;
    }
    throw err;
  }
}

/**
 * Returns today's nudge for a seeker, if one exists. "Today" is computed in
 * UTC to match how `day` is stored (date column).
 */
export async function getTodaysNudgeForSeeker(
  seekerUserId: string,
  todayYmd: string,
): Promise<Nudge | undefined> {
  const [row] = await db
    .select()
    .from(nudges)
    .where(and(eq(nudges.seekerUserId, seekerUserId), eq(nudges.day, todayYmd)))
    .orderBy(desc(nudges.createdAt))
    .limit(1);
  return row;
}

export async function getNudgeById(id: string): Promise<Nudge | undefined> {
  const [row] = await db.select().from(nudges).where(eq(nudges.id, id)).limit(1);
  return row;
}

export async function listRecentNudgesForSeeker(
  seekerUserId: string,
  limit = 14,
): Promise<Nudge[]> {
  return db
    .select()
    .from(nudges)
    .where(eq(nudges.seekerUserId, seekerUserId))
    .orderBy(desc(nudges.createdAt))
    .limit(limit);
}

export async function markNudgeSent(id: string): Promise<Nudge | undefined> {
  const [row] = await db
    .update(nudges)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(nudges.id, id))
    .returning();
  return row;
}

export async function respondToNudge(
  id: string,
  action: "done" | "skip" | "snooze",
): Promise<Nudge | undefined> {
  const now = new Date();
  const patch: Partial<{ status: string; respondedAt: Date; snoozeUntil: Date }> = {
    respondedAt: now,
  };
  if (action === "done") {
    patch.status = "done";
  } else if (action === "skip") {
    patch.status = "skipped";
  } else {
    patch.status = "snoozed";
    // Snooze until tomorrow (24h forward).
    patch.snoozeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  const [row] = await db
    .update(nudges)
    .set(patch)
    .where(eq(nudges.id, id))
    .returning();
  return row;
}

/**
 * Crisis suppression check. Returns true if the user has any high or critical
 * severity safety_event in the last 24 hours, in which case a daily nudge
 * should be skipped — we don't push small "try this" prompts in a crisis.
 */
export async function hasRecentHighSeveritySafetyEvent(
  userId: string,
  withinMs = 24 * 60 * 60 * 1000,
): Promise<boolean> {
  const since = new Date(Date.now() - withinMs);
  const rows: Pick<SafetyEvent, "id">[] = await db
    .select({ id: safetyEvents.id })
    .from(safetyEvents)
    .where(
      and(
        eq(safetyEvents.userId, userId),
        gte(safetyEvents.createdAt, since),
        inArray(safetyEvents.severity, ["high", "critical"] as const),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
