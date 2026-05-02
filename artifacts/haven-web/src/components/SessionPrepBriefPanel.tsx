import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  ListChecks,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

interface BriefSections {
  whatsChanged?: string;
  suggestedOpening?: string;
  topicsToRevisit?: string[];
  safetyContext?: string;
}

interface SessionBriefDTO {
  id: string;
  engagementId: string;
  providerId: string;
  sections: BriefSections;
  status: "ready" | "templated_safety" | "failed" | string;
  safetyDecision: string | null;
  safetyReason: string | null;
  model: string | null;
  generatedAt: string | null;
  usedAt: string | null;
  usedInSessionId: string | null;
  createdAt: string | null;
}

interface LatestResponse {
  brief: SessionBriefDTO | null;
}

interface ListResponse {
  briefs: SessionBriefDTO[];
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatusBadge({ brief }: { brief: SessionBriefDTO }) {
  if (brief.status === "templated_safety") {
    return (
      <Badge variant="destructive" className="gap-1" data-testid="badge-brief-status">
        <ShieldAlert className="h-3 w-3" /> Withheld by safety gate
      </Badge>
    );
  }
  if (brief.status === "failed") {
    return (
      <Badge variant="secondary" className="gap-1" data-testid="badge-brief-status">
        <AlertTriangle className="h-3 w-3" /> Fallback (LLM unavailable)
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="gap-1" data-testid="badge-brief-status">
      <Sparkles className="h-3 w-3" /> AI brief
    </Badge>
  );
}

export function SessionPrepBriefPanel({ engagementId }: { engagementId: string }) {
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);

  const latestKey = useMemo(
    () => [`/api/engagements/${engagementId}/briefs/latest`] as const,
    [engagementId],
  );
  const historyKey = useMemo(
    () => [`/api/engagements/${engagementId}/briefs`] as const,
    [engagementId],
  );

  const latestQ = useQuery<LatestResponse>({
    queryKey: latestKey,
    queryFn: async () => {
      const res = await fetch(latestKey[0], { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load latest brief (${res.status})`);
      return res.json();
    },
  });

  const historyQ = useQuery<ListResponse>({
    queryKey: historyKey,
    queryFn: async () => {
      const res = await fetch(historyKey[0], { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load brief history (${res.status})`);
      return res.json();
    },
    enabled: showHistory,
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/engagements/${engagementId}/briefs/generate`,
        {},
      );
      return (await res.json()) as { brief: SessionBriefDTO };
    },
    onSuccess: (data) => {
      qc.setQueryData<LatestResponse>(latestKey, { brief: data.brief });
      qc.invalidateQueries({ queryKey: historyKey });
      if (data.brief.status === "templated_safety") {
        toast.warning("Brief was withheld by the safety gate. Review the audit log.");
      } else if (data.brief.status === "failed") {
        toast.warning("Used a fallback brief — the AI service was unavailable.");
      } else {
        toast.success("Fresh prep brief ready.");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Couldn't generate a brief.");
    },
  });

  const markUsedMut = useMutation({
    mutationFn: async (briefId: string) => {
      const res = await apiRequest("POST", `/api/briefs/${briefId}/used`, {});
      return (await res.json()) as { brief: SessionBriefDTO; alreadyUsed?: boolean };
    },
    // Once a brief is used, it should disappear from the active panel —
    // the backend's "latest" endpoint excludes used briefs, so we clear the
    // cache optimistically and refetch in case there's an older unused one
    // waiting. The history view (which keeps used briefs) is also refreshed.
    onSuccess: (data) => {
      qc.setQueryData<LatestResponse>(latestKey, { brief: null });
      qc.invalidateQueries({ queryKey: latestKey });
      qc.invalidateQueries({ queryKey: historyKey });
      toast.success(
        data.alreadyUsed ? "Already marked used." : "Marked as used in session.",
      );
    },
    onError: (err: any) => {
      toast.error(err?.message || "Couldn't mark brief as used.");
    },
  });

  const brief = latestQ.data?.brief ?? null;

  return (
    <div className="space-y-4">
      <Card className="shadow-warm-md" data-testid="card-prep-brief">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Session prep brief
              </CardTitle>
              <CardDescription>
                A short, AI-composed brief drawn from this client's recent sessions, mood,
                journal, goals, and safety signals. Saved between visits — refresh when
                you're about to meet.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => generateMut.mutate()}
                disabled={generateMut.isPending}
                data-testid="button-generate-brief"
              >
                {generateMut.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating…
                  </>
                ) : brief ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" /> Generate brief
                  </>
                )}
              </Button>
              {brief && !brief.usedAt && brief.status !== "failed" && (
                <Button
                  variant="outline"
                  onClick={() => markUsedMut.mutate(brief.id)}
                  disabled={markUsedMut.isPending}
                  data-testid="button-mark-brief-used"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Mark used
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {latestQ.isLoading ? (
            <div className="space-y-3" data-testid="loading-brief">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !brief ? (
            <div className="text-center py-10 text-muted-foreground" data-testid="empty-brief">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No brief yet for this client.</p>
              <p className="text-sm mt-1">
                Click <strong>Generate brief</strong> to compose one from recent context.
              </p>
            </div>
          ) : (
            <div className="space-y-5" data-testid="brief-body">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge brief={brief} />
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Generated {relTime(brief.generatedAt)}
                </span>
                {brief.usedAt && (
                  <Badge variant="outline" className="gap-1" data-testid="badge-brief-used">
                    <CheckCircle2 className="h-3 w-3" /> Used {relTime(brief.usedAt)}
                  </Badge>
                )}
                {brief.model && (
                  <span className="opacity-70">model: {brief.model}</span>
                )}
              </div>

              <BriefSection
                icon={<RefreshCw className="h-4 w-4" />}
                title="What's changed"
                body={brief.sections.whatsChanged}
                testId="brief-whats-changed"
              />
              <BriefSection
                icon={<MessageCircle className="h-4 w-4" />}
                title="Suggested opening"
                body={brief.sections.suggestedOpening}
                emphasis
                testId="brief-suggested-opening"
              />
              <BriefSection
                icon={<ListChecks className="h-4 w-4" />}
                title="Topics to revisit"
                bullets={brief.sections.topicsToRevisit}
                testId="brief-topics"
              />
              <BriefSection
                icon={<ShieldAlert className="h-4 w-4" />}
                title="Safety context"
                body={brief.sections.safetyContext}
                testId="brief-safety"
              />

              <p className="text-xs text-muted-foreground italic border-t pt-3">
                AI-composed assistive summary, not a clinical record. Verify against the
                source tabs (Sessions, Mood, Journal) before relying on it in session.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory((s) => !s)}
          data-testid="button-toggle-brief-history"
        >
          {showHistory ? "Hide" : "Show"} previous briefs
        </Button>
      </div>

      {showHistory && (
        <Card data-testid="card-brief-history">
          <CardHeader>
            <CardTitle className="text-base">Past briefs</CardTitle>
          </CardHeader>
          <CardContent>
            {historyQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !historyQ.data || historyQ.data.briefs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past briefs yet.</p>
            ) : (
              <ScrollArea className="max-h-[420px] pr-3">
                <ul className="space-y-3">
                  {historyQ.data.briefs.map((b) => (
                    <li
                      key={b.id}
                      className="border rounded-md p-3 text-sm"
                      data-testid={`brief-history-item-${b.id}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge brief={b} />
                        <span className="text-xs text-muted-foreground">
                          {relTime(b.generatedAt)}
                        </span>
                        {b.usedAt && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3" /> Used
                          </Badge>
                        )}
                      </div>
                      {b.sections.whatsChanged && (
                        <p className="mt-2 text-muted-foreground line-clamp-3">
                          {b.sections.whatsChanged}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BriefSection({
  icon,
  title,
  body,
  bullets,
  emphasis,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  bullets?: string[];
  emphasis?: boolean;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 uppercase tracking-wide mb-1.5">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {bullets && bullets.length > 0 ? (
        <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : body ? (
        <p
          className={
            emphasis
              ? "text-base text-foreground italic border-l-2 border-primary pl-3"
              : "text-sm text-foreground whitespace-pre-line"
          }
        >
          {body}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No content.</p>
      )}
    </div>
  );
}
