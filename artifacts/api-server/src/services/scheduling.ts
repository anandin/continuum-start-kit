import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";
import { buildIcs, type IcsEventInput } from "../lib/ics";
import { sendPushToUser } from "../lib/push";
import { storage } from "../storage";
import { scheduledSessionStorage } from "./scheduledSessionStorage";
import type { ScheduledSession } from "@workspace/db/schema";

const COACH_LABEL = "Your coach";
const SEEKER_LABEL = "Your client";

function isValidIanaZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(tz: string | null | undefined, fallback = "UTC"): string {
  if (!tz || typeof tz !== "string") return fallback;
  return isValidIanaZone(tz) ? tz : fallback;
}

function fmtForZone(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function safeName(email: string | null | undefined, fallback: string): string {
  if (!email) return fallback;
  const local = email.split("@")[0];
  if (!local) return fallback;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

type Recipients = {
  providerEmail: string | null;
  providerName: string;
  providerTz: string;
  seekerEmail: string | null;
  seekerName: string;
  seekerTz: string;
  organizerEmail: string;
};

async function loadRecipients(row: ScheduledSession): Promise<Recipients> {
  const provider = await storage.getUserById(row.providerId);
  const seeker = await storage.getUserById(row.seekerUserId);
  const providerName = safeName(provider?.email, COACH_LABEL);
  const seekerName = safeName(seeker?.email, SEEKER_LABEL);
  // Per-recipient zone: prefer the user's stored IANA tz, fall back to
  // the row's snapshot (set at proposal time) and finally UTC. This
  // ensures each side sees the start time in *their own* local zone.
  const providerTz = normalizeTimezone(provider?.timezone, row.timezone || "UTC");
  const seekerTz = normalizeTimezone(seeker?.timezone, row.timezone || "UTC");
  return {
    providerEmail: provider?.email ?? null,
    providerName,
    providerTz,
    seekerEmail: seeker?.email ?? null,
    seekerName,
    seekerTz,
    organizerEmail: provider?.email ?? `coach+${row.providerId}@haven.app`,
  };
}

function buildEvent(
  row: ScheduledSession,
  startUtc: Date,
  method: "REQUEST" | "CANCEL",
  recipients: Recipients,
  description: string,
): IcsEventInput {
  return {
    uid: row.icsUid,
    sequence: row.icsSeq,
    method,
    status: method === "CANCEL" ? "CANCELLED" : "CONFIRMED",
    startUtc,
    durationMinutes: row.durationMinutes,
    summary: row.title,
    description,
    organizer: { email: recipients.organizerEmail, name: recipients.providerName },
    attendees: [
      ...(recipients.seekerEmail
        ? [{ email: recipients.seekerEmail, name: recipients.seekerName, rsvp: true }]
        : []),
      ...(recipients.providerEmail
        ? [{ email: recipients.providerEmail, name: recipients.providerName, rsvp: false }]
        : []),
    ],
    timezone: row.timezone,
  };
}

// Send a single invite email to one recipient, rendering subject/body
// in *their* timezone. The .ics body itself is timezone-neutral (UTC
// "Z") so the calendar client localizes it correctly on its own.
async function sendInviteToOne(
  row: ScheduledSession,
  startUtc: Date,
  method: "REQUEST" | "CANCEL",
  recipients: Recipients,
  recipientEmail: string,
  recipientTz: string,
  kind: "confirm" | "reschedule" | "cancel",
  reason?: string,
): Promise<void> {
  const when = fmtForZone(startUtc, recipientTz);
  let subject: string;
  let body: string;
  if (kind === "cancel") {
    subject = `Cancelled: ${row.title} on ${when}`;
    body = `Your session "${row.title}" on ${when} has been cancelled.${
      reason ? `\n\nReason: ${reason}` : ""
    }\n\nIf you'd like to reschedule, head back to Haven.`;
  } else if (kind === "reschedule") {
    subject = `Rescheduled: ${row.title} — pick a new time`;
    body = `Your previously confirmed session "${row.title}" on ${when} has been rescheduled.\n\nThe old calendar event is being withdrawn. Open Haven to choose one of the new proposed times.`;
  } else {
    subject = `Confirmed: ${row.title} on ${when}`;
    body = `Your session "${row.title}" is confirmed for ${when}.\n\nThe invite is attached — open it to add the event to your calendar.`;
  }

  const event = buildEvent(row, startUtc, method, recipients, body);
  const ics = buildIcs(event);
  const result = await sendEmail({
    to: [recipientEmail],
    subject,
    text: body,
    attachments: [
      {
        filename: "invite.ics",
        content: ics,
        contentType: "text/calendar; charset=utf-8",
        method,
      },
    ],
  });
  if (!result.ok) {
    logger.warn(
      { reason: result.reason, scheduledSessionId: row.id },
      "scheduling: invite email did not send",
    );
  }
}

async function dispatchInvite(
  row: ScheduledSession,
  startUtc: Date,
  kind: "confirm" | "reschedule" | "cancel",
  reason?: string,
): Promise<void> {
  const recipients = await loadRecipients(row);
  if (!recipients.providerEmail && !recipients.seekerEmail) {
    logger.warn(
      { scheduledSessionId: row.id },
      "scheduling: no recipient emails on file, skipping invite dispatch",
    );
    return;
  }

  // confirm => REQUEST (new event), reschedule and cancel => CANCEL
  // (withdraw the prior confirmed event). A reschedule is followed
  // later by a fresh confirmSlot once the seeker picks a new time,
  // which sends a new REQUEST.
  const method: "REQUEST" | "CANCEL" = kind === "confirm" ? "REQUEST" : "CANCEL";

  if (recipients.seekerEmail) {
    await sendInviteToOne(
      row,
      startUtc,
      method,
      recipients,
      recipients.seekerEmail,
      recipients.seekerTz,
      kind,
      reason,
    );
  }
  if (recipients.providerEmail) {
    await sendInviteToOne(
      row,
      startUtc,
      method,
      recipients,
      recipients.providerEmail,
      recipients.providerTz,
      kind,
      reason,
    );
  }
}

export type ProposeSlotsInput = {
  engagementId: string;
  providerId: string;
  seekerUserId: string;
  proposedSlots: string[]; // ISO UTC strings
  timezone: string;
  durationMinutes?: number;
  title?: string;
  createdBy: string;
};

export async function proposeSlots(input: ProposeSlotsInput): Promise<ScheduledSession> {
  return scheduledSessionStorage.create({
    engagementId: input.engagementId,
    providerId: input.providerId,
    seekerUserId: input.seekerUserId,
    proposedSlots: input.proposedSlots,
    timezone: normalizeTimezone(input.timezone),
    durationMinutes: input.durationMinutes ?? 50,
    title: input.title?.trim() || "Therapy session",
    createdBy: input.createdBy,
  });
}

export async function confirmSlot(
  id: string,
  chosenStartUtc: Date,
): Promise<ScheduledSession | undefined> {
  const updated = await scheduledSessionStorage.confirm(id, chosenStartUtc);
  if (updated) {
    void dispatchInvite(updated, chosenStartUtc, "confirm").catch((err) =>
      logger.warn({ err }, "scheduling: confirm invite dispatch failed"),
    );
  }
  return updated;
}

export type RescheduleArgs = {
  proposedSlots: string[];
  timezone?: string;
  durationMinutes?: number;
  title?: string;
};

export async function rescheduleSession(
  id: string,
  args: RescheduleArgs,
): Promise<ScheduledSession | undefined> {
  const previous = await scheduledSessionStorage.getById(id);
  const updated = await scheduledSessionStorage.reschedule(id, {
    proposedSlots: args.proposedSlots,
    timezone: args.timezone ? normalizeTimezone(args.timezone) : undefined,
    durationMinutes: args.durationMinutes,
    title: args.title?.trim() || undefined,
  });
  // If there was a previously confirmed time, send a CANCEL for that one
  // so the calendar event disappears; the seeker will pick a new slot
  // which triggers a fresh REQUEST on confirm.
  if (updated && previous?.status === "confirmed" && previous.confirmedAt) {
    void dispatchInvite(
      { ...updated, icsSeq: updated.icsSeq },
      previous.confirmedAt,
      "reschedule",
    ).catch((err) =>
      logger.warn({ err }, "scheduling: reschedule cancel dispatch failed"),
    );
  }
  return updated;
}

export async function cancelSession(
  id: string,
  cancelledBy: string,
  reason: string,
): Promise<ScheduledSession | undefined> {
  const previous = await scheduledSessionStorage.getById(id);
  const updated = await scheduledSessionStorage.cancel(id, cancelledBy, reason);
  if (updated && previous?.status === "confirmed" && previous.confirmedAt) {
    void dispatchInvite(updated, previous.confirmedAt, "cancel", reason).catch(
      (err) => logger.warn({ err }, "scheduling: cancel dispatch failed"),
    );
  }
  return updated;
}

// Best-effort 1-hour-before push reminder fired lazily when the seeker
// fetches their upcoming sessions. We don't run a cron — by piggybacking
// on a request the seeker is already making (mobile home screen poll,
// web banner refresh) we get within-minutes accuracy without infra.
export async function maybeFireReminderForSeeker(seekerUserId: string): Promise<number> {
  let fired = 0;
  try {
    const due = await scheduledSessionStorage.findDueForReminder(seekerUserId);
    for (const row of due) {
      if (!row.confirmedAt) continue;
      const minutes = Math.max(
        1,
        Math.round((row.confirmedAt.getTime() - Date.now()) / 60_000),
      );
      try {
        await sendPushToUser(seekerUserId, {
          title: "Your session starts soon",
          body: `${row.title} in ${minutes} minute${minutes === 1 ? "" : "s"}`,
          data: { kind: "scheduled_session_reminder", scheduledSessionId: row.id },
        });
      } catch (err) {
        logger.warn({ err }, "scheduling: reminder push failed");
      }
      await scheduledSessionStorage.markReminderSent(row.id);
      fired += 1;
    }
  } catch (err) {
    logger.warn({ err }, "scheduling: reminder check failed");
  }
  return fired;
}
