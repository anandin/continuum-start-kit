import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";

interface ConnectStatus {
  configured: boolean;
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

interface Tier {
  id: string;
  label: string;
  description: string | null;
  amountCents: number;
  billingCadence: "per_session" | "monthly";
  isActive: boolean;
  sortOrder: number;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProviderBilling() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("75");
  const [newCadence, setNewCadence] = useState<"per_session" | "monthly">(
    "per_session",
  );
  const [newSaveAsDraft, setNewSaveAsDraft] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        fetch("/api/billing/connect/status", { credentials: "include" }).then(
          (r) => r.json(),
        ),
        fetch("/api/billing/tiers", { credentials: "include" }).then((r) =>
          r.json(),
        ),
      ]);
      setStatus(s);
      setTiers(t.tiers ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function startOnboarding() {
    setOnboarding(true);
    try {
      const res = await apiRequest("POST", "/api/billing/connect/onboard", {});
      const body = await res.json();
      if (body?.url) {
        window.location.href = body.url;
        return;
      }
      toast.error("Could not start Stripe onboarding");
    } catch (e: any) {
      toast.error(e?.message ?? "Onboarding failed");
    } finally {
      setOnboarding(false);
    }
  }

  async function createTier() {
    const dollars = parseFloat(newAmount);
    if (!newLabel.trim() || !Number.isFinite(dollars) || dollars < 1) {
      toast.error("Label and a valid USD amount are required");
      return;
    }
    setCreating(true);
    try {
      await apiRequest("POST", "/api/billing/tiers", {
        label: newLabel.trim(),
        description: newDescription.trim() || null,
        amountCents: Math.round(dollars * 100),
        billingCadence: newCadence,
        isActive: !newSaveAsDraft,
      });
      setNewLabel("");
      setNewDescription("");
      setNewAmount("75");
      setNewCadence("per_session");
      setNewSaveAsDraft(false);
      await load();
      toast.success(newSaveAsDraft ? "Draft tier saved" : "Tier added");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add tier");
    } finally {
      setCreating(false);
    }
  }

  async function activateTier(id: string) {
    try {
      await apiRequest("PATCH", `/api/billing/tiers/${id}`, { isActive: true });
      await load();
      toast.success("Tier activated");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not activate tier");
    }
  }

  async function deleteTier(id: string) {
    if (
      !confirm("Archive this tier? Existing seekers on it keep their pricing.")
    )
      return;
    try {
      await apiRequest("DELETE", `/api/billing/tiers/${id}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to archive tier");
    }
  }

  return (
    <AppLayout title="Billing" subtitle="Stripe Connect & sliding-scale tiers">
      <div className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Stripe Connect</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!status?.configured ? (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      Billing isn't yet enabled on this server. Once Stripe
                      credentials are configured you'll be able to connect your
                      Stripe account here.
                    </div>
                  </div>
                ) : !status.stripeAccountId ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Connect a Stripe account to start receiving payments. We
                      use Stripe Connect Express — Stripe handles tax forms,
                      KYC, and payouts directly to your bank.
                    </p>
                    <Button
                      onClick={startOnboarding}
                      disabled={onboarding}
                      data-testid="button-stripe-onboard"
                    >
                      {onboarding ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Connect Stripe account
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      {status.chargesEnabled ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Charges
                          enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Charges pending</Badge>
                      )}
                      {status.payoutsEnabled ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Payouts
                          enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Payouts pending</Badge>
                      )}
                    </div>
                    {!status.detailsSubmitted && (
                      <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          Stripe still needs more info before you can be paid.
                          Continue onboarding below.
                        </div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      onClick={startOnboarding}
                      disabled={onboarding}
                    >
                      {onboarding ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      {status.detailsSubmitted
                        ? "Update Stripe details"
                        : "Continue onboarding"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sliding-scale tiers</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Define the pricing options seekers can choose from.
                  Per-session bills on each booked session; Monthly creates a
                  Stripe subscription.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {tiers.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No tiers yet. Add your first below.
                  </p>
                )}
                {tiers.map((t) => (
                  <div
                    key={t.id}
                    data-testid={`tier-row-${t.id}`}
                    className={`flex items-center justify-between rounded-md border p-3 ${!t.isActive ? "opacity-50" : ""}`}
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {t.label}{" "}
                        <span className="text-muted-foreground font-normal">
                          — {fmtUsd(t.amountCents)}{" "}
                          {t.billingCadence === "monthly"
                            ? "/ month"
                            : "/ session"}
                        </span>
                      </div>
                      {t.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t.description}
                        </div>
                      )}
                      {!t.isActive && (
                        <Badge variant="secondary" className="mt-1">
                          Archived
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!t.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activateTier(t.id)}
                          disabled={!status?.chargesEnabled}
                          data-testid={`button-activate-tier-${t.id}`}
                        >
                          Activate
                        </Button>
                      )}
                      {t.isActive && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteTier(t.id)}
                          data-testid={`button-delete-tier-${t.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                  <div className="text-sm font-medium">Add a new tier</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tier-label">Label</Label>
                      <Input
                        id="tier-label"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Standard"
                        data-testid="input-tier-label"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tier-amount">USD amount</Label>
                      <Input
                        id="tier-amount"
                        type="number"
                        min="1"
                        step="1"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        data-testid="input-tier-amount"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="tier-cadence">Cadence</Label>
                      <Select
                        value={newCadence}
                        onValueChange={(v) => {
                          if (v === "per_session" || v === "monthly")
                            setNewCadence(v);
                        }}
                      >
                        <SelectTrigger
                          id="tier-cadence"
                          data-testid="select-tier-cadence"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_session">
                            Per session
                          </SelectItem>
                          <SelectItem value="monthly">
                            Monthly subscription
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="tier-desc">Description (optional)</Label>
                      <Textarea
                        id="tier-desc"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Who is this for?"
                        rows={2}
                        data-testid="input-tier-description"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="tier-draft"
                      type="checkbox"
                      checked={newSaveAsDraft}
                      onChange={(e) => setNewSaveAsDraft(e.target.checked)}
                      data-testid="checkbox-tier-draft"
                    />
                    <Label
                      htmlFor="tier-draft"
                      className="text-sm font-normal text-muted-foreground"
                    >
                      Save as draft (don't show to seekers yet)
                      {!status?.chargesEnabled &&
                        " — required until Stripe is connected"}
                    </Label>
                  </div>
                  <Button
                    onClick={createTier}
                    disabled={
                      creating || (!status?.chargesEnabled && !newSaveAsDraft)
                    }
                    data-testid="button-add-tier"
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}{" "}
                    {newSaveAsDraft ? "Save draft" : "Add tier"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
