import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Save, Eye } from 'lucide-react';
import TemplateSelector from '@/components/TemplateSelector';
import { ProviderTemplate } from '@/data/providerTemplates';

interface Stage {
  name: string;
  description: string;
}

interface TrajectoryRule {
  stage: string;
  indicator_type: 'drift' | 'leap' | 'stall' | 'steady';
  pattern: string;
  message: string;
}

export default function ProviderSetup() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(true);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [methodology, setMethodology] = useState('');
  const [stages, setStages] = useState<Stage[]>([{ name: '', description: '' }]);
  const [labels, setLabels] = useState<string[]>(['']);
  const [summaryTemplate, setSummaryTemplate] = useState<string[]>(['Session Overview: {summary}', 'Current Stage: {stage}', 'Key Insights: {insights}']);
  const [taggingRules, setTaggingRules] = useState('{}');
  const [trajectoryRules, setTrajectoryRules] = useState<TrajectoryRule[]>([
    { stage: '', indicator_type: 'steady', pattern: '', message: '' }
  ]);

  // Redirect non-providers
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (role && role !== 'provider') {
      toast.error('Only providers can access this page');
      navigate('/dashboard');
    }
  }, [user, role, navigate]);

  // Load existing config
  useEffect(() => {
    if (user && role === 'provider') {
      loadConfig();
    }
  }, [user, role]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('provider_configs')
        .select('*')
        .eq('provider_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setHasExistingConfig(true);
        setShowTemplateSelector(false);
        setConfigId(data.id);
        setTitle(data.title || '');
        setMethodology(data.methodology || '');
        setStages(Array.isArray(data.stages) ? data.stages as unknown as Stage[] : [{ name: '', description: '' }]);
        setLabels(Array.isArray(data.labels) ? data.labels as string[] : ['']);
        setSummaryTemplate(Array.isArray(data.summary_template) ? data.summary_template as string[] : ['Session Overview: {summary}']);
        setTaggingRules(typeof data.tagging_rules === 'object' ? JSON.stringify(data.tagging_rules, null, 2) : '{}');
        setTrajectoryRules(Array.isArray(data.trajectory_rules) ? data.trajectory_rules as unknown as TrajectoryRule[] : [{ stage: '', indicator_type: 'steady', pattern: '', message: '' }]);
      } else {
        setShowTemplateSelector(true);
      }
    } catch (error: any) {
      console.error('Error loading config:', error);
      toast.error('Failed to load configuration');
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
    
    // Auto-sync template data to agent config
    if (template.id !== 'blank' && user) {
      try {
        const agentConfigData = {
          provider_id: user.id,
          provider_name: template.name.includes('Therapist') ? 'Dr. Anya Sharma' 
            : template.name.includes('Coach') ? 'Marcus Sterling'
            : template.name.includes('Spiritual') ? 'Rev. Elena Martinez'
            : template.name.includes('Lawyer') ? 'Atty. David Chen'
            : 'Professional Guide',
          provider_title: template.title,
          core_identity: `You are a ${template.title} specializing in ${template.methodology}`,
          guiding_principles: `Methodology: ${template.methodology}\n\nGrowth Stages:\n${template.stages.map((s, i) => `${i + 1}. ${s.name}: ${s.description}`).join('\n')}\n\nFocus Areas: ${template.labels.join(', ')}`,
          tone: 'Empathetic, supportive, professional, warm',
          voice: 'A gentle guide and facilitator',
          rules: '1. Always listen actively before responding\n2. Ask reflective questions to deepen understanding\n3. Celebrate progress and growth\n4. Use "we" to foster collaboration',
          boundaries: 'Focus on growth and development within your methodology. For crisis situations, direct to appropriate professional resources.',
          selected_model: 'google/gemini-2.5-flash',
          updated_at: new Date().toISOString(),
        };

        // Check if agent config exists
        const { data: existingConfig } = await supabase
          .from('provider_agent_configs')
          .select('id')
          .eq('provider_id', user.id)
          .maybeSingle();

        if (existingConfig) {
          // Update existing
          await supabase
            .from('provider_agent_configs')
            .update(agentConfigData)
            .eq('id', existingConfig.id);
        } else {
          // Insert new
          await supabase
            .from('provider_agent_configs')
            .insert(agentConfigData);
        }
        
        toast.success(`${template.name} template loaded and synced to agent config`);
      } catch (error) {
        console.error('Error syncing to agent config:', error);
        toast.success(`${template.name} template loaded - visit Agent Setup to customize`);
      }
    } else {
      toast.success(template.id === 'blank' ? 'Starting fresh!' : `${template.name} template loaded - customize as needed`);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (stages.length === 0 || !stages[0].name) {
      toast.error('At least one stage is required');
      return;
    }

    let parsedTaggingRules;
    try {
      parsedTaggingRules = JSON.parse(taggingRules);
    } catch {
      toast.error('Invalid JSON in tagging rules');
      return;
    }

    setSaving(true);
    try {
      const configData = {
        provider_id: user?.id,
        title: title.trim(),
        methodology: methodology.trim() || null,
        stages: stages.filter(s => s.name.trim()) as any,
        labels: labels.filter(l => l.trim()) as any,
        summary_template: summaryTemplate.filter(t => t.trim()) as any,
        tagging_rules: parsedTaggingRules as any,
        trajectory_rules: trajectoryRules.filter(r => r.stage && r.pattern) as any,
      };

      let error;
      if (configId) {
        // Update existing
        const result = await supabase
          .from('provider_configs')
          .update(configData)
          .eq('id', configId);
        error = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from('provider_configs')
          .insert(configData)
          .select()
          .single();
        error = result.error;
        if (!error && result.data) {
          setConfigId(result.data.id);
        }
      }

      if (error) throw error;

      toast.success('Configuration saved successfully!');
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Stage handlers
  const addStage = () => setStages([...stages, { name: '', description: '' }]);
  const removeStage = (index: number) => setStages(stages.filter((_, i) => i !== index));
  const updateStage = (index: number, field: keyof Stage, value: string) => {
    const updated = [...stages];
    updated[index][field] = value;
    setStages(updated);
  };
  const moveStage = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stages.length) return;
    const updated = [...stages];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setStages(updated);
  };

  // Label handlers
  const addLabel = () => setLabels([...labels, '']);
  const removeLabel = (index: number) => setLabels(labels.filter((_, i) => i !== index));
  const updateLabel = (index: number, value: string) => {
    const updated = [...labels];
    updated[index] = value;
    setLabels(updated);
  };

  // Summary template handlers
  const addTemplate = () => setSummaryTemplate([...summaryTemplate, '']);
  const removeTemplate = (index: number) => setSummaryTemplate(summaryTemplate.filter((_, i) => i !== index));
  const updateTemplate = (index: number, value: string) => {
    const updated = [...summaryTemplate];
    updated[index] = value;
    setSummaryTemplate(updated);
  };

  // Trajectory rule handlers
  const addTrajectoryRule = () => setTrajectoryRules([...trajectoryRules, { stage: '', indicator_type: 'steady', pattern: '', message: '' }]);
  const removeTrajectoryRule = (index: number) => setTrajectoryRules(trajectoryRules.filter((_, i) => i !== index));
  const updateTrajectoryRule = (index: number, field: keyof TrajectoryRule, value: string) => {
    const updated = [...trajectoryRules];
    updated[index][field] = value as any;
    setTrajectoryRules(updated);
  };

  // Generate mock preview
  const generateMockPreview = () => {
    const mockData = {
      summary: 'Client showed strong progress in communication skills and identified key blockers.',
      stage: stages[0]?.name || 'N/A',
      insights: labels.slice(0, 3).filter(l => l).join(', ') || 'motivation, growth mindset, confidence'
    };

    return summaryTemplate.map(line => {
      return line
        .replace('{summary}', mockData.summary)
        .replace('{stage}', mockData.stage)
        .replace('{insights}', mockData.insights);
    }).join('\n');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (showTemplateSelector) {
    return <TemplateSelector onSelectTemplate={handleTemplateSelect} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Provider Setup</h1>
            <p className="text-sm text-slate-400">Configure your coaching program</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard')} className="border-white/20 bg-white/5 text-white hover:bg-white/10">
              Back to Dashboard
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/50">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form Column */}
          <div className="space-y-6">
            {/* Basic Info */}
            <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Program Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Personal Growth Journey"
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
                  />
                </div>
              </CardContent>
            </Card>

            {/* Stages */}
            <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Growth Stages *</CardTitle>
                <CardDescription className="text-slate-400">Define the progression stages in your program</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stages.map((stage, index) => (
                  <div key={index} className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Stage {index + 1}</Label>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveStage(index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveStage(index, 'down')}
                          disabled={index === stages.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeStage(index)}
                          disabled={stages.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <Input
                      placeholder="Stage name"
                      value={stage.name}
                      onChange={(e) => updateStage(index, 'name', e.target.value)}
                    />
                    <Textarea
                      placeholder="Stage description"
                      value={stage.description}
                      onChange={(e) => updateStage(index, 'description', e.target.value)}
                      rows={2}
                    />
                  </div>
                ))}
                <Button onClick={addStage} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stage
                </Button>
              </CardContent>
            </Card>

            {/* Labels */}
            <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Labels</CardTitle>
                <CardDescription className="text-slate-400">Tags for categorizing insights and topics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {labels.map((label, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="e.g., motivation, skills, mindset"
                      value={label}
                      onChange={(e) => updateLabel(index, e.target.value)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLabel(index)}
                      disabled={labels.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button onClick={addLabel} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Label
                </Button>
              </CardContent>
            </Card>

            {/* Summary Template */}
            <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Summary Template</CardTitle>
                <CardDescription className="text-slate-400">
                  Template for session summaries. Use {'{summary}'}, {'{stage}'}, {'{insights}'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {summaryTemplate.map((line, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Template line..."
                      value={line}
                      onChange={(e) => updateTemplate(index, e.target.value)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeTemplate(index)}
                      disabled={summaryTemplate.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button onClick={addTemplate} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Template Line
                </Button>
              </CardContent>
            </Card>

            {/* Tagging Rules */}
            <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Tagging Rules (JSON)</CardTitle>
                <CardDescription className="text-slate-400">Rules for automatic tagging</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={taggingRules}
                  onChange={(e) => setTaggingRules(e.target.value)}
                  placeholder='{"keywords": ["growth", "mindset"], "patterns": []}'
                  rows={6}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>

            {/* Trajectory Rules */}
            <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Trajectory Rules</CardTitle>
                <CardDescription className="text-slate-400">Define patterns for detecting progress indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {trajectoryRules.map((rule, index) => (
                  <div key={index} className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Rule {index + 1}</Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTrajectoryRule(index)}
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
                          onChange={(e) => updateTrajectoryRule(index, 'stage', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Indicator Type</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={rule.indicator_type}
                          onChange={(e) => updateTrajectoryRule(index, 'indicator_type', e.target.value)}
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
                        onChange={(e) => updateTrajectoryRule(index, 'pattern', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Message</Label>
                      <Input
                        placeholder="Message to display"
                        value={rule.message}
                        onChange={(e) => updateTrajectoryRule(index, 'message', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                <Button onClick={addTrajectoryRule} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Trajectory Rule
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Preview Column */}
          <div className="space-y-6">
            <Card className="bg-slate-900/50 border-white/10 backdrop-blur sticky top-24">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-purple-400" />
                  <CardTitle className="text-white">Live Preview</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  See how your session summary will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                  <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono">
                    {generateMockPreview()}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
