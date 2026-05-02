import type { Request, Response } from "express";
import type Stripe from "stripe";
import { logger } from "../lib/logger";
import { getStripe, stripeWebhookSecret } from "../lib/stripe";
import { billingStorage } from "./billingStorage";

// Stripe webhook handler. Idempotent: events already marked processed
// are acked without re-running the handler; new events are only
// recorded as processed AFTER mutations succeed, so handler errors
// return 500 and Stripe retries them.

// stripe-node v18+ omits `subscription` from the typed Invoice surface
// even though the API still returns it.
type InvoiceWithSub = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
};

function invoiceSubId(inv: Stripe.Invoice): string | null {
  const raw = (inv as InvoiceWithSub).subscription ?? null;
  return typeof raw === "string" ? raw : raw?.id ?? null;
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  const secret = stripeWebhookSecret();
  if (!stripe || !secret) {
    // Refuse to process unverifiable payloads. 503 makes the misconfig
    // loud — Stripe will retry and the operator must set the secret.
    logger.warn("stripe webhook: STRIPE_WEBHOOK_SECRET not set — refusing event");
    res.status(503).json({ error: "webhook not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  const sigStr = Array.isArray(sig) ? sig[0] : sig;
  if (!sigStr) {
    res.status(400).json({ error: "missing signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sigStr,
      secret,
    );
  } catch (err: any) {
    logger.warn({ err: err?.message }, "stripe webhook: signature verification failed");
    res.status(400).json({ error: `signature: ${err?.message ?? "invalid"}` });
    return;
  }

  if (await billingStorage.isStripeEventProcessed(event.id)) {
    logger.debug({ eventId: event.id, type: event.type }, "stripe webhook: duplicate, skipped");
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    switch (event.type) {
      case "account.updated": {
        const acct = event.data.object as Stripe.Account;
        const row = await billingStorage.getProviderByStripeAccountId(acct.id);
        if (row) {
          await billingStorage.upsertProviderBilling({
            providerId: row.providerId,
            chargesEnabled: !!acct.charges_enabled,
            payoutsEnabled: !!acct.payouts_enabled,
            detailsSubmitted: !!acct.details_submitted,
          });
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const engagementId = pi.metadata?.haven_engagement_id;
        if (engagementId) {
          await billingStorage.upsertEngagementBilling({
            engagementId,
            status: "active",
            lastChargedAt: new Date(),
            failedAt: null,
            lastFailureMessage: null,
            lastPaymentIntentId: pi.id,
          });
          // Reconcile the ledger: chargePerSession may have inserted a
          // pending row; flip it to succeeded. If no row exists (e.g.
          // a manual confirm via Elements), insert one. Unique index on
          // stripePaymentIntentId backstops any race.
          await billingStorage.reconcilePaymentByPI({
            engagementId,
            stripePaymentIntentId: pi.id,
            status: "succeeded",
            amountCents: pi.amount,
            tierId: (pi.metadata?.haven_tier_id as string) || null,
          });
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const engagementId = pi.metadata?.haven_engagement_id;
        const reason = pi.last_payment_error?.message ?? "Payment failed";
        if (engagementId) {
          await billingStorage.upsertEngagementBilling({
            engagementId,
            status: "past_due",
            failedAt: new Date(),
            lastFailureMessage: reason,
            lastPaymentIntentId: pi.id,
          });
          await billingStorage.reconcilePaymentByPI({
            engagementId,
            stripePaymentIntentId: pi.id,
            status: "failed",
            amountCents: pi.amount,
            failureMessage: reason,
            tierId: (pi.metadata?.haven_tier_id as string) || null,
          });
        }
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = invoiceSubId(inv);
        if (subId) {
          const eb = await billingStorage.getEngagementBillingBySubscriptionId(subId);
          if (eb) {
            await billingStorage.upsertEngagementBilling({
              engagementId: eb.engagementId,
              status: "active",
              lastChargedAt: new Date(),
              failedAt: null,
              lastFailureMessage: null,
            });
            // Use recordPayment; the unique index on stripeInvoiceId will
            // raise on retry, but the event-id gate above already
            // prevents that path from being entered twice.
            try {
              await billingStorage.recordPayment({
                engagementId: eb.engagementId,
                tierId: eb.tierId ?? null,
                stripeInvoiceId: inv.id,
                amountCents: inv.amount_paid,
                status: "succeeded",
              });
            } catch (err: any) {
              logger.debug(
                { err: err?.message, invoiceId: inv.id },
                "stripe webhook: invoice.paid duplicate row suppressed",
              );
            }
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = invoiceSubId(inv);
        if (subId) {
          const eb = await billingStorage.getEngagementBillingBySubscriptionId(subId);
          if (eb) {
            await billingStorage.upsertEngagementBilling({
              engagementId: eb.engagementId,
              status: "past_due",
              failedAt: new Date(),
              lastFailureMessage: "Subscription payment failed",
            });
            try {
              await billingStorage.recordPayment({
                engagementId: eb.engagementId,
                tierId: eb.tierId ?? null,
                stripeInvoiceId: inv.id,
                amountCents: inv.amount_due,
                status: "failed",
                failureMessage: "Subscription payment failed",
              });
            } catch (err: any) {
              logger.debug(
                { err: err?.message, invoiceId: inv.id },
                "stripe webhook: invoice.payment_failed duplicate row suppressed",
              );
            }
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const eb = await billingStorage.getEngagementBillingBySubscriptionId(sub.id);
        if (eb) {
          // Clear tierId too: with no tier, the confirm route's
          // tier-required gate blocks new sessions until the seeker
          // picks an active tier again.
          await billingStorage.upsertEngagementBilling({
            engagementId: eb.engagementId,
            status: "canceled",
            tierId: null,
            stripeSubscriptionId: null,
            lastPaymentIntentId: null,
          });
        }
        break;
      }
      default: {
        logger.debug({ type: event.type }, "stripe webhook: unhandled event");
      }
    }
    // Only mark processed after every mutation has succeeded.
    await billingStorage.markStripeEventProcessed(event.id, event.type);
    res.status(200).json({ received: true });
  } catch (err: any) {
    logger.error({ err: err?.message, type: event.type }, "stripe webhook: handler error");
    // Return 500 so Stripe retries; the event is NOT marked processed.
    res.status(500).json({ received: false, error: err?.message ?? "handler error" });
  }
}
