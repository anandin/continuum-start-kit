import { logger } from "./logger";
import { storage } from "../storage";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
};

type ExpoPushMessage = PushPayload & {
  to: string;
  channelId?: string;
  priority?: "default" | "normal" | "high";
};

function isExpoToken(t: string): boolean {
  return t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[");
}

/**
 * Send a push notification to all enabled tokens for a user via the Expo
 * push service. Failures are logged but never thrown to the caller — push
 * is best-effort and must not break the request that triggered it.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; skipped: number }> {
  let tokens: { token: string }[] = [];
  try {
    const rows = await storage.getPushTokensByUserId(userId, { onlyEnabled: true });
    tokens = rows.map((r) => ({ token: r.token }));
  } catch (err) {
    logger.warn({ err, userId }, "push: failed to load tokens");
    return { sent: 0, skipped: 0 };
  }

  if (tokens.length === 0) return { sent: 0, skipped: 0 };

  const valid = tokens.filter((t) => isExpoToken(t.token));
  const skipped = tokens.length - valid.length;
  if (valid.length === 0) return { sent: 0, skipped };

  const messages: ExpoPushMessage[] = valid.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: payload.sound === null ? null : "default",
    priority: "high",
    channelId: "default",
    ...(typeof payload.badge === "number" ? { badge: payload.badge } : {}),
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn({ status: res.status, text, userId }, "push: expo non-2xx");
      return { sent: 0, skipped };
    }
    const json = (await res.json()) as {
      data?: Array<{ status: string; message?: string; details?: { error?: string } }>;
    };
    const tickets = Array.isArray(json.data) ? json.data : [];

    // Drop tokens Expo says are no longer valid so we stop wasting calls.
    await Promise.all(
      tickets.map(async (ticket, i) => {
        const tok = valid[i]?.token;
        const errCode = ticket?.details?.error;
        if (
          ticket?.status === "error" &&
          tok &&
          (errCode === "DeviceNotRegistered" || errCode === "InvalidCredentials")
        ) {
          try {
            await storage.deletePushToken(tok, userId);
            logger.info({ tok, errCode }, "push: pruned invalid token");
          } catch (e) {
            logger.warn({ e, tok }, "push: failed to prune invalid token");
          }
        }
      }),
    );

    const sent = tickets.filter((t) => t?.status === "ok").length;
    return { sent, skipped };
  } catch (err) {
    logger.warn({ err, userId }, "push: send failed");
    return { sent: 0, skipped };
  }
}
