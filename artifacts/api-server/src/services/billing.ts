import type Stripe from "stripe";
import { logger } from "../lib/logger";
import { getStripe, publicBaseUrl } from "../lib/stripe";
import { storage } from "../storage";
import { billingStorage } from "./billingStorage";
import type { PriceTier, EngagementBilling } from "@workspace/db/schema";

// High-level billing operations. Routes call into here so the Stripe
// SDK is only touched in one place.

export type BillingError =
  | { kind: "not_configured" }
  | { kind: "no_connected_account" }
  | { kind: "account_incomplete" }
  | { kind: "no_tier_selected" }
  | { kind: "tier_not_found" }
  | { kind: "stripe_error"; message: string };

export type ChargeOutcome =
  | { ok: true; paymentIntentId: string; amountCents: number }
  | { ok: false; error: BillingError };

// Either return the existing connected account, or create a fresh one.
// We never store sensitive Stripe data — just the account id.
export async function ensureConnectedAccount(providerId: string): Promise<
  | { ok: true; accountId: string }
  | { ok: false; error: BillingError }
> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: { kind: "not_configured" } };
  const existing = await billingStorage.getProviderBilling(providerId);
  if (existing?.stripeAccountId) {
    return { ok: true, accountId: existing.stripeAccountId };
  }
  const user = await storage.getUserById(providerId);
  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user?.email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: { haven_provider_id: providerId },
    });
    await billingStorage.upsertProviderBilling({
      providerId,
      stripeAccountId: account.id,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });
    return { ok: true, accountId: account.id };
  } catch (err: any) {
    logger.warn({ err: err?.message }, "billing: failed to create connected account");
    return { ok: false, error: { kind: "stripe_error", message: err?.message ?? String(err) } };
  }
}

export async function createOnboardingLink(providerId: string): Promise<
  | { ok: true; url: string }
  | { ok: false; error: BillingError }
> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: { kind: "not_configured" } };
  const ensured = await ensureConnectedAccount(providerId);
  if (!ensured.ok) return ensured;
  const base = publicBaseUrl();
  try {
    const link = await stripe.accountLinks.create({
      account: ensured.accountId,
      type: "account_onboarding",
      refresh_url: `${base}/provider/billing?refresh=1`,
      return_url: `${base}/provider/billing?return=1`,
    });
    return { ok: true, url: link.url };
  } catch (err: any) {
    logger.warn({ err: err?.message }, "billing: failed to create onboarding link");
    return { ok: false, error: { kind: "stripe_error", message: err?.message ?? String(err) } };
  }
}

// Refresh local mirror from Stripe. Called on demand from the status
// endpoint so the coach UI always reflects truth without waiting for
// the account.updated webhook.
export async function refreshConnectedAccount(providerId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  const row = await billingStorage.getProviderBilling(providerId);
  if (!row?.stripeAccountId) return;
  try {
    const a = await stripe.accounts.retrieve(row.stripeAccountId);
    await billingStorage.upsertProviderBilling({
      providerId,
      chargesEnabled: !!a.charges_enabled,
      payoutsEnabled: !!a.payouts_enabled,
      detailsSubmitted: !!a.details_submitted,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "billing: refresh account failed");
  }
}

// Lazy-create the seeker-side Stripe Customer scoped to a single
// engagement. Storing customer-per-engagement keeps the seeker free
// to use different cards / pricing across coaches without cross-
// contamination.
async function ensureCustomerForEngagement(opts: {
  engagementId: string;
  seekerUserId: string;
}): Promise<{ ok: true; customerId: string } | { ok: false; error: BillingError }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: { kind: "not_configured" } };
  const eb = await billingStorage.getEngagementBilling(opts.engagementId);
  if (eb?.stripeCustomerId) return { ok: true, customerId: eb.stripeCustomerId };
  const seeker = await storage.getUserById(opts.seekerUserId);
  try {
    const customer = await stripe.customers.create({
      email: seeker?.email ?? undefined,
      metadata: {
        haven_engagement_id: opts.engagementId,
        haven_seeker_id: opts.seekerUserId,
      },
    });
    await billingStorage.upsertEngagementBilling({
      engagementId: opts.engagementId,
      stripeCustomerId: customer.id,
    });
    return { ok: true, customerId: customer.id };
  } catch (err: any) {
    return { ok: false, error: { kind: "stripe_error", message: err?.message ?? String(err) } };
  }
}

