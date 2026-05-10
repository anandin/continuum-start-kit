import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ClipboardList, Trash2, Save } from "lucide-react";

interface Question {
  id: string;
  type: "text" | "scale" | "choice";
  prompt: string;
  options?: string[];
}
interface IntakeForm {
  id: string;
  title: string;
  description: string | null;
  questions: Question[];
  isActive: boolean;
  createdAt: string;
}

const newQuestion = (): Question => ({
  id: crypto.randomUUID(),
  type: "text",
  prompt: "",
});

export default function IntakeForms() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<IntakeForm | null>(null);
  const [draft, setDraft] = useState<{
    title: string;
    description: string;
    questions: Question[];
    isActive: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "provider")) navigate("/dashboard");
  }, [user, role, loading, navigate]);

  const { data: forms = [], isLoading } = useQuery<IntakeForm[]>({
    queryKey: ["/api/intake-forms"],
    enabled: !!user && role === "provider",
  });

  const startNew = () => {
    setEditing({
      id: "",
      title: "",
      description: null,
      questions: [newQuestion()],
      isActive: true,
      createdAt: "",
    });
    setDraft({
      title: "",
      description: "",
      questions: [newQuestion()],
      isActive: true,
    });
  };
  const startEdit = (f: IntakeForm) => {
    setEditing(f);
    setDraft({
      title: f.title,
      description: f.description || "",
      questions: f.questions || [],
      isActive: f.isActive,
    });
  };
  const cancelEdit = () => {
    setEditing(null);
    setDraft(null);
  };

  const save = async () => {
    if (!draft || !editing) return;
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: draft.title,
        description: draft.description,
        questions: draft.questions.filter((q) => q.prompt.trim()),
        isActive: draft.isActive,
      };
      if (editing.id) {
        await apiRequest("PUT", `/api/intake-forms/${editing.id}`, payload);
      } else {
        await apiRequest("POST", "/api/intake-forms", payload);
      }
      toast({ title: "Saved" });
      qc.invalidateQueries({ queryKey: ["/api/intake-forms"] });
      cancelEdit();
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

  const remove = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/intake-forms/${id}`);
      qc.invalidateQueries({ queryKey: ["/api/intake-forms"] });
    } catch (e: any) {
      toast({
        title: "Couldn't delete",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const updateQ = (i: number, patch: Partial<Question>) => {
    if (!draft) return;
    const qs = [...draft.questions];
    qs[i] = { ...qs[i], ...patch };
    setDraft({ ...draft, questions: qs });
  };
  const addQ = () =>
    draft &&
    setDraft({ ...draft, questions: [...draft.questions, newQuestion()] });
  const removeQ = (i: number) =>
    draft &&
    setDraft({
      ...draft,
      questions: draft.questions.filter((_, idx) => idx !== i),
    });

  return (
    <AppLayout
      title="Intake forms"
      subtitle="Welcome new clients with a tailored questionnaire"
    >
      {!editing && (
        <>
          <div className="flex justify-end mb-4">
            <Button onClick={startNew} data-testid="button-new-form">
              <Plus className="mr-2 h-4 w-4" /> New form
            </Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : forms.length === 0 ? (
            <Card className="shadow-warm">
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-foreground font-medium mb-1">
                  No intake forms yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Create one and seekers will fill it in during onboarding.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {forms.map((f) => (
                <Card
                  key={f.id}
                  className="shadow-warm animate-fade-in"
                  data-testid={`form-${f.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{f.title}</CardTitle>
                      <Badge variant={f.isActive ? "default" : "secondary"}>
                        {f.isActive ? "Active" : "Off"}
                      </Badge>
                    </div>
                    {f.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {f.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      {(f.questions || []).length} question
                      {(f.questions || []).length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(f)}
                        data-testid={`button-edit-${f.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(f.id)}
                        className="text-muted-foreground hover:text-destructive"
                        data-testid={`button-delete-${f.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {editing && draft && (
        <Card className="shadow-warm max-w-3xl mx-auto animate-fade-in">
          <CardHeader>
            <CardTitle>{editing.id ? "Edit form" : "New form"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                data-testid="input-form-title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={draft.isActive}
                onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
                data-testid="switch-active"
              />
              <Label className="cursor-pointer">
                Active (shown to new seekers)
              </Label>
            </div>
            <div className="space-y-3">
              <Label>Questions</Label>
              {draft.questions.map((q, i) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-border/60 p-3 space-y-2 bg-card/50"
                >
                  <div className="flex gap-2">
                    <Select
                      value={q.type}
                      onValueChange={(v) =>
                        updateQ(i, { type: v as Question["type"] })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="scale">Scale 1-5</SelectItem>
                        <SelectItem value="choice">Choice</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={q.prompt}
                      onChange={(e) => updateQ(i, { prompt: e.target.value })}
                      placeholder="Question..."
                      className="flex-1"
                      data-testid={`input-question-${i}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQ(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {q.type === "choice" && (
                    <Input
                      value={(q.options || []).join(", ")}
                      onChange={(e) =>
                        updateQ(i, {
                          options: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Options, comma separated"
                    />
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addQ}
                data-testid="button-add-question"
              >
                <Plus className="mr-2 h-4 w-4" /> Add question
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving || !draft.title.trim()}
                data-testid="button-save-form"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save form
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
