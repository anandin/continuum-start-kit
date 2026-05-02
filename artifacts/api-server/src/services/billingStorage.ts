import { db } from "../db";
import {
  providerBilling,
  priceTiers,
  engagementBilling,
  billingPayments,
  billingProcessedEvents,
  type ProviderBilling,
  type PriceTier,
  type EngagementBilling,
  type BillingPayment,
  type InsertPriceTier,
} from "@workspace/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

// All billing data access goes through this module. Routes never call
// drizzle directly for these tables so we have a single place to add
// auditing / caching later.

export const billingStorage = {
  // ---------------- providerBilling ----------------
  async getProviderBilling(providerId: string): Promise<ProviderBilling | undefined> {
    const [row] = await db
      .select()
      .from(providerBilling)
      .where(eq(providerBilling.providerId, providerId))
      .limit(1);
    return row;
  },

  async upsertProviderBilling(input: {
    providerId: string;
    stripeAccountId?: string | null;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    detailsSubmitted?: boolean;
  }): Promise<ProviderBilling> {
    const existing = await this.getProviderBilling(input.providerId);
    if (existing) {
      const [updated] = await db
        .update(providerBilling)
        .set({
          ...(input.stripeAccountId !== undefined
            ? { stripeAccountId: input.stripeAccountId }
            : {}),
          ...(input.chargesEnabled !== undefined
            ? { chargesEnabled: input.chargesEnabled }
            : {}),
          ...(input.payoutsEnabled !== undefined
            ? { payoutsEnabled: input.payoutsEnabled }
            : {}),
          ...(input.detailsSubmitted !== undefined
            ? { detailsSubmitted: input.detailsSubmitted }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(providerBilling.providerId, input.providerId))
        .returning();
      return updated;
    }
    const [row] = await db
      .insert(providerBilling)
      .values({
        providerId: input.providerId,
        stripeAccountId: input.stripeAccountId ?? null,
        chargesEnabled: input.chargesEnabled ?? false,
        payoutsEnabled: input.payoutsEnabled ?? false,
        detailsSubmitted: input.detailsSubmitted ?? false,
      })
      .returning();
    return row;
  },

  async getProviderByStripeAccountId(
    stripeAccountId: string,
  ): Promise<ProviderBilling | undefined> {
    const [row] = await db
      .select()
      .from(providerBilling)
      .where(eq(providerBilling.stripeAccountId, stripeAccountId))
      .limit(1);
    return row;
  },

  // ---------------- priceTiers ----------------
  async listTiersForProvider(
    providerId: string,
    opts: { activeOnly?: boolean } = {},
  ): Promise<PriceTier[]> {
    const rows = await db
      .select()
      .from(priceTiers)
      .where(
        opts.activeOnly
          ? and(eq(priceTiers.providerId, providerId), eq(priceTiers.isActive, true))
          : eq(priceTiers.providerId, providerId),
      )
      .orderBy(priceTiers.sortOrder);
    return rows;
  },

  async getTierById(id: string): Promise<PriceTier | undefined> {
    const [row] = await db.select().from(priceTiers).where(eq(priceTiers.id, id)).limit(1);
    return row;
  },

  async createTier(data: InsertPriceTier): Promise<PriceTier> {
    const [row] = await db.insert(priceTiers).values(data).returning();
    return row;
  },

  async updateTier(id: string, patch: Partial<InsertPriceTier>): Promise<PriceTier | undefined> {
    const [row] = await db
      .update(priceTiers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(priceTiers.id, id))
      .returning();
    return row;
  },

  async setTierStripePriceId(id: string, stripePriceId: string): Promise<void> {
    await db
      .update(priceTiers)
      .set({ stripePriceId, updatedAt: new Date() })
      .where(eq(priceTiers.id, id));
  },

  // ---------------- engagementBilling ----------------
  async getEngagementBilling(engagementId: string): Promise<EngagementBilling | undefined> {
    const [row] = await db
      .select()
      .from(engagementBilling)
      .where(eq(engagementBilling.engagementId, engagementId))
      .limit(1);
    return row;
  },

  async upsertEngagementBilling(input: {
    engagementId: string;
    tierId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    lastPaymentIntentId?: string | null;
    status?: string;
    lastChargedAt?: Date | null;
    failedAt?: Date | null;
    lastFailureMessage?: string | null;
  }): Promise<EngagementBilling> {
    const existing = await this.getEngagementBilling(input.engagementId);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of [
      "tierId",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "lastPaymentIntentId",
      "status",
      "lastChargedAt",
      "failedAt",
      "lastFailureMessage",
    ] as const) {
      if (input[k] !== undefined) patch[k] = input[k];
    }
    if (existing) {
      const [row] = await db
        .update(engagementBilling)
        .set(patch)
        .where(eq(engagementBilling.engagementId, input.engagementId))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(engagementBilling)
      .values({
        engagementId: input.engagementId,
        tierId: input.tierId ?? null,
        stripeCustomerId: input.stripeCustomerId ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        lastPaymentIntentId: input.lastPaymentIntentId ?? null,
        status: input.status ?? "none",
        lastChargedAt: input.lastChargedAt ?? null,
        failedAt: input.failedAt ?? null,
        lastFailureMessage: input.lastFailureMessage ?? null,
      })
      .returning();
    return row;
  },

  async getEngagementBillingByCustomerId(
    stripeCustomerId: string,
  ): Promise<EngagementBilling | undefined> {
    const [row] = await db
      .select()
      .from(engagementBilling)
      .where(eq(engagementBilling.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return row;
  },

  async getEngagementBillingBySubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<EngagementBilling | undefined> {
    const [row] = await db
      .select()
      .from(engagementBilling)
      .where(eq(engagementBilling.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
    return row;
  },

  async getEngagementBillingByPaymentIntentId(
    paymentIntentId: string,
  ): Promise<EngagementBilling | undefined> {
    const [row] = await db
      .select()
      .from(engagementBilling)
      .where(eq(engagementBilling.lastPaymentIntentId, paymentIntentId))
      .limit(1);
    return row;
  },

  // ---------------- billingPayments (ledger) ----------------
  async recordPayment(input: {
    engagementId: string;
    tierId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeInvoiceId?: string | null;
    amountCents: number;
    currency?: string;
    status: "succeeded" | "failed" | "pending";
    failureMessage?: string | null;
    scheduledSessionId?: string | null;
  }): Promise<BillingPayment> {
    const [row] = await db
      .insert(billingPayments)
      .values({
        engagementId: input.engagementId,
        tierId: input.tierId ?? null,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        stripeInvoiceId: input.stripeInvoiceId ?? null,
        amountCents: input.amountCents,
        currency: input.currency ?? "usd",
        status: input.status,
        failureMessage: input.failureMessage ?? null,
        scheduledSessionId: input.scheduledSessionId ?? null,
      })
      .returning();
    return row;
  },

  async listPaymentsForEngagement(
    engagementId: string,
    limit = 50,
  ): Promise<BillingPayment[]> {
    return db
      .select()
      .from(billingPayments)
      .where(eq(billingPayments.engagementId, engagementId))
      .orderBy(desc(billingPayments.createdAt))
      .limit(limit);
  },

  // Update an existing pending ledger row (matched by stripePaymentIntentId)
  // so a webhook arriving after the initial charge attempt reconciles
  // the row instead of inserting a duplicate. Falls back to inserting
  // a new row when no pending row exists (e.g. the initial create wasn't
  // reached because chargePerSession ran on an instance that crashed).
  async reconcilePaymentByPI(input: {
    engagementId: string;
    stripePaymentIntentId: string;
    status: "succeeded" | "failed" | "pending";
    failureMessage?: string | null;
    amountCents: number;
    tierId?: string | null;
  }): Promise<void> {
    const [existing] = await db
      .select()
      .from(billingPayments)
      .where(eq(billingPayments.stripePaymentIntentId, input.stripePaymentIntentId))
      .limit(1);
    if (existing) {
      await db
        .update(billingPayments)
        .set({
          status: input.status,
          failureMessage: input.failureMessage ?? null,
        })
        .where(eq(billingPayments.id, existing.id));
      return;
    }
    await db.insert(billingPayments).values({
      engagementId: input.engagementId,
      tierId: input.tierId ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId,
      amountCents: input.amountCents,
      status: input.status,
      failureMessage: input.failureMessage ?? null,
    });
  },

  // ---------------- webhook idempotency ----------------
  // Returns true if this is the first time we've seen the event id.
  // Uses INSERT ... ON CONFLICT DO NOTHING so concurrent webhook
  // retries can race safely — only one claims the event.
  async claimStripeEvent(eventId: string, eventType: string): Promise<boolean> {
    const result = await db
      .insert(billingProcessedEvents)
      .values({ eventId, eventType })
      .onConflictDoNothing({ target: billingProcessedEvents.eventId })
      .returning({ eventId: billingProcessedEvents.eventId });
    return result.length > 0;
  },
};
// Silence unused-imports warning when only used inside template strings.
void sql;
