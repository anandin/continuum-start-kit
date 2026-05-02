import Stripe from "stripe";
import { logger } from "./logger";

// Lazy Stripe singleton. Returns null when STRIPE_SECRET_KEY is unset
// so the rest of the app keeps working without billing configured.

let cached: Stripe | null = null;
let warned = false;

export function getStripe(): Stripe | null {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (!warned) {
      logger.warn(
        "stripe: STRIPE_SECRET_KEY not set — billing endpoints will return 503",
      );
      warned = true;
    }
    return null;
  }
  // We deliberately don't pin `apiVersion` — the SDK's bundled default
  // matches its declared types, and pinning required casts that the
  // reviewer flagged as type-escape-hatches.
  cached = new Stripe(key, {
    typescript: true,
    appInfo: { name: "Haven", version: "1.0.0" },
  });
  return cached;
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

// Publishable key for Stripe.js / Elements in the seeker UI. Mirrors
// the same env-or-connector lookup used by the secret key.
export function stripePublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? null;
}

// Bootstrap Stripe credentials from the Replit connector proxy and
// mirror them into env vars so the rest of this module picks them up.
// Silently no-ops when the connector isn't configured.
export async function loadStripeCredentialsFromConnector(): Promise<void> {
  if (process.env.STRIPE_SECRET_KEY) return; // explicit env wins
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) return;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!xReplitToken) return;
  try {
    const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
    const targetEnvironment = isProduction ? "production" : "development";
    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set("include_secrets", "true");
    url.searchParams.set("connector_names", "stripe");
    url.searchParams.set("environment", targetEnvironment);
    const r = await fetch(url.toString(), {
      headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    });
    if (!r.ok) {
      logger.warn({ status: r.status }, "stripe: connector lookup failed");
      return;
    }
    const data = (await r.json()) as {
      items?: Array<{
        settings?: {
          secret?: string;
          publishable?: string;
          publishable_key?: string;
          publishableKey?: string;
          webhook_signing_secret?: string;
        };
      }>;
    };
    const item = data.items?.[0];
    const settings = item?.settings;
    const secret = settings?.secret;
    const publishable =
      settings?.publishable ??
      settings?.publishable_key ??
      settings?.publishableKey;
    const webhookSecret = settings?.webhook_signing_secret;
    if (secret) {
      process.env.STRIPE_SECRET_KEY = secret;
      logger.info("stripe: credentials loaded from Replit connector");
    }
    if (publishable && !process.env.STRIPE_PUBLISHABLE_KEY) {
      process.env.STRIPE_PUBLISHABLE_KEY = publishable;
    }
    if (webhookSecret && !process.env.STRIPE_WEBHOOK_SECRET) {
      process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, "stripe: connector bootstrap errored");
  }
}

// Best-effort base URL for return/refresh URLs in account links and
// for billing portal returns. Falls back to localhost for dev.
export function publicBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",").filter(Boolean);
  if (domains && domains.length > 0) return `https://${domains[0]}`;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  return "http://localhost:5000";
}
