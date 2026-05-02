import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

export type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  method?: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: "not_configured" | "send_failed"; error?: string };

let cachedTransport: Transporter | null = null;
let cachedFrom: string | null = null;
let warnedMissing = false;

function getTransport(): { transport: Transporter; from: string } | null {
  if (cachedTransport && cachedFrom) {
    return { transport: cachedTransport, from: cachedFrom };
  }
  const url = process.env.SMTP_URL;
  if (!url) {
    if (!warnedMissing) {
      logger.warn(
        "email: SMTP_URL not set — calendar invites will be no-ops (set SMTP_URL=smtps://user:pass@host:port to enable)",
      );
      warnedMissing = true;
    }
    return null;
  }
  try {
    cachedTransport = nodemailer.createTransport(url);
  } catch (err) {
    logger.warn({ err }, "email: failed to construct SMTP transport");
    return null;
  }
  cachedFrom =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    "Haven <no-reply@haven.app>";
  return { transport: cachedTransport, from: cachedFrom };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const t = getTransport();
  if (!t) return { ok: false, reason: "not_configured" };
  const { to, subject, text, html, attachments } = input;
  try {
    const info = await t.transport.sendMail({
      from: t.from,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text,
      html,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        ...(a.method
          ? { contentType: `${a.contentType ?? "text/calendar"}; method=${a.method}` }
          : {}),
      })),
    });
    return { ok: true, messageId: info.messageId };
  } catch (err: any) {
    logger.warn({ err: err?.message ?? String(err) }, "email: send failed");
    return { ok: false, reason: "send_failed", error: String(err?.message ?? err) };
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.SMTP_URL;
}
