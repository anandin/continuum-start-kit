import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, ArrowRight, ArrowLeft, Heart, Sun, Compass, Trophy, Users, Leaf, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Provider {
  id: string;
  email: string;
  title: string;
  methodology: string;
  stages: Array<{ name: string; order: number }>;
  coreIdentity: string;
}

const stepIcons = [Heart, Sun, Compass, Trophy, Users, Wallet, Leaf];
const stepLabels = [
  "Where you are",
  "Your vision",
  "Your challenge",
  "Your wins",
  "Your guide",
  "Your tier",
  "Your journey",
];

interface OnboardingTier {
  id: string;
  label: string;
  description: string | null;
  amountCents: number;
  billingCadence: "per_session" | "monthly";
}

export default function Onboarding() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  const [currentPain, setCurrentPain] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [presentChallenge, setPresentChallenge] = useState('');
  const [recentWin, setRecentWin] = useState('');

  // Tier picker (step 6). Fetched lazily once a coach is chosen so we
  // never block coach selection on the billing endpoint.
  const [tiers, setTiers] = useState<OnboardingTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProvider) { setTiers([]); setSelectedTierId(null); return; }
    setTiersLoading(true);
    fetch(`/api/public/provider/${selectedProvider.id}/tiers`)
      .then((r) => r.ok ? r.json() : { tiers: [] })
      .then((d) => setTiers(d.tiers ?? []))
      .catch(() => setTiers([]))
      .finally(() => setTiersLoading(false));
  }, [selectedProvider]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (role && role !== 'seeker') {
      toast.error('Only seekers can access onboarding');
      navigate('/dashboard');
    }
  }, [user, role, navigate]);

  useEffect(() => {
    async function loadProviders() {
      try {
        const res = await fetch('/api/provider-configs', { credentials: 'include' });
        if (!res.ok) {
          toast.error('Failed to load coaches');
          return;
        }
        const data = await res.json();

        if (!data || data.length === 0) {
          toast.error('No coaches available yet');
          return;
        }

        const formattedProviders: Provider[] = data
          .filter((p: any) => p.stages && p.stages.length > 0)
          .map((p: any) => ({
            id: p.providerId,
            email: '',
            title: p.title || 'Coaching Program',
            methodology: p.methodology || '',
            stages: p.stages || [],
            coreIdentity: '',
          }));

        setProviders(formattedProviders);
      } catch (error) {
        console.error('Error loading providers:', error);
        toast.error('Failed to load coaches');
      }
    }

    loadProviders();
  }, []);

  const handleNext = () => {
    if (step === 1 && !currentPain.trim()) {
      toast.error("Please share what you're experiencing");
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
      toast.error('Please select a coach');
      return;
    }
    // Step 6 = optional tier picker. We don't *require* a tier so a
    // seeker can still move forward if their coach hasn't published
    // any (Stripe billing is opt-in for v1).

    if (step < 7) {
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
      toast.error('Please select a coach');
      return;
    }

    setLoading(true);

    try {
      const engagementRes = await apiRequest('POST', '/api/engagements', {
        providerId: selectedProvider.id,
      });
      const engagement = await engagementRes.json();

      // Persist the tier selection so per-session billing for session
      // #1 has a tier to charge against. For monthly tiers the server
      // returns a subscription clientSecret if Stripe needs the first
      // invoice confirmed (SCA / 3DS); we surface a friendly toast and
      // defer the actual card-confirm step to the Payment page rather
      // than blocking onboarding on a Stripe modal.
      let needsPaymentSetup = false;
      if (selectedTierId) {
        try {
          const r = await apiRequest(
            'POST',
            `/api/engagements/${engagement.id}/billing/select-tier`,
            { tierId: selectedTierId },
          );
          const body = await r.json().catch(() => ({}));
          if (body?.subscription?.clientSecret) {
            toast.message(
              'Add a card on the Payment page to start your subscription.',
            );
            needsPaymentSetup = true;
          }
        } catch (err: any) {
          toast.error(
            'Could not save your payment tier. Please choose it on the Payment page.',
          );
          needsPaymentSetup = true;
        }
        if (needsPaymentSetup) {
          try {
            sessionStorage.setItem(
              'haven:pendingPayment',
              JSON.stringify({ engagementId: engagement.id }),
            );
          } catch {}
        }
      }

      const answers = {
        current_pain: currentPain,
        desired_outcome: desiredOutcome,
        present_challenge: presentChallenge,
        recent_win: recentWin,
      };

      const assignRes = await apiRequest('POST', '/api/onboarding-assign', {
        answers,
        stages: selectedProvider.stages,
      });
      const stageAssignment = await assignRes.json();

      if (!stageAssignment?.initial_stage) {
        throw new Error('Failed to assign initial stage');
      }

      const sessionRes = await apiRequest('POST', '/api/sessions', {
        engagementId: engagement.id,
        initialStage: stageAssignment.initial_stage,
      });
      const session = await sessionRes.json();

      toast.success(`Welcome! You're starting at "${stageAssignment.initial_stage}"`);
      if (needsPaymentSetup) {
        navigate(`/payment?engagementId=${engagement.id}`);
      } else {
        navigate(`/chat/${session.id}`);
      }
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const pageVariants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  const StepIcon = stepIcons[step - 1];

  return (
    <div className="min-h-screen bg-gradient-warm-hero flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="mb-8" data-testid="progress-indicator">
          <div className="flex items-center justify-between gap-2 mb-3">
            {stepLabels.map((label, idx) => {
              const Icon = stepIcons[idx];
              const isActive = idx + 1 === step;
              const isComplete = idx + 1 < step;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-foreground'
                      : isComplete
                        ? 'text-primary'
                        : 'text-muted-foreground'
                  }`}
                  data-testid={`step-label-${idx + 1}`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </div>
              );
            })}
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-warm-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(step / 7) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">Step {step} of 7</span>
            <span className="text-xs text-muted-foreground">{Math.round((step / 7) * 100)}%</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Card className="p-8">
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Heart className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground" data-testid="text-step-title">
                        Let's start with where you are
                      </h2>
                    </div>
                    <p className="text-muted-foreground text-lg">
                      Take a moment to reflect. What's the main struggle or pain you're experiencing right now?
                      There are no wrong answers here.
                    </p>
                  </div>
                  <Textarea
                    value={currentPain}
                    onChange={(e) => setCurrentPain(e.target.value)}
                    placeholder="For example: 'I feel stuck in my career and don't know what direction to take next...'"
                    rows={5}
                    className="text-base"
                    autoFocus
                    data-testid="input-current-pain"
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-full bg-accent/15">
                        <Sun className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground" data-testid="text-step-title">
                        Now, imagine success
                      </h2>
                    </div>
                    <p className="text-muted-foreground text-lg">
                      Close your eyes for a moment. Where do you want to be? What does your ideal outcome look like?
                    </p>
                  </div>
                  <Textarea
                    value={desiredOutcome}
                    onChange={(e) => setDesiredOutcome(e.target.value)}
                    placeholder="For example: 'I want to feel confident in my direction and wake up excited about my work...'"
                    rows={5}
                    className="text-base"
                    autoFocus
                    data-testid="input-desired-outcome"
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Compass className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground" data-testid="text-step-title">
                        What's standing in your way?
                      </h2>
                    </div>
                    <p className="text-muted-foreground text-lg">
                      Understanding your obstacles is the first step to moving past them.
                      What's your biggest challenge right now?
                    </p>
                  </div>
                  <Textarea
                    value={presentChallenge}
                    onChange={(e) => setPresentChallenge(e.target.value)}
                    placeholder="For example: 'I lack confidence in interviews and struggle to articulate my value...'"
                    rows={5}
                    className="text-base"
                    autoFocus
                    data-testid="input-present-challenge"
                  />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-full bg-accent/15">
                        <Trophy className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground" data-testid="text-step-title">
                        Let's celebrate progress
                      </h2>
                    </div>
                    <p className="text-muted-foreground text-lg">
                      Growth happens in small steps. Tell me about a recent win, big or small.
                      What went well for you?
                    </p>
                  </div>
                  <Textarea
                    value={recentWin}
                    onChange={(e) => setRecentWin(e.target.value)}
                    placeholder="For example: 'I finally updated my resume and got positive feedback from a mentor...'"
                    rows={5}
                    className="text-base"
                    autoFocus
                    data-testid="input-recent-win"
                  />
                </div>
              )}

              {step === 5 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground" data-testid="text-step-title">
                        Choose your guide
                      </h2>
                    </div>
                    <p className="text-muted-foreground text-lg mb-6">
                      Based on what you've shared, here are coaches who can walk alongside you on your journey:
                    </p>
                  </div>

                  <div className="space-y-4">
                    {providers.length === 0 ? (
                      <div className="text-center py-8" data-testid="loading-providers">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-muted-foreground">Finding the right coaches for you...</p>
                      </div>
                    ) : (
                      providers.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={() => setSelectedProvider(provider)}
                          className={`w-full text-left p-6 rounded-md border-2 transition-all ${
                            selectedProvider?.id === provider.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-card hover-elevate'
                          }`}
                          data-testid={`button-select-provider-${provider.id}`}
                        >
                          <h3 className="text-xl font-semibold text-foreground mb-2">
                            {provider.title}
                          </h3>
                          <p className="text-muted-foreground mb-4">{provider.methodology}</p>
                          <div className="flex flex-wrap gap-2">
                            {provider.stages.slice(0, 3).map((stage, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                              >
                                {stage.name}
                              </span>
                            ))}
                            {provider.stages.length > 3 && (
                              <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm">
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
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Wallet className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground" data-testid="text-step-title">
                        Pick a tier that works for you
                      </h2>
                    </div>
                    <p className="text-muted-foreground text-lg mb-4">
                      Sliding-scale pricing — pay what fits your situation.
                      You can change this any time on your Payment page.
                    </p>
                  </div>
                  {tiersLoading ? (
                    <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
                  ) : tiers.length === 0 ? (
                    <div className="rounded-md bg-secondary/40 p-4 text-sm text-muted-foreground" data-testid="onboarding-no-tiers">
                      Your coach hasn't published pricing tiers yet. You can continue and pick a tier later from your Payment page.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tiers.map((t) => {
                        const sel = selectedTierId === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTierId(sel ? null : t.id)}
                            data-testid={`onboarding-tier-${t.id}`}
                            className={`w-full text-left rounded-md border-2 p-4 transition-all ${sel ? 'border-primary bg-primary/5' : 'border-border bg-card hover-elevate'}`}
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div>
                                <div className="font-medium text-foreground">{t.label}</div>
                                {t.description && <div className="text-xs text-muted-foreground mt-1">{t.description}</div>}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-semibold">${(t.amountCents / 100).toFixed(0)}</div>
                                <div className="text-xs text-muted-foreground">{t.billingCadence === 'monthly' ? 'per month' : 'per session'}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {step === 7 && selectedProvider && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Leaf className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground" data-testid="text-step-title">
                        You're ready to begin
                      </h2>
                    </div>
                    <p className="text-muted-foreground text-lg mb-6">
                      You'll be working with <strong className="text-foreground">{selectedProvider.title}</strong>.
                      Every journey starts with a single step.
                    </p>
                  </div>

                  <div className="bg-secondary/50 rounded-md p-6 space-y-4" data-testid="journey-stages">
                    <h3 className="text-lg font-semibold text-foreground">Your Journey Ahead:</h3>
                    <div className="space-y-3">
                      {selectedProvider.stages.map((stage, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-primary/15 text-primary rounded-full flex items-center justify-center text-sm font-medium">
                            {idx + 1}
                          </div>
                          <span className="text-foreground">{stage.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-md p-4" data-testid="text-journey-info">
                    <p className="text-muted-foreground text-sm">
                      We'll determine your starting point based on your responses and gently guide you through each step of your journey.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-4 mt-8 pt-6 border-t border-border">
                <Button
                  onClick={handleBack}
                  variant="ghost"
                  disabled={step === 1 || loading}
                  data-testid="button-back"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                {step < 7 ? (
                  <Button
                    onClick={handleNext}
                    data-testid="button-continue"
                  >
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    data-testid="button-begin-journey"
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
