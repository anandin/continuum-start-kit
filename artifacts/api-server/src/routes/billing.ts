import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import { storage } from "../storage";
import { billingStorage } from "../services/billingStorage";
import {
  buildBillingSummary,
  createOnboardingLink,
  refreshConnectedAccount,
  subscribeMonthly,
  createSetupIntentForEngagement,
  setEngagementDefaultPaymentMethod,
  retryPendingChargeForEngagement,
} from "../services/billing";
import { getStripe, stripeConfigured, stripePublishableKey } from "../lib/stripe";
import type { InsertPriceTier } from "@workspace/db/schema";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  return next();
}

async function requireProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const role = await storage.getUserRoleByUserId(req.user.id);
    if (role?.role !== "provider") {
      res.status(403).json({ error: "Provider access required" });
      return;
    }
    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// Confirm the requester is one of the two parties on the engagement
// (either the assigned coach OR the seeker who owns the seeker row).
async function ensureEngagementParty(
  engagementId: string,
  userId: string,
): Promise<{ ok: true; isProvider: boolean; engagementProviderId: string; seekerUserId: string } | { ok: false; status: number; error: string }> {
  const eng = await storage.getEngagementById(engagementId);
  if (!eng) return { ok: false, status: 404, error: "Engagement not found" };
  if (eng.providerId === userId) {
    if (!eng.seekerId) return { ok: false, status: 500, error: "Engagement missing seeker" };
    const seeker = await storage.getSeekerById(eng.seekerId);
    if (!seeker) return { ok: false, status: 500, error: "Seeker not found" };
    return {
      ok: true,
      isProvider: true,
      engagementProviderId: eng.providerId,
      seekerUserId: seeker.ownerId,
    };
  }
  if (!eng.seekerId) return { ok: false, status: 403, error: "Forbidden" };
  const seeker = await storage.getSeekerById(eng.seekerId);
  if (!seeker || seeker.ownerId !== userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return {
    ok: true,
    isProvider: false,
    engagementProviderId: eng.providerId!,
    seekerUserId: seeker.ownerId,
  };
}

const createTierSchema = z.object({
  label: z.string().min(1).max(80),
  description: z.string().max(280).optional().nullable(),
  amountCents: z.number().int().min(100).max(1_000_000),
  billingCadence: z.enum(["per_session", "monthly"]),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});

const patchTierSchema = createTierSchema.partial();

const selectTierSchema = z.object({
  tierId: z.string().uuid(),
});

export function registerBillingRoutes(app: Express): void {
  // Public — used by the seeker onboarding flow to show pricing
  // BEFORE the engagement is created. Returns only active tiers.
  app.get("/api/public/provider/:providerId/tiers", async (req, res) => {
    try {
      const tiers = await billingStorage.listTiersForProvider(
        String(req.params.providerId),
        { activeOnly: true },
      );
      return res.json({
        tiers: tiers.map((t) => ({
          id: t.id,
          label: t.label,
          description: t.description,
          amountCents: t.amountCents,
          billingCadence: t.billingCadence,
        })),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ---------------- coach: Stripe Connect ----------------
  app.get("/api/billing/connect/status", requireProvider, async (req, res) => {
    try {
      if (!stripeConfigured()) {
        return res.json({
          configured: false,
          stripeAccountId: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
        });
      }
      const providerId = req.user!.id;
      // Refresh from Stripe so the UI shows truth even before webhooks.
      await refreshConnectedAccount(providerId).catch(() => {});
      const row = await billingStorage.getProviderBilling(providerId);
      return res.json({
        configured: true,
        stripeAccountId: row?.stripeAccountId ?? null,
        chargesEnabled: row?.chargesEnabled ?? false,
        payoutsEnabled: row?.payoutsEnabled ?? false,
        detailsSubmitted: row?.detailsSubmitted ?? false,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/billing/connect/onboard", requireProvider, async (req, res) => {
    try {
      if (!stripeConfigured()) {
        return res.status(503).json({ error: "Billing is not configured on this server" });
      }
      const providerId = req.user!.id;
      const result = await createOnboardingLink(providerId);
      if (!result.ok) {
        const code = result.error.kind === "stripe_error" ? 502 : 500;
        return res.status(code).json({ error: result.error });
      }
      return res.json({ url: result.url });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ---------------- coach: tiers CRUD ----------------
  app.get("/api/billing/tiers", requireProvider, async (req, res) => {
    try {
      const tiers = await billingStorage.listTiersForProvider(req.user!.id);
      return res.json({ tiers });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/billing/tiers", requireProvider, async (req, res) => {
    try {
      const parsed = createTierSchema.parse(req.body);
      const tier = await billingStorage.createTier({
        providerId: req.user!.id,
        label: parsed.label,
        description: parsed.description ?? null,
        amountCents: parsed.amountCents,
        billingCadence: parsed.billingCadence,
        sortOrder: parsed.sortOrder ?? 0,
        isActive: parsed.isActive ?? true,
      });
      return res.json({ tier });
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/billing/tiers/:id", requireProvider, async (req, res) => {
    try {
      const tier = await billingStorage.getTierById(String(req.params.id));
      if (!tier || tier.providerId !== req.user!.id) {
        return res.status(404).json({ error: "Tier not found" });
      }
      const parsed = patchTierSchema.parse(req.body);
      // Build a typed patch instead of casting to any. Each field is
      // copied only when present so we never accidentally null out a
      // column the client didn't mean to touch.
      const patch: Partial<InsertPriceTier> = {};
      if (parsed.label !== undefined) patch.label = parsed.label;
      if (parsed.description !== undefined) patch.description = parsed.description ?? null;
      if (parsed.amountCents !== undefined) patch.amountCents = parsed.amountCents;
      if (parsed.billingCadence !== undefined) patch.billingCadence = parsed.billingCadence;
      if (parsed.sortOrder !== undefined) patch.sortOrder = parsed.sortOrder;
      if (parsed.isActive !== undefined) patch.isActive = parsed.isActive;
      const updated = await billingStorage.updateTier(tier.id, patch);
      return res.json({ tier: updated });
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/billing/tiers/:id", requireProvider, async (req, res) => {
    try {
      const tier = await billingStorage.getTierById(String(req.params.id));
      if (!tier || tier.providerId !== req.user!.id) {
        return res.status(404).json({ error: "Tier not found" });
      }
      // Soft-delete: keep history rows valid by flipping isActive instead
      // of physical delete. Engagements still bound to the tier keep
      // their reference; coach can't re-pick this in the UI.
      const updated = await billingStorage.updateTier(tier.id, { isActive: false });
      return res.json({ tier: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ---------------- engagement billing: shared seeker + coach ----------------
  app.get("/api/engagements/:id/billing", requireAuth, async (req, res) => {
    try {
      const party = await ensureEngagementParty(String(req.params.id), req.user!.id);
      if (!party.ok) return res.status(party.status).json({ error: party.error });
      const summary = await buildBillingSummary(String(req.params.id));
      const tiers = await billingStorage.listTiersForProvider(
        party.engagementProviderId,
        { activeOnly: true },
      );
      return res.json({ ...summary, tiers });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/engagements/:id/billing/history", requireAuth, async (req, res) => {
    try {
      const party = await ensureEngagementParty(String(req.params.id), req.user!.id);
      if (!party.ok) return res.status(party.status).json({ error: party.error });
      const payments = await billingStorage.listPaymentsForEngagement(String(req.params.id));
      return res.json({ payments });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post(
    "/api/engagements/:id/billing/select-tier",
    requireAuth,
    async (req, res) => {
      try {
        const engagementId = String(req.params.id);
        const party = await ensureEngagementParty(engagementId, req.user!.id);
        if (!party.ok) return res.status(party.status).json({ error: party.error });
        // Only the seeker chooses their own tier — coaches can't pick
        // for them (would defeat the no-judgment sliding-scale point).
        if (party.isProvider) {
          return res
            .status(403)
            .json({ error: "Only the seeker can select their own tier" });
        }
        const parsed = selectTierSchema.parse(req.body);
        const tier = await billingStorage.getTierById(parsed.tierId);
        if (!tier || tier.providerId !== party.engagementProviderId || !tier.isActive) {
          return res.status(404).json({ error: "Tier not available" });
        }
        // Monthly tiers require Stripe — refuse cleanly otherwise so we
        // never persist a paid tier we can't actually bill.
        if (tier.billingCadence === "monthly" && !stripeConfigured()) {
          return res.status(503).json({
            error: "Billing isn't configured on the server. Pick a per-session tier or contact support.",
          });
        }

        const existing = await billingStorage.getEngagementBilling(engagementId);

        // Switching AWAY from a monthly tier: cancel the existing sub
        // first so the customer isn't billed monthly + per-session.
        if (
          existing?.stripeSubscriptionId &&
          tier.billingCadence === "per_session"
        ) {
          try {
            const stripe = getStripe();
            if (stripe) await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
          } catch (err: any) {
            req.log.warn(
              { err: err?.message },
              "billing: failed cancelling prior subscription on tier switch",
            );
          }
          await billingStorage.upsertEngagementBilling({
            engagementId,
            stripeSubscriptionId: null,
            lastPaymentIntentId: null,
          });
        }

        if (tier.billingCadence === "monthly") {
          // Create the Stripe subscription FIRST. subscribeMonthly is
          // the single source of truth for tierId + status writes when
          // the cadence is monthly — that way local state can never
          // claim a monthly tier without a backing Stripe subscription.
          const sub = await subscribeMonthly({
            engagementId,
            seekerUserId: party.seekerUserId,
            providerId: party.engagementProviderId,
            tierId: tier.id,
          });
          if (!sub.ok) return res.status(502).json({ error: sub.error });
          const summary = await buildBillingSummary(engagementId);
          return res.json({
            ...summary,
            subscription: { id: sub.subscriptionId, clientSecret: sub.clientSecret },
          });
        }

        // Per-session: safe to write the tier directly.
        await billingStorage.upsertEngagementBilling({
          engagementId,
          tierId: tier.id,
          status: "active",
          failedAt: null,
          lastFailureMessage: null,
        });
        const summary = await buildBillingSummary(engagementId);
        return res.json(summary);
      } catch (e: any) {
        if (e?.issues) return res.status(400).json({ error: "Invalid input", issues: e.issues });
        return res.status(500).json({ error: e.message });
      }
    },
  );

  // ---------------- payment-method management (seeker UI) ----------------
  // Returns the publishable key (and configured flag) so the web UI
  // can lazy-load Stripe.js only when billing is actually wired up.
  app.get("/api/billing/config", requireAuth, (_req, res) => {
    res.json({
      configured: stripeConfigured(),
      publishableKey: stripePublishableKey() ?? null,
    });
  });

  // Create a SetupIntent for the seeker's customer on this engagement.
  // The Elements PaymentElement uses the returned client_secret to
  // collect a card and attach it as the default payment method.
  app.post(
    "/api/engagements/:id/billing/setup-intent",
    requireAuth,
    async (req, res) => {
      try {
        const engagementId = String(req.params.id);
        const party = await ensureEngagementParty(engagementId, req.user!.id);
        if (!party.ok) return res.status(party.status).json({ error: party.error });
        if (party.isProvider) {
          return res.status(403).json({ error: "Only the seeker can manage payment methods" });
        }
        if (!stripeConfigured()) {
          return res.status(503).json({ error: "Billing not configured" });
        }
        const result = await createSetupIntentForEngagement({
          engagementId,
          seekerUserId: party.seekerUserId,
        });
        if (!result.ok) {
          return res.status(502).json({ error: result.error });
        }
        return res.json({ clientSecret: result.clientSecret });
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    },
  );

  // Called after Elements confirms the SetupIntent client-side. We
  // pin it as the customer's default invoice PM so future per-session
  // charges and subscription invoices off_session-confirm cleanly.
  // Then we retry any past_due charge and report whether the
  // engagement is now healthy.
  app.post(
    "/api/engagements/:id/billing/payment-method",
    requireAuth,
    async (req, res) => {
      try {
        const engagementId = String(req.params.id);
        const party = await ensureEngagementParty(engagementId, req.user!.id);
        if (!party.ok) return res.status(party.status).json({ error: party.error });
        if (party.isProvider) {
          return res.status(403).json({ error: "Only the seeker can manage payment methods" });
        }
        const schema = z.object({ paymentMethodId: z.string().min(3) });
        const parsed = schema.parse(req.body);
        const set = await setEngagementDefaultPaymentMethod({
          engagementId,
          paymentMethodId: parsed.paymentMethodId,
        });
        if (!set.ok) return res.status(502).json({ error: set.error });
        // Best-effort: if past_due, immediately retry the most recent
        // failed PaymentIntent now that we have a working card.
        const retry = await retryPendingChargeForEngagement(engagementId);
        const summary = await buildBillingSummary(engagementId);
        return res.json({ ...summary, retry });
      } catch (e: any) {
        if (e?.issues) return res.status(400).json({ error: "Invalid input", issues: e.issues });
        return res.status(500).json({ error: e.message });
      }
    },
  );
}
