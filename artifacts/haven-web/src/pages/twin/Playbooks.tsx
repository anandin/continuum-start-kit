import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookOpen, Copy, Star, Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

interface Playbook {
  id: string;
  title: string;
  description: string | null;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Playbooks() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState<Playbook | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const playbooksQ = useQuery<Playbook[]>({
    queryKey: ["/api/twin/playbooks", showArchived],
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/twin/playbooks${showArchived ? "?includeArchived=true" : ""}`,
        )
      ).json(),
  });

  const createMut = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/twin/playbooks", {
          title: newTitle,
          description: newDescription || null,
        })
      ).json(),
    onSuccess: (created: Playbook) => {
      qc.invalidateQueries({ queryKey: ["/api/twin/playbooks"] });
      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      toast.success("Playbook created");
      navigate(`/provider/twin/playbooks/${created.id}`);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to create playbook"),
  });

  const renameMut = useMutation({
    mutationFn: async (vars: {
      id: string;
      title: string;
      description: string | null;
    }) =>
      (
        await apiRequest("PATCH", `/api/twin/playbooks/${vars.id}`, {
          title: vars.title,
          description: vars.description,
        })
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/twin/playbooks"] });
      setRenameOpen(null);
      toast.success("Playbook updated");
    },
  });

  const duplicateMut = useMutation({
    mutationFn: async (id: string) =>
      (
        await apiRequest("POST", `/api/twin/playbooks/${id}/duplicate`, {})
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/twin/playbooks"] });
      toast.success("Playbook duplicated");
    },
  });

  const archiveMut = useMutation({
    mutationFn: async (vars: { id: string; isArchived: boolean }) =>
      (
        await apiRequest("PATCH", `/api/twin/playbooks/${vars.id}`, {
          isArchived: vars.isArchived,
        })
      ).json(),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/twin/playbooks"] });
      toast.success(
        vars.isArchived ? "Playbook archived" : "Playbook restored",
      );
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: async (id: string) =>
      (
        await apiRequest("POST", `/api/twin/playbooks/${id}/default`, {})
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/twin/playbooks"] });
      toast.success("Default playbook updated");
    },
  });

  const playbooks = playbooksQ.data ?? [];

  return (
    <AppLayout
      title="Playbooks"
      subtitle="Reusable bundles of approved examples that shape how the AI talks to each client."
    >
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={showArchived ? "outline" : "ghost"}
              size="sm"
              onClick={() => setShowArchived(false)}
              data-testid="filter-active"
            >
              Active
            </Button>
            <Button
              variant={showArchived ? "ghost" : "outline"}
              size="sm"
              onClick={() => setShowArchived(true)}
              data-testid="filter-include-archived"
            >
              Include archived
            </Button>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-playbook">
                <Plus className="mr-2 h-4 w-4" /> New playbook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New playbook</DialogTitle>
                <DialogDescription>
                  A playbook is a named bundle of approved examples. You'll add
                  scenarios after creating it.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Title
                  </label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. First-session intake"
                    data-testid="input-new-title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Description (optional)
                  </label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="When does this playbook apply?"
                    rows={3}
                    data-testid="input-new-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={!newTitle.trim() || createMut.isPending}
                  data-testid="button-create-playbook"
                >
                  {createMut.isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {playbooksQ.isLoading && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading playbooks…
            </CardContent>
          </Card>
        )}

        {!playbooksQ.isLoading && playbooks.length === 0 && (
          <Card>
            <CardContent
              className="p-12 text-center text-muted-foreground"
              data-testid="empty-playbooks"
            >
              <BookOpen className="mx-auto h-10 w-10 mb-3 opacity-50" />
              No playbooks yet. Create one to get started.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {playbooks.map((pb) => (
            <Card
              key={pb.id}
              className={`shadow-warm-md ${pb.isArchived ? "opacity-60" : ""}`}
              data-testid={`card-playbook-${pb.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <button
                        className="text-left hover:underline truncate"
                        onClick={() =>
                          navigate(`/provider/twin/playbooks/${pb.id}`)
                        }
                        data-testid={`link-open-${pb.id}`}
                      >
                        {pb.title}
                      </button>
                      {pb.isDefault && (
                        <Badge
                          variant="outline"
                          className="border-amber-400 text-amber-700"
                        >
                          <Star className="mr-1 h-3 w-3" /> Default
                        </Badge>
                      )}
                      {pb.isArchived && (
                        <Badge variant="outline">Archived</Badge>
                      )}
                    </CardTitle>
                    {pb.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {pb.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/provider/twin/playbooks/${pb.id}`)
                    }
                    data-testid={`button-edit-${pb.id}`}
                  >
                    Open editor
                  </Button>
                  {!pb.isDefault && !pb.isArchived && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDefaultMut.mutate(pb.id)}
                      disabled={setDefaultMut.isPending}
                      data-testid={`button-set-default-${pb.id}`}
                    >
                      <Star className="mr-1 h-4 w-4" /> Set default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenameOpen(pb);
                      setNewTitle(pb.title);
                      setNewDescription(pb.description ?? "");
                    }}
                    data-testid={`button-rename-${pb.id}`}
                  >
                    <Pencil className="mr-1 h-4 w-4" /> Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => duplicateMut.mutate(pb.id)}
                    disabled={duplicateMut.isPending}
                    data-testid={`button-duplicate-${pb.id}`}
                  >
                    <Copy className="mr-1 h-4 w-4" /> Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      archiveMut.mutate({
                        id: pb.id,
                        isArchived: !pb.isArchived,
                      })
                    }
                    disabled={
                      archiveMut.isPending || (pb.isDefault && !pb.isArchived)
                    }
                    title={
                      pb.isDefault && !pb.isArchived
                        ? "Pick a different default first"
                        : ""
                    }
                    data-testid={`button-archive-${pb.id}`}
                  >
                    <Archive className="mr-1 h-4 w-4" />{" "}
                    {pb.isArchived ? "Restore" : "Archive"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog
        open={!!renameOpen}
        onOpenChange={(o) => {
          if (!o) setRenameOpen(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename playbook</DialogTitle>
            <DialogDescription>
              Update the title and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              data-testid="input-rename-title"
            />
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              data-testid="input-rename-description"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                renameOpen &&
                renameMut.mutate({
                  id: renameOpen.id,
                  title: newTitle,
                  description: newDescription || null,
                })
              }
              disabled={!newTitle.trim() || renameMut.isPending}
              data-testid="button-save-rename"
            >
              {renameMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
