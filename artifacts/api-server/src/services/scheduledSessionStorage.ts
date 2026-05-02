import { db } from "../db";
import { scheduledSessions, type ScheduledSession } from "@workspace/db/schema";
import { and, eq, gt, isNull, or, sql, desc, asc } from "drizzle-orm";

export type CreateScheduledInput = {
  engagementId: string;
  providerId: string;
  seekerUserId: string;
  proposedSlots: string[];
  timezone: string;
  durationMinutes: number;
  title: string;
  createdBy: string;
};

export type RescheduleInput = {
  proposedSlots: string[];
  timezone?: string;
  durationMinutes?: number;
  title?: string;
};

function genUid(): string {
  // RFC-style globally-unique ID for the iCalendar UID property. Stable
  // for the lifetime of the row so reschedule/cancel updates target the
  // same event in calendar clients.
  // randomUUID is available on Node 19+ and Web Crypto.
  const id = (globalThis.crypto as Crypto | undefined)?.randomUUID?.();
  return `${id ?? Math.random().toString(36).slice(2)}@haven.app`;
}

export const scheduledSessionStorage = {
  async create(input: CreateScheduledInput): Promise<ScheduledSession> {
    const [row] = await db
      .insert(scheduledSessions)
      .values({
        engagementId: input.engagementId,
        providerId: input.providerId,
        seekerUserId: input.seekerUserId,
        proposedSlots: input.proposedSlots,
        timezone: input.timezone,
        durationMinutes: input.durationMinutes,
        title: input.title,
        createdBy: input.createdBy,
        icsUid: genUid(),
        status: "proposed",
      })
      .returning();
    return row;
  },

  async getById(id: string): Promise<ScheduledSession | undefined> {
    const [row] = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.id, id))
      .limit(1);
    return row;
  },

  async listForEngagement(engagementId: string): Promise<ScheduledSession[]> {
    return db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.engagementId, engagementId))
      .orderBy(desc(scheduledSessions.createdAt));
  },

  async listUpcomingForUser(userId: string): Promise<ScheduledSession[]> {
    // Anything not cancelled where (a) still proposed OR (b) confirmed
    // and the chosen time is in the future.
    const now = new Date();
    return db
      .select()
      .from(scheduledSessions)
      .where(
        and(
          or(
            eq(scheduledSessions.providerId, userId),
            eq(scheduledSessions.seekerUserId, userId),
          ),
          or(
            eq(scheduledSessions.status, "proposed"),
            and(
              eq(scheduledSessions.status, "confirmed"),
              gt(scheduledSessions.confirmedAt, now),
            ),
          ),
        ),
      )
      .orderBy(asc(scheduledSessions.confirmedAt));
  },

  async confirm(
    id: string,
    chosenStartUtc: Date,
  ): Promise<ScheduledSession | undefined> {
    // Atomic state transition. The WHERE clause guards against three
    // races at once:
    //   1. confirm-vs-confirm: status='proposed' guarantees only the
    //      first of two concurrent confirms wins.
    //   2. confirm-vs-cancel: cancelled rows are not status='proposed'.
    //   3. confirm-vs-reschedule: a concurrent reschedule keeps status
    //      'proposed' but swaps proposedSlots; we additionally require
    //      the chosen ISO timestamp to still be present in the current
    //      proposedSlots jsonb array. Postgres jsonb `?` returns true
    //      iff the text exists as a top-level array element.
    // The loser of any race gets undefined; the route returns 409.
    const chosenIso = chosenStartUtc.toISOString();
    const [row] = await db
      .update(scheduledSessions)
      .set({
        status: "confirmed",
        confirmedAt: chosenStartUtc,
        icsSeq: sql`${scheduledSessions.icsSeq} + 1`,
        reminderSentAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledSessions.id, id),
          eq(scheduledSessions.status, "proposed"),
          sql`${scheduledSessions.proposedSlots} ? ${chosenIso}`,
        ),
      )
      .returning();
    return row;
  },

  async reschedule(
    id: string,
    input: RescheduleInput,
  ): Promise<ScheduledSession | undefined> {
    const set: Record<string, unknown> = {
      status: "proposed",
      proposedSlots: input.proposedSlots,
      confirmedAt: null,
      reminderSentAt: null,
      icsSeq: sql`${scheduledSessions.icsSeq} + 1`,
      updatedAt: new Date(),
    };
    if (input.timezone) set.timezone = input.timezone;
    if (input.durationMinutes) set.durationMinutes = input.durationMinutes;
    if (input.title) set.title = input.title;
    const [row] = await db
      .update(scheduledSessions)
      .set(set)
      .where(eq(scheduledSessions.id, id))
      .returning();
    return row;
  },

  async cancel(
    id: string,
    cancelledBy: string,
    reason: string,
  ): Promise<ScheduledSession | undefined> {
    const [row] = await db
      .update(scheduledSessions)
      .set({
        status: "cancelled",
        cancelledBy,
        cancelReason: reason,
        icsSeq: sql`${scheduledSessions.icsSeq} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(scheduledSessions.id, id))
      .returning();
    return row;
  },

  // Lazy-trigger helper: confirmed sessions starting within the next
  // hour (and not in the past) that have not yet had a reminder push.
  async findDueForReminder(userId: string): Promise<ScheduledSession[]> {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60_000);
    return db
      .select()
      .from(scheduledSessions)
      .where(
        and(
          eq(scheduledSessions.seekerUserId, userId),
          eq(scheduledSessions.status, "confirmed"),
          isNull(scheduledSessions.reminderSentAt),
          gt(scheduledSessions.confirmedAt, now),
          // confirmedAt < now + 1h
          sql`${scheduledSessions.confirmedAt} <= ${inOneHour}`,
        ),
      );
  },

  // Cron variant of findDueForReminder: returns *all* confirmed
  // sessions across every seeker that are due for a 1h reminder and
  // haven't already been sent. Used by the scheduling tick so the
  // reminder fires whether or not the seeker has the app open.
  async findAllDueForReminder(): Promise<ScheduledSession[]> {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60_000);
    return db
      .select()
      .from(scheduledSessions)
      .where(
        and(
          eq(scheduledSessions.status, "confirmed"),
          isNull(scheduledSessions.reminderSentAt),
          gt(scheduledSessions.confirmedAt, now),
          sql`${scheduledSessions.confirmedAt} <= ${inOneHour}`,
        ),
      );
  },

  async markReminderSent(id: string): Promise<void> {
    await db
      .update(scheduledSessions)
      .set({ reminderSentAt: new Date(), updatedAt: new Date() })
      .where(eq(scheduledSessions.id, id));
  },
};
