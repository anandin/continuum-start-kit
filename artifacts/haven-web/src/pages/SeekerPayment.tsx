import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
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

export default function SeekerPayment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { engagements, loading: engLoading } = useEngagements(user?.id ?? "", "seeker");
  const activeEng = useMemo(() => engagements.find((e) => e.status === "active") ?? engagements[0], [engagements]);
  const engagementId = activeEng?.id;

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);

  async function load() {
    if (!engagementId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        fetch(`/api/engagements/${engagementId}/billing`, { credentials: "include" }).then((r) => r.json()),
        fetch(`/api/engagements/${engagementId}/billing/history`, { credentials: "include" }).then((r) => r.json()),
      ]);
      setSummary(s);
      setHistory(h.payments ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load payment info");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [engagementId]);

  async function selectTier(tierId: string) {
    if (!engagementId) return;
    setPicking(tierId);
    try {
      await apiRequest("POST", `/api/engagements/${engagementId}/billing/select-tier`, { tierId });
      await load();
      toast.success("Tier updated");
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
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !engagementId ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No active engagement yet.</CardContent></Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Current tier</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {summary?.pastDue && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm" data-testid="billing-past-due">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium">Last payment failed</div>
                      {summary.lastFailureMessage && <div className="text-xs text-muted-foreground mt-1">{summary.lastFailureMessage}</div>}
                      <div className="text-xs text-muted-foreground mt-1">Re-select a tier below to retry — new sessions are paused until this is resolved.</div>
                    </div>
                  </div>
                )}
                {summary?.tier ? (
                  <div className="rounded-md border p-3">
                    <div className="font-medium">{summary.tier.label} <span className="text-muted-foreground font-normal">— {fmtUsd(summary.tier.amountCents)} {summary.tier.billingCadence === "monthly" ? "/ month" : "/ session"}</span></div>
                    {summary.tier.description && <div className="text-xs text-muted-foreground mt-1">{summary.tier.description}</div>}
                    <Badge variant={summary.status === "active" ? "default" : "secondary"} className="mt-2 gap-1">
                      {summary.status === "active" && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {summary.status === "active" ? "Active" : summary.status === "past_due" ? "Past due" : summary.status}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tier selected yet. Pick one below to enable session booking.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Choose a tier</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(summary?.tiers ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Your coach hasn't published any tiers yet.</p>
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
                            {t.description && <div className="text-xs text-muted-foreground mt-1">{t.description}</div>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold">{fmtUsd(t.amountCents)}</div>
                            <div className="text-xs text-muted-foreground">{t.billingCadence === "monthly" ? "per month" : "per session"}</div>
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
                          {p.failureMessage && <div className="text-xs text-destructive mt-0.5">{p.failureMessage}</div>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{fmtUsd(p.amountCents)}</span>
                          <Badge variant={p.status === "succeeded" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{p.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
