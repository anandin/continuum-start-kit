import { eq } from "drizzle-orm";
import { userRoles } from "@workspace/db";
import { db } from "../db";
import { logger } from "../lib/logger";
import { generateOrFetchTodaysNudge } from "./nudges";

// Daily nudge runner. Sweeps every eligible seeker and asks
// `generateOrFetchTodaysNudge` to produce + push today's nudge for them.
// All gating (prefs.enabled, local-time window, crisis suppression,
// once-per-(seeker, UTC day) uniqueness) lives inside the generator, so
// this loop is intentionally dumb — it just enumerates seekers and
// short-circuits on each per-user no-op.
//
// Single-process setInterval is fine in dev / single-replica deploys.
// If we ever scale horizontally, swap this for a real scheduler with a
// distributed lock; the per-(seekerUserId, day) unique index on `nudges`
// already protects against double-insert if two replicas race.
async function listSeekerUserIds(): Promise<string[]> {
  const rows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, "seeker"));
  return rows.map((r) => r.userId);
}

export async function runNudgeSweep(): Promise<{ checked: number; sent: number }> {
  const seekers = await listSeekerUserIds();
  let sent = 0;
  for (const userId of seekers) {
    try {
      const result = await generateOrFetchTodaysNudge(userId);
      // The generator returns the existing row if today's was already
      // produced. Count "freshly created today" as those whose sentAt is
      // within the last few minutes.
      if (result?.sentAt) {
        const ageMs = Date.now() - new Date(result.sentAt).getTime();
        if (ageMs < 5 * 60_000) sent += 1;
      }
    } catch (err) {
      logger.warn({ err, userId }, "nudgeCron: per-seeker generation failed");
    }
  }
  return { checked: seekers.length, sent };
}

let nudgeTimer: ReturnType<typeof setInterval> | null = null;

// Run every 10 minutes by default. Granularity matches the smallest
// useful local-time window resolution (we gate on hour-of-day, so any
// interval ≤ 60min lands inside the window at least once).
export function startNudgeCron(intervalMs = 10 * 60_000): void {
  if (nudgeTimer) return;
  // Fire once on boot so a freshly-deployed server doesn't wait a full
  // interval before producing the first wave of nudges.
  void runNudgeSweep().catch((err) =>
    logger.warn({ err }, "nudgeCron: initial sweep failed"),
  );
  nudgeTimer = setInterval(() => {
    void runNudgeSweep().catch((err) =>
      logger.warn({ err }, "nudgeCron: scheduled sweep failed"),
    );
  }, intervalMs);
  logger.info({ intervalMs }, "nudgeCron: started");
}

export function stopNudgeCron(): void {
  if (nudgeTimer) {
    clearInterval(nudgeTimer);
    nudgeTimer = null;
  }
}
