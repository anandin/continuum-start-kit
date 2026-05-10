import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Pencil,
  MessageSquareQuote,
  Send,
  Users,
} from "lucide-react";

interface JournalPrompt {
  id: string;
  text: string;
  category: string | null;
}

interface JournalEntry {
  id: string;
  body: string;
  promptId: string | null;
  sharedWithCoach: boolean;
  sharedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Journal() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [shareToggle, setShareToggle] = useState(false);
  const [shareConfirmEntry, setShareConfirmEntry] =
    useState<JournalEntry | null>(null);

  const promptsQ = useQuery<JournalPrompt[]>({
    queryKey: ["/api/journal/prompts/available"],
    queryFn: async () => {
      const res = await fetch("/api/journal/prompts/available", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load prompts");
      return res.json();
    },
  });

  const entriesQ = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal/entries/me"],
    queryFn: async () => {
      const res = await fetch("/api/journal/entries/me", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load entries");
      return res.json();
    },
  });

  const promptById = useMemo(() => {
    const map = new Map<string, JournalPrompt>();
    for (const p of promptsQ.data ?? []) map.set(p.id, p);
    return map;
  }, [promptsQ.data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/journal/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          body: body.trim(),
          promptId: selectedPromptId,
          sharedWithCoach: shareToggle,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to save entry");
      }
      return res.json() as Promise<JournalEntry>;
    },
    onSuccess: () => {
      setComposerOpen(false);
      setSelectedPromptId(null);
      setBody("");
      setShareToggle(false);
      qc.invalidateQueries({ queryKey: ["/api/journal/entries/me"] });
      toast({ title: "Entry saved" });
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't save",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/journal/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sharedWithCoach: true }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to share entry");
      }
      return res.json() as Promise<JournalEntry>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/journal/entries/me"] });
      setShareConfirmEntry(null);
      toast({ title: "Shared with coach" });
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't share",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const startNewEntry = (promptId: string | null) => {
    setSelectedPromptId(promptId);
    setBody("");
    setShareToggle(false);
    setComposerOpen(true);
  };

  const entries = entriesQ.data ?? [];
  const prompts = promptsQ.data ?? [];
  const canSave = body.trim().length > 0 && !createMutation.isPending;

  return (
    <AppLayout title="Journal" subtitle="A private space to reflect">
      <div className="space-y-6 max-w-3xl">
        <Card data-testid="card-journal-actions">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Reflect on your week
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Write freely. Share entries with your coach when you're ready.
                </p>
              </div>
              <Button
                onClick={() => startNewEntry(null)}
                data-testid="button-new-entry"
              >
                <Pencil className="h-4 w-4 mr-2" />
                New entry
              </Button>
            </div>

            {prompts.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Or start from a prompt
                </p>
                <div className="flex flex-wrap gap-2">
                  {prompts.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => startNewEntry(p.id)}
                      className="text-left max-w-xs text-sm border rounded-lg px-3 py-2 bg-card hover:bg-accent/30 transition-colors"
                      data-testid={`button-prompt-${p.id}`}
                    >
                      <span className="line-clamp-3">{p.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground px-1">
            Past entries
          </h3>

          {entriesQ.isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!entriesQ.isLoading && entries.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-10 border border-dashed rounded-lg">
              <BookOpen className="h-6 w-6 mx-auto mb-2 opacity-60" />
              No entries yet. Reflect on your week, a feeling, or something you
              want to bring to your next session.
            </div>
          )}

          {entries.map((e) => {
            const prompt = e.promptId ? promptById.get(e.promptId) : null;
            return (
              <Card key={e.id} data-testid={`entry-${e.id}`}>
                <CardContent className="pt-5 pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {e.sharedWithCoach && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Users className="h-3 w-3" />
                        Shared with coach
                      </Badge>
                    )}
                  </div>
                  {prompt && (
                    <div className="flex items-start gap-2 text-sm text-primary">
                      <MessageSquareQuote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{prompt.text}</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {e.body}
                  </p>
                  {!e.sharedWithCoach && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 -ml-2 text-primary"
                      onClick={() => setShareConfirmEntry(e)}
                      data-testid={`button-share-${e.id}`}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Share with coach
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New journal entry</DialogTitle>
            <DialogDescription>
              Take a moment to reflect. Only you will see this unless you choose
              to share it.
            </DialogDescription>
          </DialogHeader>

          {selectedPromptId && promptById.get(selectedPromptId) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-primary">
              <MessageSquareQuote className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{promptById.get(selectedPromptId)!.text}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="journal-body">Your reflection</Label>
            <Textarea
              id="journal-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write what's on your mind…"
              maxLength={10000}
              className="min-h-[200px]"
              data-testid="input-journal-body"
            />
          </div>

          <div className="flex items-start justify-between gap-4 p-3 border rounded-lg">
            <div className="flex-1">
              <Label htmlFor="share-toggle" className="text-sm font-medium">
                Share with coach
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Once shared, this entry can't be edited or unshared.
              </p>
            </div>
            <Switch
              id="share-toggle"
              checked={shareToggle}
              onCheckedChange={setShareToggle}
              data-testid="switch-share-with-coach"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canSave}
              data-testid="button-save-entry"
            >
              {createMutation.isPending ? "Saving…" : "Save entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!shareConfirmEntry}
        onOpenChange={(open) => !open && setShareConfirmEntry(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Share this entry with your coach?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Once shared, this entry can't be edited or unshared. Your coach
              will see it on their end.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (shareConfirmEntry)
                  shareMutation.mutate(shareConfirmEntry.id);
              }}
              data-testid="button-confirm-share"
            >
              Share
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
