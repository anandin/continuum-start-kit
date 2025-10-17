import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, User, Sparkles } from 'lucide-react';

export default function AgentSetup() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [providerConfig, setProviderConfig] = useState<any>(null);
  
  // Form fields
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

  // Redirect non-providers
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (role !== 'provider') {
      toast.error('Only providers can access this page');
      navigate('/dashboard');
    }
  }, [user, role, navigate]);

  // Load existing config
  useEffect(() => {
    if (user && role === 'provider') {
      loadConfig();
      loadProviderConfig();
    }
  }, [user, role]);

  const loadProviderConfig = async () => {
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
        setProviderConfig(data);
        // Auto-populate guiding principles with provider config data
        if (!guidingPrinciples && data) {
          const autoPopulated = generateGuidingPrinciplesFromConfig(data);
          setGuidingPrinciples(autoPopulated);
        }
      }
    } catch (error: any) {
      console.error('Error loading provider config:', error);
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

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('provider_agent_configs')
        .select('*')
        .eq('provider_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfigId(data.id);
        setProviderName(data.provider_name || '');
        setProviderTitle(data.provider_title || '');
        setAvatarUrl(data.avatar_url || '');
        setCoreIdentity(data.core_identity || '');
        setGuidingPrinciples(data.guiding_principles || '');
        setTone(data.tone || '');
        setVoice(data.voice || '');
        setRules(data.rules || '');
        setBoundaries(data.boundaries || '');
        setSelectedModel(data.selected_model || 'google/gemini-2.5-flash');
      }
    } catch (error: any) {
      console.error('Error loading agent config:', error);
      toast.error('Failed to load agent configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const configData = {
        provider_id: user?.id,
        provider_name: providerName.trim() || null,
        provider_title: providerTitle.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        core_identity: coreIdentity.trim() || null,
        guiding_principles: guidingPrinciples.trim() || null,
        tone: tone.trim() || null,
        voice: voice.trim() || null,
        rules: rules.trim() || null,
        boundaries: boundaries.trim() || null,
        selected_model: selectedModel,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (configId) {
        // Update existing
        const result = await supabase
          .from('provider_agent_configs')
          .update(configData)
          .eq('id', configId);
        error = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from('provider_agent_configs')
          .insert(configData)
          .select()
          .single();
        error = result.error;
        if (!error && result.data) {
          setConfigId(result.data.id);
        }
      }

      if (error) throw error;

      toast.success('Agent configuration saved successfully!');
    } catch (error: any) {
      console.error('Error saving agent config:', error);
      toast.error(error.message || 'Failed to save agent configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Setup</h1>
            <p className="text-sm text-slate-400">Configure your AI coaching assistant</p>
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
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Profile Section */}
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Provider Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl} alt={providerName} />
                  <AvatarFallback>
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div>
                    <Label htmlFor="provider-name">Provider Name</Label>
                    <Input
                      id="provider-name"
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      placeholder="e.g., Dr. Anya Sharma"
                    />
                  </div>
                  <div>
                    <Label htmlFor="provider-title">Title/Specialization</Label>
                    <Input
                      id="provider-title"
                      value={providerTitle}
                      onChange={(e) => setProviderTitle(e.target.value)}
                      placeholder="e.g., Cognitive Behavioral Therapist"
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
                />
              </div>
            </CardContent>
          </Card>

          {/* Model Selection */}
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-white">AI Model Selection</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                Choose the AI model that powers your coaching assistant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="model" className="text-white">AI Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger id="model" className="bg-slate-800/50 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem value="google/gemini-2.5-flash" className="text-white">
                      <div>
                        <div className="font-medium">Gemini 2.5 Flash (Recommended)</div>
                        <div className="text-xs text-slate-400">Balanced performance and cost</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="google/gemini-2.5-pro" className="text-white">
                      <div>
                        <div className="font-medium">Gemini 2.5 Pro</div>
                        <div className="text-xs text-slate-400">Maximum capability and reasoning</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="google/gemini-2.5-flash-lite" className="text-white">
                      <div>
                        <div className="font-medium">Gemini 2.5 Flash Lite</div>
                        <div className="text-xs text-slate-400">Fastest and most economical</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="openai/gpt-5" className="text-white">
                      <div>
                        <div className="font-medium">GPT-5</div>
                        <div className="text-xs text-slate-400">Premium OpenAI model</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="openai/gpt-5-mini" className="text-white">
                      <div>
                        <div className="font-medium">GPT-5 Mini</div>
                        <div className="text-xs text-slate-400">Cost-effective OpenAI option</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-2">
                  This model will be used for all coaching sessions with your clients.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Agent System Prompt Configuration */}
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Agent System Prompt Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="core-identity" className="text-lg font-semibold text-primary">
                  Core Identity
                </Label>
                <Textarea
                  id="core-identity"
                  value={coreIdentity}
                  onChange={(e) => setCoreIdentity(e.target.value)}
                  placeholder="You are Dr. Anya Sharma AI, a digital assistant for Dr. Anya Sharma, specializing in Cognitive Behavioral Therapy (CBT)."
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="guiding-principles" className="text-lg font-semibold text-primary">
                  Guiding Principles
                </Label>
                <Textarea
                  id="guiding-principles"
                  value={guidingPrinciples}
                  onChange={(e) => setGuidingPrinciples(e.target.value)}
                  placeholder="Your core framework is CBT. Your primary goal is to help the user identify negative thought patterns (cognitive distortions) and guide them to reframe these thoughts..."
                  rows={6}
                  className="mt-2"
                />
              </div>

              <div className="space-y-4">
                <Label className="text-lg font-semibold text-primary">Communication Style</Label>
                
                <div>
                  <Label htmlFor="tone" className="text-sm">Tone:</Label>
                  <Input
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="Empathetic, supportive, professional, calm, reassuring."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="voice" className="text-sm">Voice:</Label>
                  <Input
                    id="voice"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    placeholder="A gentle guide and facilitator."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="rules" className="text-sm">Rules:</Label>
                  <Textarea
                    id="rules"
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    placeholder="1. Never give direct advice. 2. Always end responses by checking in with the user's emotional state or asking a gentle, reflective question. 3. Use 'we' to foster a collaborative spirit (e.g., 'Perhaps we can explore...')."
                    rows={4}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="boundaries" className="text-lg font-semibold text-primary">
                  Boundaries
                </Label>
                <Textarea
                  id="boundaries"
                  value={boundaries}
                  onChange={(e) => setBoundaries(e.target.value)}
                  placeholder="You are not a human therapist. Do not discuss diagnoses. If the user expresses severe distress or suicidal ideation, you must provide a crisis hotline number and advise them to seek immediate professional help. Do not engage in non-therapeutic conversations."
                  rows={5}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
