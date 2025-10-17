import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Provider {
  id: string;
  email: string;
  title: string;
  methodology: string;
  stages: Array<{ name: string; order: number }>;
  core_identity: string;
}

export default function Onboarding() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  
  // Form data
  const [currentPain, setCurrentPain] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [presentChallenge, setPresentChallenge] = useState('');
  const [recentWin, setRecentWin] = useState('');

  // Redirect non-seekers
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (role && role !== 'seeker') {
      toast.error('Only seekers can access onboarding');
      navigate('/dashboard');
    }
  }, [user, role, navigate]);

  // Load providers
  useEffect(() => {
    async function loadProviders() {
      const { data, error } = await supabase
        .from('provider_configs')
        .select(`
          provider_id,
          title,
          methodology,
          stages,
          profiles!provider_configs_provider_id_fkey(email),
          provider_agent_configs!provider_agent_configs_provider_id_fkey(core_identity)
        `)
        .not('stages', 'is', null);

      if (error) {
        console.error('Error loading providers:', error);
        return;
      }

      const formattedProviders = data.map((p: any) => ({
        id: p.provider_id,
        email: p.profiles.email,
        title: p.title,
        methodology: p.methodology,
        stages: p.stages,
        core_identity: p.provider_agent_configs?.[0]?.core_identity || '',
      }));

      setProviders(formattedProviders);
    }

    loadProviders();
  }, []);

  const handleNext = () => {
    if (step === 1 && !currentPain.trim()) {
      toast.error('Please share what you\'re experiencing');
      return;
    }
    if (step === 2 && !desiredOutcome.trim()) {
      toast.error('Please share your vision');
      return;
    }
    if (step === 3 && !presentChallenge.trim()) {
      toast.error('Please share your current challenge');
      return;
    }
    if (step === 4 && !recentWin.trim()) {
      toast.error('Please share a recent win');
      return;
    }
    if (step === 5 && !selectedProvider) {
      toast.error('Please select a provider');
      return;
    }
    
    if (step < 6) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProvider) {
      toast.error('Please select a provider');
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

      // 2. Ensure engagement exists
      let engagementId: string;
      const { data: existingEngagement, error: engagementCheckError } = await supabase
        .from('engagements')
        .select('id')
        .eq('seeker_id', seekerId)
        .eq('provider_id', selectedProvider.id)
        .maybeSingle();

      if (engagementCheckError) throw engagementCheckError;

      if (existingEngagement) {
        engagementId = existingEngagement.id;
      } else {
        const { data: newEngagement, error: engagementCreateError } = await supabase
          .from('engagements')
          .insert({
            seeker_id: seekerId,
            provider_id: selectedProvider.id,
            status: 'active'
          })
          .select()
          .single();

        if (engagementCreateError) throw engagementCreateError;
        engagementId = newEngagement.id;
      }

      // 3. Call edge function to determine initial stage
      const answers = {
        current_pain: currentPain,
        desired_outcome: desiredOutcome,
        present_challenge: presentChallenge,
        recent_win: recentWin,
      };

      const { data: stageAssignment, error: assignError } = await supabase.functions.invoke(
        'onboarding-assign',
        {
          body: {
            answers,
            stages: selectedProvider.stages
          }
        }
      );

      if (assignError) throw assignError;

      if (!stageAssignment?.initial_stage) {
        throw new Error('Failed to assign initial stage');
      }

      // 4. Create session with initial_stage
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

      toast.success(`Welcome! You're starting at "${stageAssignment.initial_stage}"`);
      
      // 5. Route to chat
      navigate(`/chat/${session.id}`);

    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const pageVariants = {
    enter: { opacity: 0, x: 50 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Step {step} of 6</span>
            <span className="text-sm text-slate-400">{Math.round((step / 6) * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
              initial={{ width: 0 }}
              animate={{ width: `${(step / 6) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-slate-900/50 border-white/10 backdrop-blur p-8">
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-6 w-6 text-purple-400" />
                      <h2 className="text-2xl font-bold text-white">Let's start with where you are</h2>
                    </div>
                    <p className="text-slate-300 text-lg">
                      What's the main struggle or pain you're experiencing right now?
                    </p>
                  </div>
                  <Textarea
                    value={currentPain}
                    onChange={(e) => setCurrentPain(e.target.value)}
                    placeholder="For example: 'I feel stuck in my career and don't know what direction to take next...'"
                    rows={5}
                    className="text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    autoFocus
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-6 w-6 text-purple-400" />
                      <h2 className="text-2xl font-bold text-white">Now, imagine success</h2>
                    </div>
                    <p className="text-slate-300 text-lg">
                      Where do you want to be? What would success look like for you?
                    </p>
                  </div>
                  <Textarea
                    value={desiredOutcome}
                    onChange={(e) => setDesiredOutcome(e.target.value)}
                    placeholder="For example: 'I want to transition into a leadership role where I can make strategic decisions...'"
                    rows={5}
                    className="text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    autoFocus
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-6 w-6 text-purple-400" />
                      <h2 className="text-2xl font-bold text-white">What's standing in your way?</h2>
                    </div>
                    <p className="text-slate-300 text-lg">
                      What's your biggest challenge or obstacle right now?
                    </p>
                  </div>
                  <Textarea
                    value={presentChallenge}
                    onChange={(e) => setPresentChallenge(e.target.value)}
                    placeholder="For example: 'I lack confidence in interviews and struggle to articulate my value...'"
                    rows={5}
                    className="text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    autoFocus
                  />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-6 w-6 text-purple-400" />
                      <h2 className="text-2xl font-bold text-white">Let's celebrate progress</h2>
                    </div>
                    <p className="text-slate-300 text-lg">
                      Tell me about a recent win, big or small. What went well?
                    </p>
                  </div>
                  <Textarea
                    value={recentWin}
                    onChange={(e) => setRecentWin(e.target.value)}
                    placeholder="For example: 'I finally updated my resume and got positive feedback from a mentor...'"
                    rows={5}
                    className="text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    autoFocus
                  />
                </div>
              )}

              {step === 5 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-6 w-6 text-purple-400" />
                      <h2 className="text-2xl font-bold text-white">Choose your guide</h2>
                    </div>
                    <p className="text-slate-300 text-lg mb-6">
                      Based on what you've shared, here are coaches who can help you:
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {providers.length === 0 ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto mb-4" />
                        <p className="text-slate-400">Loading coaches...</p>
                      </div>
                    ) : (
                      providers.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={() => setSelectedProvider(provider)}
                          className={`w-full text-left p-6 rounded-lg border-2 transition-all ${
                            selectedProvider?.id === provider.id
                              ? 'border-purple-500 bg-purple-500/10'
                              : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                          }`}
                        >
                          <h3 className="text-xl font-semibold text-white mb-2">
                            {provider.title}
                          </h3>
                          <p className="text-slate-300 mb-4">{provider.methodology}</p>
                          <div className="flex flex-wrap gap-2">
                            {provider.stages.slice(0, 3).map((stage, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-sm"
                              >
                                {stage.name}
                              </span>
                            ))}
                            {provider.stages.length > 3 && (
                              <span className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-sm">
                                +{provider.stages.length - 3} more
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {step === 6 && selectedProvider && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-6 w-6 text-purple-400" />
                      <h2 className="text-2xl font-bold text-white">You're all set!</h2>
                    </div>
                    <p className="text-slate-300 text-lg mb-6">
                      You'll be working with <strong className="text-white">{selectedProvider.title}</strong>
                    </p>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Your Journey:</h3>
                    <div className="space-y-3">
                      {selectedProvider.stages.map((stage, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 text-purple-300 rounded-full flex items-center justify-center text-sm font-medium">
                            {idx + 1}
                          </div>
                          <span className="text-slate-300">{stage.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                    <p className="text-purple-200 text-sm">
                      💡 We'll determine your starting stage based on your responses and guide you through each step of your journey.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
                <Button
                  onClick={handleBack}
                  variant="ghost"
                  className="text-slate-300"
                  disabled={step === 1 || loading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                {step < 6 ? (
                  <Button
                    onClick={handleNext}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                  >
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting your journey...
                      </>
                    ) : (
                      <>
                        Begin Journey
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}