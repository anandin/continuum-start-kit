import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Plus, Trash2, RefreshCw, XCircle, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";

interface ScheduledSession {
  id: string;
  engagementId: string;
  providerId: string;
  seekerUserId: string;
  status: "proposed" | "confirmed" | "cancelled" | string;
  proposedSlots: string[];
  confirmedAt: string | null;
  timezone: string;
  durationMinutes: number;
  title: string;
  cancelReason: string | null;
  cancelledBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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

// datetime-local inputs are timezone-naive; we render the proposer's
// local wall time and serialize as UTC for the API. We always treat
// the input as the *provider's* local time (matches what they see).
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function nowPlusHours(h: number): string {
  const d = new Date(Date.now() + h * 3_600_000);
  d.setMinutes(0, 0, 0);
  return isoToLocalInput(d.toISOString());
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "confirmed"
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
      : status === "cancelled"
        ? "bg-muted text-muted-foreground border-border"
        : "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return (
    <Badge variant="outline" className={tone}>
      {status}
    </Badge>
  );
}

// Form for proposing a fresh set of 1-3 slots — used both for creating
// a new scheduled session and for rescheduling an existing one.
function ProposeForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel = "Send proposal",
}: {
  initial?: { slots: string[]; durationMinutes: number; title: string };
  onSubmit: (input: {
    slots: string[];
    durationMinutes: number;
    title: string;
    timezone: string;
  }) => void;
  onCancel?: () => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  const [slots, setSlots] = useState<string[]>(() => {
    if (initial?.slots?.length) return initial.slots.map(isoToLocalInput);
    return [nowPlusHours(24)];
  });
  const [duration, setDuration] = useState<number>(initial?.durationMinutes ?? 50);
  const [title, setTitle] = useState<string>(initial?.title ?? "Therapy session");

  const updateSlot = (i: number, value: string) =>
    setSlots((s) => s.map((v, idx) => (idx === i ? value : v)));
  const addSlot = () => setSlots((s) => (s.length >= 3 ? s : [...s, nowPlusHours(48)]));
  const removeSlot = (i: number) =>
    setSlots((s) => (s.length <= 1 ? s : s.filter((_, idx) => idx !== i)));

  const submit = () => {
    const isos = slots.map(localInputToIso).filter((v): v is string => !!v);
    if (isos.length === 0) {
      toast.error("Add at least one valid time slot");
      return;
    }
    if (isos.length > 3) {
      toast.error("Maximum of 3 slots");
      return;
    }
    onSubmit({
      slots: isos,
      durationMinutes: duration,
      title: title.trim() || "Therapy session",
      timezone: detectedTimezone(),
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Therapy session"
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input
          id="duration"
          type="number"
          min={15}
          max={240}
          step={5}
          value={duration}
          onChange={(e) => setDuration(Math.max(15, Math.min(240, Number(e.target.value) || 50)))}
        />
      </div>
      <div className="space-y-2">
        <Label>Time slots (1–3)</Label>
        {slots.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={value}
              onChange={(e) => updateSlot(i, e.target.value)}
              data-testid={`slot-input-${i}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeSlot(i)}
              disabled={slots.length <= 1}
              aria-label="Remove slot"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {slots.length < 3 && (
          <Button type="button" variant="outline" size="sm" onClick={addSlot}>
            <Plus className="mr-2 h-4 w-4" /> Add another time
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Times are in your local zone ({detectedTimezone()}). Your client will see them in theirs.
        </p>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Button onClick={submit} disabled={submitting} data-testid="submit-propose">
          {submitting ? "Sending..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function ScheduledRow({
  row,
  isPast,
  onReschedule,
  onCancel,
}: {
  row: ScheduledSession;
  isPast: boolean;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div
      className="rounded-lg border border-border/60 p-3 space-y-2"
      data-testid={`scheduled-${row.id}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-medium text-sm">{row.title}</p>
          <p className="text-xs text-muted-foreground">
            {row.durationMinutes}m · times shown in your zone ({detectedTimezone()})
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      {row.status === "confirmed" && row.confirmedAt ? (
        <p className="text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {fmtSlot(row.confirmedAt, detectedTimezone())}
        </p>
      ) : row.status === "proposed" ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Proposed slots:</p>
          {row.proposedSlots.map((s, i) => (
            <p key={i} className="text-sm">
              · {fmtSlot(s, detectedTimezone())}
            </p>
          ))}
        </div>
      ) : row.status === "cancelled" ? (
        <p className="text-xs text-muted-foreground">
          Cancelled{row.cancelReason ? ` — ${row.cancelReason}` : ""}
        </p>
      ) : null}
      {!isPast && row.status !== "cancelled" && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReschedule(row.id)}
            data-testid={`reschedule-${row.id}`}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Reschedule
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(row.id)}
            data-testid={`cancel-${row.id}`}
          >
            <XCircle className="mr-1 h-3 w-3" /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export function SchedulePanel({ engagementId }: { engagementId: string }) {
  const qc = useQueryClient();
  const queryKey = [`/api/engagements/${engagementId}/scheduled-sessions`];

  const { data, isLoading } = useQuery<{ scheduledSessions: ScheduledSession[] }>({
    queryKey,
    queryFn: async () =>
      (await apiRequest("GET", `/api/engagements/${engagementId}/scheduled-sessions`)).json(),
    enabled: !!engagementId,
  });

  const [showCompose, setShowCompose] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const rows = data?.scheduledSessions ?? [];
  const upcoming = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.status !== "cancelled" &&
          (r.status === "proposed" ||
            (r.confirmedAt && new Date(r.confirmedAt).getTime() > Date.now())),
      ),
    [rows],
  );
  const past = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.status === "cancelled" ||
          (r.status === "confirmed" &&
            r.confirmedAt &&
            new Date(r.confirmedAt).getTime() <= Date.now()),
      ),
    [rows],
  );

  const proposeMut = useMutation({
    mutationFn: async (input: {
      slots: string[];
      durationMinutes: number;
      title: string;
      timezone: string;
    }) =>
      (
        await apiRequest("POST", `/api/engagements/${engagementId}/scheduled-sessions`, {
          proposedSlots: input.slots,
          durationMinutes: input.durationMinutes,
          title: input.title,
          timezone: input.timezone,
        })
      ).json(),
    onSuccess: () => {
      toast.success("Proposed times sent to your client.");
      setShowCompose(false);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message || "Failed to propose times"),
  });

  const rescheduleMut = useMutation({
    mutationFn: async (input: {
      id: string;
      slots: string[];
      durationMinutes: number;
      title: string;
      timezone: string;
    }) =>
      (
        await apiRequest("POST", `/api/scheduled-sessions/${input.id}/reschedule`, {
          proposedSlots: input.slots,
          durationMinutes: input.durationMinutes,
          title: input.title,
          timezone: input.timezone,
        })
      ).json(),
    onSuccess: () => {
      toast.success("Reschedule sent — your client will pick a new time.");
      setRescheduleId(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message || "Failed to reschedule"),
  });

  const cancelMut = useMutation({
    mutationFn: async (input: { id: string; reason: string }) =>
      (
        await apiRequest("POST", `/api/scheduled-sessions/${input.id}/cancel`, {
          reason: input.reason,
        })
      ).json(),
    onSuccess: () => {
      toast.success("Session cancelled.");
      setCancelId(null);
      setCancelReason("");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message || "Failed to cancel"),
  });

  const rescheduleTarget = rows.find((r) => r.id === rescheduleId) ?? null;

  return (
    <div className="space-y-4">
      <Card className="shadow-warm">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Scheduled sessions
              </CardTitle>
              <CardDescription>
                Propose a few times — your client picks one, both sides get a calendar invite by email.
              </CardDescription>
            </div>
            {!showCompose && !rescheduleId && (
              <Button
                size="sm"
                onClick={() => setShowCompose(true)}
                data-testid="propose-new"
              >
                <Plus className="mr-1 h-4 w-4" /> Propose times
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCompose && (
            <div className="rounded-lg border border-border/60 p-4">
              <ProposeForm
                onSubmit={(v) => proposeMut.mutate(v)}
                onCancel={() => setShowCompose(false)}
                submitting={proposeMut.isPending}
              />
            </div>
          )}

          {rescheduleTarget && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
              <p className="text-sm font-medium mb-3">
                Rescheduling: {rescheduleTarget.title}
              </p>
              <ProposeForm
                initial={{
                  slots: rescheduleTarget.proposedSlots,
                  durationMinutes: rescheduleTarget.durationMinutes,
                  title: rescheduleTarget.title,
                }}
                onSubmit={(v) =>
                  rescheduleMut.mutate({ id: rescheduleTarget.id, ...v })
                }
                onCancel={() => setRescheduleId(null)}
                submitting={rescheduleMut.isPending}
                submitLabel="Send new times"
              />
            </div>
          )}

          {cancelId && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-medium">Cancel session</p>
              <Textarea
                placeholder="Reason (shared with your client)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                maxLength={500}
                data-testid="cancel-reason"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    cancelMut.mutate({
                      id: cancelId,
                      reason: cancelReason.trim() || "Cancelled by coach",
                    })
                  }
                  disabled={cancelMut.isPending}
                  data-testid="confirm-cancel"
                >
                  {cancelMut.isPending ? "Cancelling..." : "Cancel session"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCancelId(null);
                    setCancelReason("");
                  }}
                >
                  Keep session
                </Button>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Upcoming
            </h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming sessions. Use "Propose times" to send some options.
              </p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((row) => (
                  <ScheduledRow
                    key={row.id}
                    row={row}
                    isPast={false}
                    onReschedule={(id) => {
                      setRescheduleId(id);
                      setShowCompose(false);
                      setCancelId(null);
                    }}
                    onCancel={(id) => {
                      setCancelId(id);
                      setCancelReason("");
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Past & cancelled
              </h3>
              <div className="space-y-2">
                {past.slice(0, 10).map((row) => (
                  <ScheduledRow
                    key={row.id}
                    row={row}
                    isPast
                    onReschedule={() => {}}
                    onCancel={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
            <Mail className="h-3 w-3" />
            We send a real .ics calendar invite to both sides on confirm, reschedule, and cancel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
