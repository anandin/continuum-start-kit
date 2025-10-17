import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Save, User } from 'lucide-react';

export default function AgentSetup() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  
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
    }
  }, [user, role]);

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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Agent Setup</h1>
            <p className="text-sm text-muted-foreground">Configure your AI coaching assistant</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
            <Button onClick={handleSave} disabled={saving}>
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
          <Card>
            <CardHeader>
              <CardTitle>Provider Profile</CardTitle>
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

          {/* Agent System Prompt Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Agent System Prompt Configuration</CardTitle>
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
