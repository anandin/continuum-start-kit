import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Target, Trash2, Calendar } from "lucide-react";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "paused";
  dueDate: string | null;
  createdAt: string;
}

export function GoalsTracker({ engagementId, readOnly }: { engagementId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", dueDate: "" });
  const [saving, setSaving] = useState(false);

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: [`/api/engagements/${engagementId}/goals`],
    enabled: !!engagementId,
  });

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
      qc.invalidateQueries({ queryKey: [`/api/engagements/${engagementId}/goals`] });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const toggle = async (g: Goal) => {
    try {
      const newStatus = g.status === "completed" ? "active" : "completed";
      await apiRequest("PUT", `/api/goals/${g.id}`, { status: newStatus });
      qc.invalidateQueries({ queryKey: [`/api/engagements/${engagementId}/goals`] });
    } catch (e: any) { toast({ title: "Couldn't update", description: e.message, variant: "destructive" }); }
  };

  const remove = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/goals/${id}`);
      qc.invalidateQueries({ queryKey: [`/api/engagements/${engagementId}/goals`] });
    } catch (e: any) { toast({ title: "Couldn't delete", description: e.message, variant: "destructive" }); }
  };

  return (
    <Card className="shadow-warm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          Goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!readOnly && !showAdd && (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-goal">
            <Plus className="mr-2 h-4 w-4" /> Add a goal
          </Button>
        )}
        {!readOnly && showAdd && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3 bg-card/40">
            <Input
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder="Goal title"
              data-testid="input-goal-title"
            />
            <Textarea
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
            />
            <Input
              type="date"
              value={draft.dueDate}
              onChange={e => setDraft({ ...draft, dueDate: e.target.value })}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={create} disabled={saving || !draft.title.trim()} data-testid="button-save-goal">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setDraft({ title: "", description: "", dueDate: "" }); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No goals yet.</p>
        ) : (
          goals.map(g => (
            <div
              key={g.id}
              className={`flex items-start gap-3 rounded-lg border border-border/60 p-3 ${g.status === "completed" ? "bg-muted/30 opacity-70" : "bg-card/40"}`}
              data-testid={`goal-${g.id}`}
            >
              {!readOnly && (
                <Checkbox
                  checked={g.status === "completed"}
                  onCheckedChange={() => toggle(g)}
                  className="mt-0.5"
                  data-testid={`checkbox-goal-${g.id}`}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${g.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>{g.title}</p>
                {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                {g.dueDate && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Due {new Date(g.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              {!readOnly && (
                <Button variant="ghost" size="sm" onClick={() => remove(g.id)} className="h-7 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
