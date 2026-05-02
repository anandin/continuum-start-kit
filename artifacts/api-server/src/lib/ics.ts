// Minimal RFC-5545 iCalendar builder for therapy session invites.
// We hand-roll the VCALENDAR text rather than pull a heavyweight dep
// because we only emit a single VEVENT per file with METHOD REQUEST
// (new / updated invite) or CANCEL. Most calendar clients (Apple,
// Google, Outlook) accept this minimal envelope as long as we keep the
// UID stable and bump SEQUENCE on changes.

export type IcsMethod = "REQUEST" | "CANCEL";
export type IcsStatus = "CONFIRMED" | "CANCELLED";

export type IcsAttendee = {
  email: string;
  name?: string;
  rsvp?: boolean;
};

export type IcsEventInput = {
  uid: string;
  sequence: number;
  method: IcsMethod;
  status: IcsStatus;
  startUtc: Date;
  durationMinutes: number;
  summary: string;
  description?: string;
  organizer: { email: string; name?: string };
  attendees: IcsAttendee[];
  // IANA tz used only as informational X-WR-TIMEZONE; the DTSTART/DTEND
  // are still emitted as floating-zone-stripped UTC ("Z") so any client
  // can render them in its local zone.
  timezone?: string;
  url?: string;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// RFC-5545 form: 20240131T140000Z
function fmtUtc(d: Date): string {
  return (
    String(d.getUTCFullYear()) +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

// Escape commas, semicolons, backslashes, and newlines per RFC-5545 §3.3.11.
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Fold lines longer than 75 octets per RFC-5545 §3.1 (line folding).
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (i === 0) {
      out.push(line.slice(0, 75));
      i = 75;
    } else {
      out.push(" " + line.slice(i, i + 74));
      i += 74;
    }
  }
  return out.join("\r\n");
}

export function buildIcs(ev: IcsEventInput): string {
  const dtStart = fmtUtc(ev.startUtc);
  const dtEnd = fmtUtc(
    new Date(ev.startUtc.getTime() + ev.durationMinutes * 60_000),
  );
  const dtStamp = fmtUtc(new Date());
  const orgName = ev.organizer.name ? escapeText(ev.organizer.name) : "";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Haven//Scheduling//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${ev.method}`,
  ];
  if (ev.timezone) lines.push(`X-WR-TIMEZONE:${ev.timezone}`);
  lines.push(
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `SEQUENCE:${ev.sequence}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText(ev.summary)}`,
  );
  if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
  if (ev.url) lines.push(`URL:${ev.url}`);
  lines.push(`STATUS:${ev.status}`);
  lines.push(
    `ORGANIZER;CN=${orgName || ev.organizer.email}:mailto:${ev.organizer.email}`,
  );
  for (const a of ev.attendees) {
    const partStat = ev.status === "CANCELLED" ? "DECLINED" : "NEEDS-ACTION";
    const cn = a.name ? escapeText(a.name) : a.email;
    lines.push(
      `ATTENDEE;CN=${cn};RSVP=${a.rsvp ? "TRUE" : "FALSE"};PARTSTAT=${partStat}:mailto:${a.email}`,
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
