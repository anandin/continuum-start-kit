import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Tier {
  id: string;
  label: string;
  amountCents: number;
  billingCadence: "per_session" | "monthly";
}

interface Summary {
  configured: boolean;
  tier: Tier | null;
  status: string;
  pastDue: boolean;
  lastFailureMessage: string | null;
}

interface PaymentRow {
  id: string;
  amountCents: number;
  status: string;
  createdAt: string;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Coach-facing read-only billing summary for an engagement: shows the
// seeker's current tier, status, last failure (if any), and a short
// payment history. Coaches cannot change the tier — the seeker owns it.
export function CoachBillingSummary({
  engagementId,
}: {
  engagementId: string;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/engagements/${engagementId}/billing`, {
        credentials: "include",
      }).then((r) => r.json()),
      fetch(`/api/engagements/${engagementId}/billing/history`, {
        credentials: "include",
      }).then((r) => r.json()),
    ])
      .then(([s, h]) => {
        if (cancelled) return;
        setSummary(s);
        setHistory((h.payments ?? []).slice(0, 5));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  return (
    <Card data-testid="coach-billing-summary">
      <CardHeader>
        <CardTitle className="text-base">Billing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !summary?.configured ? (
          <p className="text-sm text-muted-foreground italic">
            Billing isn't configured on this server yet.
          </p>
        ) : (
          <>
            {summary.pastDue && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Payment is past due</div>
                  {summary.lastFailureMessage && (
                    <div className="text-muted-foreground mt-0.5">
                      {summary.lastFailureMessage}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <div>
                {summary.tier ? (
                  <>
                    <span className="font-medium">{summary.tier.label}</span>{" "}
                    <span className="text-muted-foreground">
                      — {fmtUsd(summary.tier.amountCents)}{" "}
                      {summary.tier.billingCadence === "monthly"
                        ? "/ month"
                        : "/ session"}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">
                    No tier selected by client
                  </span>
                )}
              </div>
              <Badge
                variant={summary.status === "active" ? "default" : "secondary"}
                className="gap-1"
              >
                {summary.status === "active" && (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {summary.status === "active"
                  ? "Active"
                  : summary.status === "past_due"
                    ? "Past due"
                    : summary.status === "incomplete"
                      ? "Awaiting payment"
                      : summary.status}
              </Badge>
            </div>
            {history.length > 0 && (
              <div className="border-t pt-2">
                <div className="text-xs text-muted-foreground mb-1">
                  Recent payments
                </div>
                <div className="divide-y text-xs">
                  {history.map((p) => (
                    <div key={p.id} className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-2">
                        {fmtUsd(p.amountCents)}
                        <Badge
                          variant={
                            p.status === "succeeded"
                              ? "default"
                              : p.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {p.status}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
