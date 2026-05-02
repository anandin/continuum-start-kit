import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Sparkles, AlertTriangle, Bell, Clock, MessageCircle, Check, ChevronRight, Inbox as InboxIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Severity = "critical" | "elevated" | "quiet";
type ReasonKind = "safety" | "alerts" | "no_contact" | "unread_messages";

interface InboxReason {
  kind: ReasonKind;
  label: string;
  timestamp: string | null;
}

interface InboxRow {
  engagementId: string;
  seekerUserId: string | null;
  seekerAlias: string;
  severity: Severity;
  reasons: InboxReason[];
  lastMessageAt: string | null;
  unreadAlertCount: number;
  latestSafetyEventAt: string | null;
  activeSessionId: string | null;
  dismissedUntil: string | null;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  elevated: "Elevated",
  quiet: "Quiet",
};

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  elevated: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  quiet: "bg-muted text-muted-foreground border-border",
};

const REASON_ICON: Record<ReasonKind, typeof AlertTriangle> = {
  safety: AlertTriangle,
  alerts: Bell,
  unread_messages: MessageCircle,
  no_contact: Clock,
};

export default function Inbox() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: rows = [], isLoading, isError, refetch } = useQuery<InboxRow[]>({
    queryKey: ["/api/coach/inbox"],
    refetchInterval: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: async (engagementId: string) => {
      await apiRequest("POST", `/api/coach/inbox/${engagementId}/handle`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/coach/inbox"] });
      qc.invalidateQueries({ queryKey: ["/api/alerts"] });
      qc.invalidateQueries({ queryKey: ["/api/alerts/unread-count"] });
      toast.success("Marked handled. We'll quiet this for 24h.");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Could not dismiss");
    },
  });

  const counts = useMemo(() => {
    const c = { critical: 0, elevated: 0, quiet: 0 };
    for (const r of rows) c[r.severity]++;
    return c;
  }, [rows]);

  const openEngagement = (row: InboxRow) => {
    if (row.activeSessionId) {
      navigate(`/chat/${row.activeSessionId}`);
    } else {
      navigate(`/provider/engagement/${row.engagementId}`);
    }
  };

  return (
    <AppLayout title="Inbox" subtitle="Today's triage — who needs your attention first">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className={SEVERITY_PILL.critical} data-testid="count-critical">
            <AlertTriangle className="mr-1 h-3 w-3" /> {counts.critical} critical
          </Badge>
          <Badge variant="outline" className={SEVERITY_PILL.elevated} data-testid="count-elevated">
            <Bell className="mr-1 h-3 w-3" /> {counts.elevated} elevated
          </Badge>
          <Badge variant="outline" className={SEVERITY_PILL.quiet} data-testid="count-quiet">
            <Clock className="mr-1 h-3 w-3" /> {counts.quiet} overdue check-in
          </Badge>
        </div>

        {isLoading ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">Loading your inbox…</Card>
        ) : isError ? (
          <Card className="p-10 text-center">
            <p className="mb-3 text-sm text-muted-foreground">We couldn't load your inbox.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
          </Card>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3" data-testid="inbox-list">
            {rows.map((row) => (
              <InboxCard
                key={row.engagementId}
                row={row}
                onOpen={() => openEngagement(row)}
                onDismiss={() => dismiss.mutate(row.engagementId)}
                dismissing={dismiss.isPending && dismiss.variables === row.engagementId}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function InboxCard({
  row,
  onOpen,
  onDismiss,
  dismissing,
}: {
  row: InboxRow;
  onOpen: () => void;
  onDismiss: () => void;
  dismissing: boolean;
}) {
  return (
    <Card
      className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:gap-4"
      data-testid={`inbox-row-${row.engagementId}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Badge variant="outline" className={SEVERITY_PILL[row.severity]} data-testid={`pill-${row.severity}`}>
          {SEVERITY_LABEL[row.severity]}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground" data-testid="text-alias">
            {row.seekerAlias}
          </p>
          <ul className="mt-1 space-y-0.5">
            {row.reasons.map((reason, idx) => {
              const Icon = REASON_ICON[reason.kind];
              return (
                <li
                  key={`${reason.kind}-${idx}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  data-testid={`reason-${reason.kind}`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{reason.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          disabled={dismissing}
          data-testid="button-handled"
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          Handled
        </Button>
        <Button size="sm" onClick={onOpen} data-testid="button-open">
          Open
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-3 p-12 text-center" data-testid="empty-state">
      <div className="rounded-full bg-primary/10 p-4 text-primary">
        <Sparkles className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-semibold">Inbox zero — nice work.</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Every client has been checked in on, no safety events need review, and there are no unread alerts.
        Take a breath.
      </p>
      <InboxIcon className="mt-1 h-6 w-6 text-muted-foreground/40" />
    </Card>
  );
}
