import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, NotebookPen, Trash2, Lock } from "lucide-react";

interface ClientNote {
  id: string;
  content: string;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function NotesPanel({ engagementId }: { engagementId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: notes = [], isLoading } = useQuery<ClientNote[]>({
    queryKey: [`/api/engagements/${engagementId}/notes`],
    enabled: !!engagementId,
  });

  const add = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", `/api/engagements/${engagementId}/notes`, {
        content: draft,
      });
      setDraft("");
      qc.invalidateQueries({
        queryKey: [`/api/engagements/${engagementId}/notes`],
      });
    } catch (e: any) {
      toast({
        title: "Couldn't save note",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/notes/${id}`);
      qc.invalidateQueries({
        queryKey: [`/api/engagements/${engagementId}/notes`],
      });
    } catch (e: any) {
      toast({
        title: "Couldn't delete",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-warm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <NotebookPen className="h-4 w-4 text-primary" />
          Private notes
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
            <Lock className="h-3 w-3" /> Only you
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Capture an observation, hypothesis, or follow-up..."
            rows={3}
            data-testid="input-note"
          />
          <Button
            onClick={add}
            disabled={saving || !draft.trim()}
            size="sm"
            data-testid="button-add-note"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add note
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No notes yet.
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-border/60 bg-card/40 p-3"
                data-testid={`note-${n.id}`}
              >
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {n.content}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(n.id)}
                    className="h-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
