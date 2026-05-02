import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PersonaExample {
  id: string;
  source: string;
  scenario: string;
  approvedResponse: string;
  rejectedResponse: string | null;
  notes: string | null;
  tags: string[];
  weight: number;
  createdAt: string;
}

interface Playbook {
  id: string;
  title: string;
  description: string | null;
  isDefault: boolean;
  isArchived: boolean;
}

export default function PersonaLibrary() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams<{ playbookId?: string }>();
  const playbookId = params.playbookId ?? null;

  const [scenario, setScenario] = useState("");
  const [approvedResponse, setApprovedResponse] = useState("");
  const [tags, setTags] = useState("");

  const playbookQ = useQuery<Playbook>({
    queryKey: ["/api/twin/playbooks", playbookId],
    queryFn: async () => (await apiRequest("GET", `/api/twin/playbooks/${playbookId}`)).json(),
    enabled: !!playbookId,
  });

  const examplesQ = useQuery<PersonaExample[]>({
    queryKey: ["/api/twin/persona-examples", { playbookId }],
    queryFn: async () => {
      const url = playbookId
        ? `/api/twin/persona-examples?playbookId=${encodeURIComponent(playbookId)}`
        : `/api/twin/persona-examples`;
      return (await apiRequest("GET", url)).json();
    },
  });

  const createMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/twin/persona-examples", {
        scenario,
        approvedResponse,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        source: "manual",
        playbookId,
      })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/twin/persona-examples"] });
      setScenario(""); setApprovedResponse(""); setTags("");
      toast.success("Example added");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to add example"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/twin/persona-examples/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/twin/persona-examples"] });
      toast.success("Example removed");
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/twin/playbooks/${playbookId}/default`, {})).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/twin/playbooks"] });
      toast.success("Set as default playbook");
    },
  });

  const headerTitle = playbookQ.data?.title ?? (playbookId ? "Playbook" : "Persona Library (all examples)");
  const headerSubtitle = playbookId
    ? (playbookQ.data?.description ?? "Add the scenarios you want this playbook to handle.")
    : "Examples not assigned to any playbook (legacy).";

  return (
    <AppLayout title={headerTitle} subtitle={headerSubtitle}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/provider/twin/playbooks")}
            data-testid="button-back-to-playbooks"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> All playbooks
          </Button>
          {playbookQ.data?.isDefault && (
            <Badge variant="outline" className="border-amber-400 text-amber-700">
              <Star className="mr-1 h-3 w-3" /> Default playbook
            </Badge>
          )}
          {playbookQ.data && !playbookQ.data.isDefault && !playbookQ.data.isArchived && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDefaultMut.mutate()}
              disabled={setDefaultMut.isPending}
              data-testid="button-set-default-here"
            >
              <Star className="mr-1 h-4 w-4" /> Set as default
            </Button>
          )}
        </div>

        <Card className="shadow-warm-md">
          <CardHeader>
            <CardTitle className="text-base">Add an example</CardTitle>
            <CardDescription>
              Capture a scenario the AI should handle and how you'd respond.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="What might a client say? e.g. 'I'm scared I'm going to fail this interview tomorrow.'"
              rows={2}
              data-testid="input-scenario"
            />
            <Textarea
              value={approvedResponse}
              onChange={(e) => setApprovedResponse(e.target.value)}
              placeholder="How would you respond, in your own voice?"
              rows={3}
              data-testid="input-approved-response"
            />
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tags (comma-separated): anxiety, work, validation"
              data-testid="input-tags"
            />
            <div>
              <Button
                onClick={() => createMut.mutate()}
                disabled={!scenario || !approvedResponse || createMut.isPending}
                data-testid="button-add-example"
              >
                {createMut.isPending ? "Saving…" : "Add to playbook"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {examplesQ.isLoading && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Loading…</CardContent></Card>
          )}
          {!examplesQ.isLoading && examplesQ.data?.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground" data-testid="empty-examples">
              No examples yet. Add one above, or run a calibration session.
            </CardContent></Card>
          )}
          {examplesQ.data?.map((ex) => (
            <Card key={ex.id} className="shadow-warm-md" data-testid={`card-example-${ex.id}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{ex.source}</Badge>
                      {ex.tags?.map((t) => (
                        <Badge key={t} variant="secondary">{t}</Badge>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Client said</p>
                      <p className="text-sm text-foreground">{ex.scenario}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved response</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{ex.approvedResponse}</p>
                    </div>
                    {ex.rejectedResponse && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Avoid</p>
                        <p className="text-sm text-muted-foreground italic">{ex.rejectedResponse}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMut.mutate(ex.id)}
                    data-testid={`button-delete-${ex.id}`}
                    aria-label="Remove example"
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