// Per-session charge. Creates a PaymentIntent on the platform with
// `transfer_data.destination` pointing at the coach's connected
// account so funds flow directly. No application_fee for v1.
export async function chargePerSession(opts: {
  engagementId: string;
  seekerUserId: string;
  providerId: string;
  scheduledSessionId: string;
}): Promise<ChargeOutcome> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: { kind: "not_configured" } };

  const eb = await billingStorage.getEngagementBilling(opts.engagementId);
  if (!eb?.tierId) return { ok: false, error: { kind: "no_tier_selected" } };
  const tier = await billingStorage.getTierById(eb.tierId);
  if (!tier) return { ok: false, error: { kind: "tier_not_found" } };
  if (tier.billingCadence !== "per_session") {
    // Subscription-cadence engagements are billed by Stripe's recurring
    // invoice flow, not on session confirm. Treat as "no charge needed".
    return { ok: true, paymentIntentId: "", amountCents: 0 };
  }

  const provBilling = await billingStorage.getProviderBilling(opts.providerId);
  if (!provBilling?.stripeAccountId) {
    return { ok: false, error: { kind: "no_connected_account" } };
  }
  if (!provBilling.chargesEnabled) {
    return { ok: false, error: { kind: "account_incomplete" } };
  }

  const cust = await ensureCustomerForEngagement({
    engagementId: opts.engagementId,
    seekerUserId: opts.seekerUserId,
  });
  if (!cust.ok) return { ok: false, error: cust.error };

  try {
    // off_session=true requires a saved payment method. For v1 we set
    // confirm=false and return the client_secret to the seeker UI when
    // no default payment method exists. Here the simplest happy path
    // assumes the seeker has set up a card during tier selection — if
    // not, the PI will require_payment_method and the UI will surface
    // it on the Payment tab.
    const pi = await stripe.paymentIntents.create({
      amount: tier.amountCents,
      currency: "usd",
      customer: cust.customerId,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      transfer_data: { destination: provBilling.stripeAccountId },
      metadata: {
        haven_engagement_id: opts.engagementId,
        haven_scheduled_session_id: opts.scheduledSessionId,
        haven_tier_id: tier.id,
      },
    });

    // Treat any non-succeeded/non-processing PI status as a failure so
    // pause-on-failure kicks in (e.g. requires_payment_method when the
    // seeker has no saved card yet, or requires_action). The seeker's
    // Payment tab surfaces the client_secret and lets them complete it.
    const terminalOk = pi.status === "succeeded" || pi.status === "processing";
    await billingStorage.upsertEngagementBilling({
      engagementId: opts.engagementId,
      lastPaymentIntentId: pi.id,
      ...(terminalOk
        ? {}
        : {
            status: "past_due" as const,
            failedAt: new Date(),
            lastFailureMessage: `payment_intent ${pi.status}`,
          }),
    });
    await billingStorage.recordPayment({
      engagementId: opts.engagementId,
      tierId: tier.id,
      stripePaymentIntentId: pi.id,
      amountCents: tier.amountCents,
      status: pi.status === "succeeded" ? "succeeded" : terminalOk ? "pending" : "failed",
      failureMessage: terminalOk ? null : `payment_intent ${pi.status}`,
      scheduledSessionId: opts.scheduledSessionId,
    });
    if (!terminalOk) {
      return {
        ok: false,
        error: { kind: "stripe_error", message: `payment_intent ${pi.status}` },
      };
    }
    return { ok: true, paymentIntentId: pi.id, amountCents: tier.amountCents };
  } catch (err: any) {
    logger.warn({ err: err?.message }, "billing: per-session charge failed");
    await billingStorage.upsertEngagementBilling({
      engagementId: opts.engagementId,
      status: "past_due",
      failedAt: new Date(),
      lastFailureMessage: String(err?.message ?? err),
    });
    await billingStorage.recordPayment({
      engagementId: opts.engagementId,
      tierId: tier.id,
      amountCents: tier.amountCents,
      status: "failed",
      failureMessage: String(err?.message ?? err),
      scheduledSessionId: opts.scheduledSessionId,
    });
    return {
      ok: false,
      error: { kind: "stripe_error", message: String(err?.message ?? err) },
    };
  }
}

