import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useEngagements } from "@/hooks/useEngagements";

interface Tier {
  id: string;
  label: string;
  description: string | null;
  amountCents: number;
  billingCadence: "per_session" | "monthly";
}

interface BillingSummary {
  configured: boolean;
  tier: Tier | null;
  status: string;
  pastDue: boolean;
  lastFailureMessage: string | null;
  tiers: Tier[];
}

interface PaymentRow {
  id: string;
  amountCents: number;
  status: string;
  failureMessage: string | null;
  createdAt: string;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Memoise the Stripe.js loader by publishable key so we don't re-init
// when the parent re-renders. `loadStripe` itself caches internally,
// but holding the promise here keeps Elements stable across renders.
const stripePromiseCache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(pk: string): Promise<Stripe | null> {
  let p = stripePromiseCache.get(pk);
  if (!p) {
    p = loadStripe(pk);
    stripePromiseCache.set(pk, p);
  }
  return p;
}

// Inner Elements form. Has to live below <Elements> so it can use the
// useStripe / useElements hooks. Confirms the SetupIntent on submit,
// then asks the server to pin the PM as default and retry any
// past_due charge.
function SetupIntentForm(props: {
  engagementId: string;
  onSaved: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (error) {
        setErrorMsg(error.message ?? "Could not save card");
        toast.error(error.message ?? "Could not save card");
        return;
      }
      const pmId =
        typeof setupIntent?.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent?.payment_method?.id;
      if (!pmId) {
        setErrorMsg("No payment method returned");
        return;
      }
      const res = await apiRequest(
        "POST",
        `/api/engagements/${props.engagementId}/billing/payment-method`,
        { paymentMethodId: pmId },
      );
      const body = await res.json();
      if (body?.retry?.attempted && body.retry.ok === false) {
        toast.warning(`Card saved, but retry failed: ${body.retry.message ?? "unknown"}`);
      } else if (body?.retry?.attempted && body.retry.ok) {
        toast.success("Card saved and pending charge retried");
      } else {
        toast.success("Card saved");
      }
      await props.onSaved();
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Failed to save card");
      toast.error(err?.message ?? "Failed to save card");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" data-testid="setup-intent-form">
      <PaymentElement options={{ layout: "tabs" }} />
      {errorMsg && (
        <div className="text-xs text-destructive" data-testid="setup-intent-error">{errorMsg}</div>
      )}
      <Button type="submit" disabled={!stripe || submitting} data-testid="button-save-card">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
        Save card
      </Button>
    </form>
  );
}

// Wrapper that provisions a SetupIntent client_secret on mount and
// hands it to <Elements>. Re-mounts cleanly when engagementId changes.
function PaymentMethodCard(props: {
  engagementId: string;
  publishableKey: string;
  onSaved: () => Promise<void>;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stripePromise = useMemo(
    () => getStripePromise(props.publishableKey),
    [props.publishableKey],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setClientSecret(null);
    (async () => {
      try {
        const res = await apiRequest(
          "POST",
          `/api/engagements/${props.engagementId}/billing/setup-intent`,
          {},
        );
        const body = await res.json();
        if (!cancelled) setClientSecret(body.clientSecret);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to start card setup");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.engagementId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment method</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure card form…
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : clientSecret ? (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: "stripe" } }}
          >
            <SetupIntentForm engagementId={props.engagementId} onSaved={props.onSaved} />
          </Elements>
        ) : (
          <div className="text-sm text-muted-foreground">Card setup unavailable.</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SeekerPayment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { engagements, loading: engLoading } = useEngagements(user?.id ?? "", "seeker");
  const activeEng = useMemo(
    () => engagements.find((e) => e.status === "active") ?? engagements[0],
    [engagements],
  );
  const engagementId = activeEng?.id;

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [billingConfigured, setBillingConfigured] = useState(false);

  async function load() {
    if (!engagementId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, h, cfg] = await Promise.all([
        fetch(`/api/engagements/${engagementId}/billing`, { credentials: "include" }).then((r) => r.json()),
        fetch(`/api/engagements/${engagementId}/billing/history`, { credentials: "include" }).then((r) => r.json()),
        fetch(`/api/billing/config`, { credentials: "include" }).then((r) => r.json()),
      ]);
      setSummary(s);
      setHistory(h.payments ?? []);
      setBillingConfigured(!!cfg.configured);
      setPublishableKey(cfg.publishableKey ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load payment info");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  async function selectTier(tierId: string) {
    if (!engagementId) return;
    const target = summary?.tiers.find((t) => t.id === tierId);
    const current = summary?.tier;
    // Confirm before changing tiers so a stray click doesn't restart a
    // subscription or change the per-session amount silently.
    if (current && current.id !== tierId && target) {
      const ok = window.confirm(
        `Change your tier to ${target.label} (${fmtUsd(target.amountCents)} ${
          target.billingCadence === "monthly" ? "/ month" : "/ session"
        })?`,
      );
      if (!ok) return;
    }
    setPicking(tierId);
    try {
      const res = await apiRequest(
        "POST",
        `/api/engagements/${engagementId}/billing/select-tier`,
        { tierId },
      );
      const body = await res.json();
      // Monthly tier responses include a subscription.clientSecret when
      // Stripe wants the seeker to confirm the first invoice's payment
      // (e.g. SCA / 3DS). Confirm it here so the subscription doesn't
      // sit in "incomplete" forever.
      const subClientSecret: string | null = body?.subscription?.clientSecret ?? null;
      if (subClientSecret && publishableKey) {
        const stripe = await getStripePromise(publishableKey);
        if (stripe) {
          const { error } = await stripe.confirmCardPayment(subClientSecret);
          if (error) {
            toast.error(`Subscription needs a card: ${error.message ?? "save a card below"}`);
          } else {
            toast.success("Subscription started");
          }
        }
      } else {
        toast.success("Tier updated");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update tier");
    } finally {
      setPicking(null);
    }
  }

  return (
    <AppLayout title="Payment" subtitle="Your tier and history">
      <div className="container mx-auto max-w-3xl px-4 py-6 space-y-6">
        {(engLoading || loading) ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !engagementId ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No active engagement yet.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Current tier</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {summary?.pastDue && (
                  <div
                    className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm"
                    data-testid="billing-past-due"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium">Last payment failed</div>
                      {summary.lastFailureMessage && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {summary.lastFailureMessage}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Save a new card below — we'll retry automatically. New sessions are paused until this clears.
                      </div>
                    </div>
                  </div>
                )}
                {summary?.tier ? (
                  <div className="rounded-md border p-3">
                    <div className="font-medium">
                      {summary.tier.label}{" "}
                      <span className="text-muted-foreground font-normal">
                        — {fmtUsd(summary.tier.amountCents)}{" "}
                        {summary.tier.billingCadence === "monthly" ? "/ month" : "/ session"}
                      </span>
                    </div>
                    {summary.tier.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {summary.tier.description}
                      </div>
                    )}
                    <Badge
                      variant={summary.status === "active" ? "default" : "secondary"}
                      className="mt-2 gap-1"
                    >
                      {summary.status === "active" && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {summary.status === "active"
                        ? "Active"
                        : summary.status === "past_due"
                        ? "Past due"
                        : summary.status}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No tier selected yet. Pick one below to enable session booking.
                  </p>
                )}
              </CardContent>
            </Card>

            {billingConfigured && publishableKey && (
              <PaymentMethodCard
                engagementId={engagementId}
                publishableKey={publishableKey}
                onSaved={load}
              />
            )}

            <Card>
              <CardHeader><CardTitle>Choose a tier</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(summary?.tiers ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Your coach hasn't published any tiers yet.
                  </p>
                ) : (
                  summary!.tiers.map((t) => {
                    const isCurrent = summary?.tier?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => selectTier(t.id)}
                        disabled={picking === t.id}
                        data-testid={`button-pick-tier-${t.id}`}
                        className={`w-full text-left rounded-md border-2 p-4 transition-all ${isCurrent ? "border-primary bg-primary/5" : "border-border hover-elevate"}`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <div className="font-medium">{t.label}</div>
                            {t.description && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {t.description}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold">{fmtUsd(t.amountCents)}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.billingCadence === "monthly" ? "per month" : "per session"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No payments yet.</p>
                ) : (
                  <div className="divide-y">
                    {history.map((p) => (
                      <div key={p.id} className="flex justify-between items-center py-2 text-sm">
                        <div>
                          <div>{new Date(p.createdAt).toLocaleString()}</div>
                          {p.failureMessage && (
                            <div className="text-xs text-destructive mt-0.5">
                              {p.failureMessage}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{fmtUsd(p.amountCents)}</span>
                          <Badge
                            variant={
                              p.status === "succeeded"
                                ? "default"
                                : p.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {p.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
