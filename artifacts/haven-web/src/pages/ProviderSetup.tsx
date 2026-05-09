import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Eye,
  Settings,
  ArrowLeft,
} from "lucide-react";
import TemplateSelector from "@/components/TemplateSelector";
import { ProviderTemplate } from "@/data/providerTemplates";
import { AppLayout } from "@/components/AppLayout";
import { Sparkles } from "lucide-react";

interface Stage {
  name: string;
  description: string;
}

interface TrajectoryRule {
  stage: string;
  indicator_type: "drift" | "leap" | "stall" | "steady";
  pattern: string;
  message: string;
}

export default function ProviderSetup() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(true);

  const [title, setTitle] = useState("");
  const [methodology, setMethodology] = useState("");
  const [stages, setStages] = useState<Stage[]>([
    { name: "", description: "" },
  ]);
  const [labels, setLabels] = useState<string[]>([""]);
  const [summaryTemplate, setSummaryTemplate] = useState<string[]>([
    "Session Overview: {summary}",
    "Current Stage: {stage}",
    "Key Insights: {insights}",
  ]);
  const [taggingRules, setTaggingRules] = useState("{}");
  const [trajectoryRules, setTrajectoryRules] = useState<TrajectoryRule[]>([
    { stage: "", indicator_type: "steady", pattern: "", message: "" },
  ]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    } else if (role && role !== "provider") {
      toast.error("Only providers can access this page");
      navigate("/dashboard");
    }
  }, [user, role, navigate]);

  useEffect(() => {
    if (user && role === "provider") {
      loadConfig();
    }
  }, [user, role]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/provider-config", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load config");
      const data = await res.json();

      if (data) {
        setHasExistingConfig(true);
        setShowTemplateSelector(false);
        setTitle(data.title || "");
        setMethodology(data.methodology || "");
        setStages(
          Array.isArray(data.stages)
            ? (data.stages as Stage[])
            : [{ name: "", description: "" }],
        );
        setLabels(
          Array.isArray(data.labels) ? (data.labels as string[]) : [""],
        );
        setSummaryTemplate(
          Array.isArray(data.summaryTemplate || data.summary_template)
            ? ((data.summaryTemplate || data.summary_template) as string[])
            : ["Session Overview: {summary}"],
        );
        setTaggingRules(
          typeof (data.taggingRules || data.tagging_rules) === "object"
            ? JSON.stringify(data.taggingRules || data.tagging_rules, null, 2)
            : "{}",
        );
        setTrajectoryRules(
          Array.isArray(data.trajectoryRules || data.trajectory_rules)
            ? ((data.trajectoryRules ||
                data.trajectory_rules) as TrajectoryRule[])
            : [
                {
                  stage: "",
                  indicator_type: "steady",
                  pattern: "",
                  message: "",
                },
              ],
        );
      } else {
        setShowTemplateSelector(true);
      }
    } catch (error: any) {
      console.error("Error loading config:", error);
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = async (template: ProviderTemplate) => {
    setTitle(template.title);
    setMethodology(template.methodology);
    setStages(template.stages);
    setLabels(template.labels);
    setSummaryTemplate(template.summaryTemplate);
    setTaggingRules(JSON.stringify(template.taggingRules, null, 2));
    setTrajectoryRules(template.trajectoryRules);
    setShowTemplateSelector(false);

    if (template.id !== "blank" && user) {
      try {
        const agentConfigData = {
          providerName: template.name.includes("Therapist")
            ? "Dr. Anya Sharma"
            : template.name.includes("Coach")
              ? "Marcus Sterling"
              : template.name.includes("Spiritual")
                ? "Rev. Elena Martinez"
                : template.name.includes("Lawyer")
                  ? "Atty. David Chen"
                  : "Professional Guide",
          providerTitle: template.title,
          coreIdentity: `You are a ${template.title} specializing in ${template.methodology}`,
          guidingPrinciples: `Methodology: ${template.methodology}\n\nGrowth Stages:\n${template.stages.map((s, i) => `${i + 1}. ${s.name}: ${s.description}`).join("\n")}\n\nFocus Areas: ${template.labels.join(", ")}`,
          tone: "Empathetic, supportive, professional, warm",
          voice: "A gentle guide and facilitator",
          rules:
            '1. Always listen actively before responding\n2. Ask reflective questions to deepen understanding\n3. Celebrate progress and growth\n4. Use "we" to foster collaboration',
          boundaries:
            "Focus on growth and development within your methodology. For crisis situations, direct to appropriate professional resources.",
          selectedModel: "google/gemini-2.5-flash",
        };

        await apiRequest("POST", "/api/provider-agent-config", agentConfigData);
        toast.success(
          `${template.name} template loaded and synced to agent config`,
        );
      } catch (error) {
        console.error("Error syncing to agent config:", error);
        toast.success(
          `${template.name} template loaded - visit Agent Setup to customize`,
        );
      }
    } else {
      toast.success(
        template.id === "blank"
          ? "Starting fresh!"
          : `${template.name} template loaded - customize as needed`,
      );
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (stages.length === 0 || !stages[0].name) {
      toast.error("At least one stage is required");
      return;
    }

    let parsedTaggingRules;
    try {
      parsedTaggingRules = JSON.parse(taggingRules);
    } catch {
      toast.error("Invalid JSON in tagging rules");
      return;
    }

    setSaving(true);
    try {
      const configData = {
        title: title.trim(),
        methodology: methodology.trim() || null,
        stages: stages.filter((s) => s.name.trim()),
        labels: labels.filter((l) => l.trim()),
        summaryTemplate: summaryTemplate.filter((t) => t.trim()),
        taggingRules: parsedTaggingRules,
        trajectoryRules: trajectoryRules.filter((r) => r.stage && r.pattern),
      };

      await apiRequest("POST", "/api/provider-config", configData);
      toast.success("Configuration saved successfully!");
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error(error.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => setStages([...stages, { name: "", description: "" }]);
  const removeStage = (index: number) =>
    setStages(stages.filter((_, i) => i !== index));
  const updateStage = (index: number, field: keyof Stage, value: string) => {
    const updated = [...stages];
    updated[index][field] = value;
    setStages(updated);
  };
  const moveStage = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stages.length) return;
    const updated = [...stages];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setStages(updated);
  };

  const addLabel = () => setLabels([...labels, ""]);
  const removeLabel = (index: number) =>
    setLabels(labels.filter((_, i) => i !== index));
  const updateLabel = (index: number, value: string) => {
    const updated = [...labels];
    updated[index] = value;
    setLabels(updated);
  };

  const addTemplate = () => setSummaryTemplate([...summaryTemplate, ""]);
  const removeTemplate = (index: number) =>
    setSummaryTemplate(summaryTemplate.filter((_, i) => i !== index));
  const updateTemplate = (index: number, value: string) => {
    const updated = [...summaryTemplate];
    updated[index] = value;
    setSummaryTemplate(updated);
  };

  const addTrajectoryRule = () =>
    setTrajectoryRules([
      ...trajectoryRules,
      { stage: "", indicator_type: "steady", pattern: "", message: "" },
    ]);
  const removeTrajectoryRule = (index: number) =>
    setTrajectoryRules(trajectoryRules.filter((_, i) => i !== index));
  const updateTrajectoryRule = (
    index: number,
    field: keyof TrajectoryRule,
    value: string,
  ) => {
    const updated = [...trajectoryRules];
    updated[index][field] = value as any;
    setTrajectoryRules(updated);
  };

  const generateMockPreview = () => {
    const mockData = {
      summary:
        "Client showed strong progress in communication skills and identified key blockers.",
      stage: stages[0]?.name || "N/A",
      insights:
        labels
          .slice(0, 3)
          .filter((l) => l)
          .join(", ") || "motivation, growth mindset, confidence",
    };

    return summaryTemplate
      .map((line) => {
        return line
          .replace("{summary}", mockData.summary)
          .replace("{stage}", mockData.stage)
          .replace("{insights}", mockData.insights);
      })
      .join("\n");
  };

  if (loading) {
    return (
      <AppLayout title="Settings">
        <div className="flex justify-center py-12" data-testid="loading-state">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (showTemplateSelector) {
    return <TemplateSelector onSelectTemplate={handleTemplateSelect} />;
  }

  return (
    <AppLayout
      title="Advanced settings"
      subtitle="Fine-tune your program — most providers prefer the setup chat"
    >
      <div className="space-y-6 animate-fade-in">
        <Card
          className="shadow-warm bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20"
          data-testid="card-rerun-cta"
        >
          <CardContent className="flex items-center justify-between gap-4 flex-wrap p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Prefer to talk it out?
                </p>
                <p className="text-sm text-muted-foreground">
                  Re-run the setup conversation and Haven will rewrite your
                  config.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="default"
                onClick={() => navigate("/provider/onboarding")}
                data-testid="button-rerun-setup"
              >
                <Sparkles className="mr-2 h-4 w-4" /> Re-run setup chat
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                variant="outline"
                data-testid="button-save-config"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Tell us about your coaching program
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Program Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Personal Growth Journey"
                    data-testid="input-title"
                  />
                </div>
                <div>
                  <Label htmlFor="methodology">Methodology</Label>
                  <Textarea
                    id="methodology"
                    value={methodology}
                    onChange={(e) => setMethodology(e.target.value)}
                    placeholder="Describe your coaching methodology..."
                    rows={4}
                    data-testid="input-methodology"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Growth Stages *</CardTitle>
                <CardDescription>
                  Define the progression stages in your program
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stages.map((stage, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-md border p-4"
                    data-testid={`stage-item-${index}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Label className="text-sm font-semibold">
                        Stage {index + 1}
                      </Label>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveStage(index, "up")}
                          disabled={index === 0}
                          data-testid={`button-move-stage-up-${index}`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveStage(index, "down")}
                          disabled={index === stages.length - 1}
                          data-testid={`button-move-stage-down-${index}`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeStage(index)}
                          disabled={stages.length === 1}
                          data-testid={`button-remove-stage-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <Input
                      placeholder="Stage name"
                      value={stage.name}
                      onChange={(e) =>
                        updateStage(index, "name", e.target.value)
                      }
                      data-testid={`input-stage-name-${index}`}
                    />
                    <Textarea
                      placeholder="Stage description"
                      value={stage.description}
                      onChange={(e) =>
                        updateStage(index, "description", e.target.value)
                      }
                      rows={2}
                      data-testid={`input-stage-description-${index}`}
                    />
                  </div>
                ))}
                <Button
                  onClick={addStage}
                  variant="outline"
                  className="w-full"
                  data-testid="button-add-stage"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stage
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Labels</CardTitle>
                <CardDescription>
                  Tags for categorizing insights and topics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {labels.map((label, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="e.g., motivation, skills, mindset"
                      value={label}
                      onChange={(e) => updateLabel(index, e.target.value)}
                      data-testid={`input-label-${index}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLabel(index)}
                      disabled={labels.length === 1}
                      data-testid={`button-remove-label-${index}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={addLabel}
                  variant="outline"
                  className="w-full"
                  data-testid="button-add-label"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Label
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary Template</CardTitle>
                <CardDescription>
                  Template for session summaries. Use {"{summary}"}, {"{stage}"}
                  , {"{insights}"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {summaryTemplate.map((line, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Template line..."
                      value={line}
                      onChange={(e) => updateTemplate(index, e.target.value)}
                      data-testid={`input-template-${index}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeTemplate(index)}
                      disabled={summaryTemplate.length === 1}
                      data-testid={`button-remove-template-${index}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={addTemplate}
                  variant="outline"
                  className="w-full"
                  data-testid="button-add-template"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Template Line
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tagging Rules (JSON)</CardTitle>
                <CardDescription>Rules for automatic tagging</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={taggingRules}
                  onChange={(e) => setTaggingRules(e.target.value)}
                  placeholder='{"keywords": ["growth", "mindset"], "patterns": []}'
                  rows={6}
                  className="font-mono text-sm"
                  data-testid="input-tagging-rules"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trajectory Rules</CardTitle>
                <CardDescription>
                  Define patterns for detecting progress indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {trajectoryRules.map((rule, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-md border p-4"
                    data-testid={`trajectory-rule-${index}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <Label className="text-sm font-semibold">
                        Rule {index + 1}
                      </Label>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeTrajectoryRule(index)}
                        data-testid={`button-remove-trajectory-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Stage</Label>
                        <Input
                          placeholder="Stage name"
                          value={rule.stage}
                          onChange={(e) =>
                            updateTrajectoryRule(index, "stage", e.target.value)
                          }
                          data-testid={`input-trajectory-stage-${index}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Indicator Type</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={rule.indicator_type}
                          onChange={(e) =>
                            updateTrajectoryRule(
                              index,
                              "indicator_type",
                              e.target.value,
                            )
                          }
                          data-testid={`select-trajectory-type-${index}`}
                        >
                          <option value="steady">Steady</option>
                          <option value="drift">Drift</option>
                          <option value="leap">Leap</option>
                          <option value="stall">Stall</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Pattern</Label>
                      <Input
                        placeholder="Pattern to detect"
                        value={rule.pattern}
                        onChange={(e) =>
                          updateTrajectoryRule(index, "pattern", e.target.value)
                        }
                        data-testid={`input-trajectory-pattern-${index}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Message</Label>
                      <Input
                        placeholder="Message to display"
                        value={rule.message}
                        onChange={(e) =>
                          updateTrajectoryRule(index, "message", e.target.value)
                        }
                        data-testid={`input-trajectory-message-${index}`}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  onClick={addTrajectoryRule}
                  variant="outline"
                  className="w-full"
                  data-testid="button-add-trajectory"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Trajectory Rule
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-24">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <CardTitle>Live Preview</CardTitle>
                </div>
                <CardDescription>
                  See how your session summary will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-md border bg-muted/50 p-4"
                  data-testid="text-preview"
                >
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {generateMockPreview()}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
