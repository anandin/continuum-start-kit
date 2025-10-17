import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';

export default function Onboarding() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [currentPain, setCurrentPain] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [presentChallenge, setPresentChallenge] = useState('');
  const [recentWin, setRecentWin] = useState('');

  // Redirect non-seekers
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (profile?.role !== 'seeker') {
      toast.error('Only seekers can access onboarding');
      navigate('/dashboard');
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPain.trim() || !desiredOutcome.trim() || !presentChallenge.trim() || !recentWin.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      // 1. Ensure seeker row exists
      let seekerId: string;
      const { data: existingSeeker, error: seekerCheckError } = await supabase
        .from('seekers')
        .select('id')
        .eq('owner_id', user?.id)
        .maybeSingle();

      if (seekerCheckError) throw seekerCheckError;

      if (existingSeeker) {
        seekerId = existingSeeker.id;
      } else {
        const { data: newSeeker, error: seekerCreateError } = await supabase
          .from('seekers')
          .insert({ owner_id: user?.id })
          .select()
          .single();

        if (seekerCreateError) throw seekerCreateError;
        seekerId = newSeeker.id;
      }

      // 2. Get the seeded provider (hardcoded for now - the one we seeded earlier)
      // TODO: Replace with provider selection UI
      const { data: provider, error: providerError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'provider')
        .limit(1)
        .single();

      if (providerError || !provider) {
        toast.error('No providers available. Please contact support.');
        return;
      }

      const providerId = provider.id;

      // 3. Get provider's config (for stages)
      const { data: providerConfig, error: configError } = await supabase
        .from('provider_configs')
        .select('stages')
        .eq('provider_id', providerId)
        .maybeSingle();

      if (configError) throw configError;

      if (!providerConfig || !providerConfig.stages) {
        toast.error('Provider configuration not found. Please contact support.');
        return;
      }

      // 4. Ensure engagement exists
      let engagementId: string;
      const { data: existingEngagement, error: engagementCheckError } = await supabase
        .from('engagements')
        .select('id')
        .eq('seeker_id', seekerId)
        .eq('provider_id', providerId)
        .maybeSingle();

      if (engagementCheckError) throw engagementCheckError;

      if (existingEngagement) {
        engagementId = existingEngagement.id;
      } else {
        const { data: newEngagement, error: engagementCreateError } = await supabase
          .from('engagements')
          .insert({
            seeker_id: seekerId,
            provider_id: providerId,
            status: 'active'
          })
          .select()
          .single();

        if (engagementCreateError) throw engagementCreateError;
        engagementId = newEngagement.id;
      }

      // 5. Call edge function to determine initial stage
      const answers = {
        current_pain: currentPain,
        desired_outcome: desiredOutcome,
        present_challenge: presentChallenge,
        recent_win: recentWin,
      };

      console.log('Calling onboarding-assign with:', { answers, stages: providerConfig.stages });

      const { data: stageAssignment, error: assignError } = await supabase.functions.invoke(
        'onboarding-assign',
        {
          body: {
            answers,
            stages: providerConfig.stages
          }
        }
      );

      if (assignError) throw assignError;

      if (!stageAssignment?.initial_stage) {
        throw new Error('Failed to assign initial stage');
      }

      console.log('Stage assignment:', stageAssignment);

      // 6. Create session with initial_stage
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          engagement_id: engagementId,
          status: 'active',
          initial_stage: stageAssignment.initial_stage
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      toast.success(`Welcome! You've been assigned to the "${stageAssignment.initial_stage}" stage.`);
      
      // 7. Route to chat
      navigate(`/chat/${session.id}`);

    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Welcome to Continuum
            </span>
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Let's Get Started</CardTitle>
              <CardDescription>
                Tell us about your journey so we can personalize your experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="current_pain">What's your current pain or struggle? *</Label>
                  <Textarea
                    id="current_pain"
                    value={currentPain}
                    onChange={(e) => setCurrentPain(e.target.value)}
                    placeholder="Describe what's been challenging for you lately..."
                    rows={3}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desired_outcome">What's your desired outcome? *</Label>
                  <Textarea
                    id="desired_outcome"
                    value={desiredOutcome}
                    onChange={(e) => setDesiredOutcome(e.target.value)}
                    placeholder="Where do you want to be? What would success look like?"
                    rows={3}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="present_challenge">What's your biggest challenge right now? *</Label>
                  <Textarea
                    id="present_challenge"
                    value={presentChallenge}
                    onChange={(e) => setPresentChallenge(e.target.value)}
                    placeholder="What's the main obstacle standing in your way?"
                    rows={3}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recent_win">Tell us about a recent win (big or small) *</Label>
                  <Textarea
                    id="recent_win"
                    value={recentWin}
                    onChange={(e) => setRecentWin(e.target.value)}
                    placeholder="What's something positive that happened recently?"
                    rows={3}
                    disabled={loading}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Setting up your journey...
                    </>
                  ) : (
                    <>
                      Begin Your Journey
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
