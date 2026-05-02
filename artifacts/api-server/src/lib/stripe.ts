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

// Best-effort base URL for return/refresh URLs in account links and
// for billing portal returns. Falls back to localhost for dev.
export function publicBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",").filter(Boolean);
  if (domains && domains.length > 0) return `https://${domains[0]}`;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  return "http://localhost:5000";
}