// Lazy-create a Stripe Price object for a monthly tier the first time
// someone subscribes to it. Per-session tiers never need a Price.
async function ensureStripePriceForTier(tier: PriceTier): Promise<
  { ok: true; priceId: string } | { ok: false; error: BillingError }
> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: { kind: "not_configured" } };
  if (tier.stripePriceId) return { ok: true, priceId: tier.stripePriceId };
  try {
    const product = await stripe.products.create({
      name: `Haven coaching — ${tier.label}`,
      metadata: { haven_tier_id: tier.id, haven_provider_id: tier.providerId },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.amountCents,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { haven_tier_id: tier.id },
    });
    await billingStorage.setTierStripePriceId(tier.id, price.id);
    return { ok: true, priceId: price.id };
  } catch (err: any) {
    return { ok: false, error: { kind: "stripe_error", message: err?.message ?? String(err) } };
  }
}

// Subscribe an engagement to a monthly tier. Cancels any prior sub on
// the same engagement first so the seeker can change tier mid-flight.
export async function subscribeMonthly(opts: {
  engagementId: string;
  seekerUserId: string;
  providerId: string;
  tierId: string;
}): Promise<
  | { ok: true; subscriptionId: string; clientSecret: string | null }
  | { ok: false; error: BillingError }
> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: { kind: "not_configured" } };
  const tier = await billingStorage.getTierById(opts.tierId);
  if (!tier) return { ok: false, error: { kind: "tier_not_found" } };
  const provBilling = await billingStorage.getProviderBilling(opts.providerId);
  if (!provBilling?.stripeAccountId) {
    return { ok: false, error: { kind: "no_connected_account" } };
  }

  const priceRes = await ensureStripePriceForTier(tier);
  if (!priceRes.ok) return priceRes;
  const cust = await ensureCustomerForEngagement({
    engagementId: opts.engagementId,
    seekerUserId: opts.seekerUserId,
  });
  if (!cust.ok) return cust;

  // Cancel prior sub if any.
  const existing = await billingStorage.getEngagementBilling(opts.engagementId);
  if (existing?.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
    } catch (err: any) {
      logger.warn({ err: err?.message }, "billing: failed cancelling prior sub");
    }
  }

  try {
    const sub = await stripe.subscriptions.create({
      customer: cust.customerId,
      items: [{ price: priceRes.priceId }],
      transfer_data: { destination: provBilling.stripeAccountId },
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        haven_engagement_id: opts.engagementId,
        haven_tier_id: tier.id,
      },
    });
    const latestInvoice = sub.latest_invoice as Stripe.Invoice | null;
    const pi =
      latestInvoice && typeof latestInvoice !== "string"
        ? ((latestInvoice as any).payment_intent as Stripe.PaymentIntent | null)
        : null;
    await billingStorage.upsertEngagementBilling({
      engagementId: opts.engagementId,
      tierId: tier.id,
      stripeSubscriptionId: sub.id,
      status: sub.status === "active" || sub.status === "trialing" ? "active" : "none",
    });
    return {
      ok: true,
      subscriptionId: sub.id,
      clientSecret: pi?.client_secret ?? null,
    };
  } catch (err: any) {
    return { ok: false, error: { kind: "stripe_error", message: err?.message ?? String(err) } };
  }
}

// Public summary used by both coach and seeker UIs.
export type BillingSummary = {
  configured: boolean;
  tier: PriceTier | null;
  status: string;
  pastDue: boolean;
  subscription: { id: string | null };
  lastFailureMessage: string | null;
};

export async function buildBillingSummary(
  engagementId: string,
): Promise<BillingSummary> {
  const eb = await billingStorage.getEngagementBilling(engagementId);
  let tier: PriceTier | null = null;
  if (eb?.tierId) {
    tier = (await billingStorage.getTierById(eb.tierId)) ?? null;
  }
  return {
    configured: !!process.env.STRIPE_SECRET_KEY,
    tier,
    status: eb?.status ?? "none",
    pastDue: eb?.status === "past_due",
    subscription: { id: eb?.stripeSubscriptionId ?? null },
    lastFailureMessage: eb?.lastFailureMessage ?? null,
  };
}
