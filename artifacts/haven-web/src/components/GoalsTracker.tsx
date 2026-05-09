import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Target,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "paused";
  dueDate: string | null;
  createdAt: string;
}

interface GoalProgress {
  id: string;
  goalId: string;
  engagementId: string;
  seekerUserId: string;
  note: string | null;
  status: "pending" | "confirmed";
  createdAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
}

export function GoalsTracker({
  engagementId,
  readOnly,
}: {
  engagementId: string;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    dueDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: [`/api/engagements/${engagementId}/goals`],
    enabled: !!engagementId,
  });

  const { data: progress = [] } = useQuery<GoalProgress[]>({
    queryKey: [`/api/engagements/${engagementId}/goal-progress`],
    enabled: !!engagementId,
  });

  // Most-recent pending self-checkoff per goal — that's what we surface to
  // the coach as "your client says they did this."
  const pendingByGoal = new Map<string, GoalProgress>();
  for (const p of progress) {
    if (p.status !== "pending") continue;
    if (!pendingByGoal.has(p.goalId)) pendingByGoal.set(p.goalId, p);
  }

  const create = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", `/api/engagements/${engagementId}/goals`, {
        title: draft.title,
        description: draft.description || undefined,
        dueDate: draft.dueDate || undefined,
      });
      setDraft({ title: "", description: "", dueDate: "" });
      setShowAdd(false);
      qc.invalidateQueries({
        queryKey: [`/api/engagements/${engagementId}/goals`],
      });
    } catch (e: any) {
      toast({
        title: "Couldn't save",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (g: Goal) => {
    try {
      const newStatus = g.status === "completed" ? "active" : "completed";
      await apiRequest("PUT", `/api/goals/${g.id}`, { status: newStatus });
      qc.invalidateQueries({
        queryKey: [`/api/engagements/${engagementId}/goals`],
      });
      qc.invalidateQueries({
        queryKey: [`/api/engagements/${engagementId}/goal-progress`],
      });
    } catch (e: any) {
      toast({
        title: "Couldn't update",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const confirmProgress = async (p: GoalProgress) => {
    setConfirmingId(p.id);
    try {
      await apiRequest("POST", `/api/goal-progress/${p.id}/confirm`, {});
      qc.invalidateQueries({
        queryKey: [`/api/engagements/${engagementId}/goals`],
      });
      qc.invalidateQueries({
        queryKey: [`/api/engagements/${engagementId}/goal-progress`],
      });
      toast({
        title: "Goal confirmed",
        description: "Marked complete for your client.",
      });
    } catch (e: any) {
      toast({
        title: "Couldn't confirm",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setConfirmingId(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/goals/${id}`);
      qc.invalidateQueries({
        queryKey: [`/api/engagements/${engagementId}/goals`],
      });
      qc.invalidateQueries({
        queryKey: [`/api/engagements/${engagementId}/goal-progress`],
      });
    } catch (e: any) {
      toast({
        title: "Couldn't delete",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const pendingCount = pendingByGoal.size;

  return (
    <Card className="shadow-warm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          Goals
          {pendingCount > 0 && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
              data-testid="badge-pending-checkoffs"
            >
              <Clock className="h-3 w-3" /> {pendingCount} to confirm
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!readOnly && !showAdd && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdd(true)}
            data-testid="button-add-goal"
          >
            <Plus className="mr-2 h-4 w-4" /> Add a goal
          </Button>
        )}
        {!readOnly && showAdd && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3 bg-card/40">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Goal title"
              data-testid="input-goal-title"
            />
            <Textarea
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Optional description"
              rows={2}
            />
            <Input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={create}
                disabled={saving || !draft.title.trim()}
                data-testid="button-save-goal"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{" "}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAdd(false);
                  setDraft({ title: "", description: "", dueDate: "" });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No goals yet.
          </p>
        ) : (
          goals.map((g) => {
            const pending = pendingByGoal.get(g.id);
            return (
              <div
                key={g.id}
                className={`rounded-lg border p-3 ${g.status === "completed" ? "bg-muted/30 border-border/60 opacity-70" : pending ? "bg-primary/5 border-primary/40" : "bg-card/40 border-border/60"}`}
                data-testid={`goal-${g.id}`}
              >
                <div className="flex items-start gap-3">
                  {!readOnly && (
                    <Checkbox
                      checked={g.status === "completed"}
                      onCheckedChange={() => toggle(g)}
                      className="mt-0.5"
                      data-testid={`checkbox-goal-${g.id}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${g.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}
                    >
                      {g.title}
                    </p>
                    {g.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {g.description}
                      </p>
                    )}
                    {g.dueDate && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due{" "}
                        {new Date(g.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(g.id)}
                      className="h-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {pending && g.status !== "completed" && (
                  <div
                    className="mt-3 rounded-md border border-primary/30 bg-background/60 p-2.5 flex items-start gap-2"
                    data-testid={`pending-checkoff-${g.id}`}
                  >
                    <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">
                        Your client says they completed this
                        {pending.createdAt && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {new Date(pending.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                      {pending.note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{pending.note}"
                        </p>
                      )}
                    </div>
                    {!readOnly && (
                      <Button
                        size="sm"
                        onClick={() => confirmProgress(pending)}
                        disabled={confirmingId === pending.id}
                        data-testid={`button-confirm-checkoff-${g.id}`}
                        className="h-7 px-2 text-xs"
                      >
                        {confirmingId === pending.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Confirm
                            complete
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
