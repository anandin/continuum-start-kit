import Stripe from "stripe";
import { logger } from "./logger";

// Lazy singleton. The platform Stripe account is the parent — coaches
// onboard as Stripe Connect Express *connected* accounts under it. All
// per-session charges and subscriptions use destination charges with
// `transfer_data.destination = <coach connected account id>` so the
// coach is paid out and the platform keeps zero application_fee for
// v1 (configurable later via STRIPE_PLATFORM_FEE_BPS).
//
// When STRIPE_SECRET_KEY is missing, getStripe() returns null and every
// caller short-circuits gracefully (UI surfaces a "Billing not yet
// configured" state). This keeps the rest of the app — chat, sessions,
// scheduling — fully functional in environments without billing keys.

let cached: Stripe | null = null;
let warned = false;

export function getStripe(): Stripe | null {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (!warned) {
      logger.warn(
        "stripe: STRIPE_SECRET_KEY not set — billing endpoints will return 503 (set the secret to enable Stripe Connect billing)",
      );
      warned = true;
    }
    return null;
  }
  cached = new Stripe(key, {
    // Pin a recent stable API version so behaviour doesn't drift if the
    // SDK default changes between deploys.
    // Pin via cast — `LatestApiVersion` was removed from the type
    // exports in stripe-node v18+, but a string literal still works at
    // runtime. Bump as needed when Stripe publishes new API versions.
    apiVersion: "2024-11-20.acacia" as never,
    typescript: true,
    appInfo: {
      name: "Haven",
      version: "1.0.0",
    },
  });
  return cached;
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

// Bootstrap Stripe credentials from the Replit connector proxy. The
// connector returns publishable + secret for the active environment
// (development vs production). We mirror the secret into
// `process.env.STRIPE_SECRET_KEY` so the rest of this module — which
// already reads from env — picks it up without any other refactor.
//
// Called once from `index.ts` before the app boots. If the connector
// isn't configured (running locally without Replit, or before the user
// has connected Stripe) this resolves silently and getStripe() keeps
// returning null — every billing endpoint stays a graceful no-op.
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
    const data = (await r.json()) as { items?: Array<{ settings?: { secret?: string; publishable?: string } }> };
    const item = data.items?.[0];
    const secret = item?.settings?.secret;
    if (secret) {
      process.env.STRIPE_SECRET_KEY = secret;
      logger.info("stripe: credentials loaded from Replit connector");
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
