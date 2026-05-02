import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface ScheduledSession {
  id: string;
  status: "proposed" | "confirmed" | "cancelled" | string;
  proposedSlots: string[];
  confirmedAt: string | null;
  timezone: string;
  durationMinutes: number;
  title: string;
}

function detectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function fmtSlot(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

// Seeker-side scheduling card for the web dashboard. Mirrors the mobile
// ScheduledSessionsCard: confirm one of the coach's proposed slots,
// see the next confirmed session, or cancel-with-reason. We sync the
// browser's IANA timezone to the user record on mount so .ics emails
// render in their local zone.
export function SeekerScheduledSessionsCard() {
  const qc = useQueryClient();
  const tz = detectedTimezone();
  const [cancelOpenFor, setCancelOpenFor] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    apiRequest("PATCH", "/api/user/timezone", { timezone: tz }).catch(() => {});
  }, [tz]);

  // Tick every 30s so the "starts in Xm" text refreshes on its own.
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const sessionsQ = useQuery({
    queryKey: ["scheduled-sessions", "me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/scheduled-sessions");
      return (await res.json()) as { scheduledSessions: ScheduledSession[] };
    },
    refetchInterval: 60_000,
  });

  const confirmMut = useMutation({
    mutationFn: async ({ id, slot }: { id: string; slot: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/scheduled-sessions/${id}/confirm`,
        { slot, timezone: tz },
      );
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-sessions", "me"] });
      toast.success("Session confirmed — calendar invite emailed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/scheduled-sessions/${id}/cancel`,
        { reason },
      );
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-sessions", "me"] });
      setCancelOpenFor(null);
      setCancelReason("");
      toast.success("Session cancelled. Your coach has been notified.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = sessionsQ.data?.scheduledSessions ?? [];
  const proposed = useMemo(() => rows.filter((r) => r.status === "proposed"), [rows]);
  const upcomingConfirmed = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.status === "confirmed" &&
            r.confirmedAt &&
            new Date(r.confirmedAt).getTime() > Date.now(),
        )
        .sort(
          (a, b) =>
            new Date(a.confirmedAt!).getTime() -
            new Date(b.confirmedAt!).getTime(),
        ),
    [rows],
  );

  if (sessionsQ.isLoading) return null;
  if (proposed.length === 0 && upcomingConfirmed.length === 0) return null;

  return (
    <Card data-testid="seeker-schedule-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          Your sessions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingConfirmed.map((row) => {
          const ts = new Date(row.confirmedAt!).getTime();
          const minutes = Math.round((ts - Date.now()) / 60_000);
          const imminent = minutes <= 60;
          return (
            <div
              key={row.id}
              data-testid={`seeker-confirmed-${row.id}`}
              className="rounded-lg border border-border/60 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium text-sm">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.durationMinutes} min · times shown in your zone ({tz})
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                >
                  confirmed
                </Badge>
              </div>
              <p className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {fmtSlot(row.confirmedAt!, tz)}
                {imminent ? (
                  <span className="ml-2 text-xs font-semibold text-amber-700">
                    Starts in {Math.max(1, minutes)} min
                  </span>
                ) : null}
              </p>
              {cancelOpenFor === row.id ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Why do you need to cancel? (your coach will see this)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                    data-testid={`seeker-cancel-reason-${row.id}`}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!cancelReason.trim() || cancelMut.isPending}
                      onClick={() =>
                        cancelMut.mutate({ id: row.id, reason: cancelReason.trim() })
                      }
                      data-testid={`seeker-cancel-confirm-${row.id}`}
                    >
                      Cancel session
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCancelOpenFor(null);
                        setCancelReason("");
                      }}
                    >
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCancelOpenFor(row.id)}
                  data-testid={`seeker-cancel-${row.id}`}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          );
        })}

        {proposed.map((row) => (
          <div
            key={row.id}
            data-testid={`seeker-proposed-${row.id}`}
            className="rounded-lg border border-border/60 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-medium text-sm">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  Your coach proposed {row.proposedSlots.length} time
                  {row.proposedSlots.length === 1 ? "" : "s"} ·{" "}
                  {row.durationMinutes} min · zone: {tz}
                </p>
              </div>
              <Badge
                variant="outline"
                className="bg-amber-500/15 text-amber-700 border-amber-500/30"
              >
                pick a time
              </Badge>
            </div>
            <div className="space-y-1.5">
              {row.proposedSlots.map((slot) => (
                <Button
                  key={slot}
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  disabled={confirmMut.isPending}
                  onClick={() => confirmMut.mutate({ id: row.id, slot })}
                  data-testid={`seeker-pick-${row.id}-${slot}`}
                >
                  <span>{fmtSlot(slot, tz)}</span>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>
            {cancelOpenFor === row.id ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Reason for declining (your coach will see this)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  data-testid={`seeker-decline-reason-${row.id}`}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!cancelReason.trim() || cancelMut.isPending}
                    onClick={() =>
                      cancelMut.mutate({ id: row.id, reason: cancelReason.trim() })
                    }
                  >
                    Decline all
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCancelOpenFor(null);
                      setCancelReason("");
                    }}
                  >
                    Back
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setCancelOpenFor(row.id)}
                data-testid={`seeker-decline-${row.id}`}
              >
                None of these work — decline
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
