import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, User, Sparkles, ArrowLeft, Bot } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';

export default function AgentSetup() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [providerConfig, setProviderConfig] = useState<any>(null);
  
  const [providerName, setProviderName] = useState('');
  const [providerTitle, setProviderTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coreIdentity, setCoreIdentity] = useState('');
  const [guidingPrinciples, setGuidingPrinciples] = useState('');
  const [tone, setTone] = useState('');
  const [voice, setVoice] = useState('');
  const [rules, setRules] = useState('');
  const [boundaries, setBoundaries] = useState('');
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-flash');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (role && role !== 'provider') {
      toast.error('Only providers can access this page');
      navigate('/dashboard');
    }
  }, [user, role, navigate]);

  useEffect(() => {
    if (user && role === 'provider') {
      loadBothConfigs();
    }
  }, [user, role]);

  const loadBothConfigs = async () => {
    setLoading(true);
    try {
      const [providerRes, agentRes] = await Promise.all([
        fetch('/api/provider-config', { credentials: 'include' }),
        fetch('/api/provider-agent-config', { credentials: 'include' }),
      ]);

      let providerConfigData = null;
      if (providerRes.ok) {
        providerConfigData = await providerRes.json();
        if (providerConfigData) {
          setProviderConfig(providerConfigData);
        }
      }

      if (!agentRes.ok) throw new Error('Failed to load agent config');
      const agentConfigData = await agentRes.json();

      if (agentConfigData) {
        setHasExistingConfig(true);
        setProviderName(agentConfigData.providerName || agentConfigData.provider_name || '');
        setProviderTitle(agentConfigData.providerTitle || agentConfigData.provider_title || '');
        setAvatarUrl(agentConfigData.avatarUrl || agentConfigData.avatar_url || '');
        setCoreIdentity(agentConfigData.coreIdentity || agentConfigData.core_identity || '');
        setGuidingPrinciples(agentConfigData.guidingPrinciples || agentConfigData.guiding_principles || '');
        setTone(agentConfigData.tone || '');
        setVoice(agentConfigData.voice || '');
        setRules(agentConfigData.rules || '');
        setBoundaries(agentConfigData.boundaries || '');
        setSelectedModel(agentConfigData.selectedModel || agentConfigData.selected_model || 'google/gemini-2.5-flash');
      } else if (providerConfigData) {
        const autoPopulated = generateGuidingPrinciplesFromConfig(providerConfigData);
        setGuidingPrinciples(autoPopulated);
        setProviderTitle(providerConfigData.title || '');
        setCoreIdentity(`You are an AI coaching assistant for ${providerConfigData.title}.`);
      }
    } catch (error: any) {
      console.error('Error loading configs:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const generateGuidingPrinciplesFromConfig = (config: any) => {
    let text = '';
    if (config.methodology) {
      text += `Methodology: ${config.methodology}\n\n`;
    }
    if (config.stages && Array.isArray(config.stages)) {
      text += `Growth Stages:\n`;
      config.stages.forEach((stage: any, index: number) => {
        text += `${index + 1}. ${stage.name}: ${stage.description}\n`;
      });
      text += '\n';
    }
    if (config.labels && Array.isArray(config.labels)) {
      text += `Focus Areas: ${config.labels.join(', ')}\n`;
    }
    return text;
  };

  const handleSave = async () => {
    if (!guidingPrinciples.trim()) {
      toast.error('Please add guiding principles for your AI agent');
      return;
    }

    setSaving(true);
    try {
      const configData = {
        providerName: providerName.trim() || null,
        providerTitle: providerTitle.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        coreIdentity: coreIdentity.trim() || null,
        guidingPrinciples: guidingPrinciples.trim() || null,
        tone: tone.trim() || null,
        voice: voice.trim() || null,
        rules: rules.trim() || null,
        boundaries: boundaries.trim() || null,
        selectedModel,
      };

      await apiRequest('POST', '/api/provider-agent-config', configData);
      toast.success('Agent configuration saved successfully!');
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error: any) {
      console.error('Error saving agent config:', error);
      toast.error(error.message || 'Failed to save agent configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Agent settings">
        <div className="flex justify-center py-12" data-testid="loading-state">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Agent personality" subtitle="Shape how Haven sounds and shows up for clients">
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <Card className="shadow-warm bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="flex items-center justify-between gap-4 flex-wrap p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Want a fresh start?</p>
                <p className="text-sm text-muted-foreground">Re-run the setup conversation to redefine your agent.</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => navigate('/provider/onboarding')} data-testid="button-rerun-setup">
                <Sparkles className="mr-2 h-4 w-4" /> Re-run setup chat
              </Button>
              <Button variant="outline" onClick={handleSave} disabled={saving} data-testid="button-save-agent">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Provider Profile</CardTitle>
              <CardDescription>How your AI assistant will present itself to clients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl} alt={providerName} />
                  <AvatarFallback>
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2 min-w-[200px]">
                  <div>
                    <Label htmlFor="provider-name">Provider Name</Label>
                    <Input
                      id="provider-name"
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      placeholder="e.g., Dr. Anya Sharma"
                      data-testid="input-provider-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="provider-title">Title/Specialization</Label>
                    <Input
                      id="provider-title"
                      value={providerTitle}
                      onChange={(e) => setProviderTitle(e.target.value)}
                      placeholder="e.g., Cognitive Behavioral Therapist"
                      data-testid="input-provider-title"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="avatar-url">Avatar URL (optional)</Label>
                <Input
                  id="avatar-url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  data-testid="input-avatar-url"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>AI Model Selection</CardTitle>
              </div>
              <CardDescription>
                Choose the AI model that powers your coaching assistant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger id="model" data-testid="select-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google/gemini-2.5-flash">
                      Gemini 2.5 Flash (Recommended)
                    </SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">
                      Gemini 2.5 Pro
                    </SelectItem>
                    <SelectItem value="google/gemini-2.5-flash-lite">
                      Gemini 2.5 Flash Lite
                    </SelectItem>
                    <SelectItem value="openai/gpt-5">
                      GPT-5
                    </SelectItem>
                    <SelectItem value="openai/gpt-5-mini">
                      GPT-5 Mini
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  This model will be used for all coaching sessions with your clients.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent System Prompt Configuration</CardTitle>
              <CardDescription>Shape your AI assistant's personality and behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="core-identity" className="text-base font-semibold">
                  Core Identity
                </Label>
                <Textarea
                  id="core-identity"
                  value={coreIdentity}
                  onChange={(e) => setCoreIdentity(e.target.value)}
                  placeholder={`You are ${providerName || 'a coaching'} AI assistant specializing in ${providerTitle || providerConfig?.title || 'professional development'}. Your role is to guide clients through their growth journey.`}
                  rows={4}
                  className="mt-2"
                  data-testid="input-core-identity"
                />
              </div>

              <div>
                <Label htmlFor="guiding-principles" className="text-base font-semibold">
                  Guiding Principles
                </Label>
                <Textarea
                  id="guiding-principles"
                  value={guidingPrinciples}
                  onChange={(e) => setGuidingPrinciples(e.target.value)}
                  placeholder={providerConfig?.methodology || "Define your coaching methodology and approach..."}
                  rows={6}
                  className="mt-2"
                  data-testid="input-guiding-principles"
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-semibold">Communication Style</Label>
                
                <div>
                  <Label htmlFor="tone" className="text-sm">Tone</Label>
                  <Input
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="e.g., Empathetic, supportive, professional, encouraging"
                    className="mt-1"
                    data-testid="input-tone"
                  />
                </div>

                <div>
                  <Label htmlFor="voice" className="text-sm">Voice</Label>
                  <Input
                    id="voice"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    placeholder="e.g., A collaborative partner, a trusted mentor, an insightful guide"
                    className="mt-1"
                    data-testid="input-voice"
                  />
                </div>

                <div>
                  <Label htmlFor="rules" className="text-sm">Rules</Label>
                  <Textarea
                    id="rules"
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    placeholder="e.g., 1. Ask open-ended questions to deepen reflection. 2. Validate emotions before offering perspectives."
                    rows={4}
                    className="mt-1"
                    data-testid="input-rules"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="boundaries" className="text-base font-semibold">
                  Boundaries
                </Label>
                <Textarea
                  id="boundaries"
                  value={boundaries}
                  onChange={(e) => setBoundaries(e.target.value)}
                  placeholder="e.g., You are an AI assistant, not a licensed professional. For crisis situations, direct users to appropriate resources."
                  rows={5}
                  className="mt-2"
                  data-testid="input-boundaries"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
