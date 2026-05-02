import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  MessageSquare, 
  Calendar, 
  Target, 
  Sparkles,
  ArrowRight,
  Sunrise,
  Heart,
  BookOpen
} from 'lucide-react';
import { useEngagements } from '@/hooks/useEngagements';
import { TrajectoryChip } from '@/components/TrajectoryChip';
import { SeekerProgressCard } from '@/components/dashboard/SeekerProgressCard';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';

interface SeekerDashboardViewProps {
  userId: string;
}

export function SeekerDashboardView({ userId }: SeekerDashboardViewProps) {
  const navigate = useNavigate();
  const { loading, engagements, getLastSessionDate, getLatestStage, getTrajectoryStatus } = useEngagements(userId, 'seeker');
  const [latestSummary, setLatestSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const journeyCardRef = useRef<HTMLDivElement | null>(null);

  const handleProgressTileNav = useCallback((kind: 'sessions' | 'goals' | 'mood' | 'streak') => {
    if (kind === 'mood' || kind === 'streak') {
      navigate('/journal');
      return;
    }
    // Sessions and goals live inside the "Your Active Journey" card on this
    // page. Scroll there so the user lands on the relevant detail.
    journeyCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [navigate]);

  const activeEngagements = useMemo(() => 
    engagements.filter(e => e.status === 'active'), 
    [engagements]
  );
  const hasEngagements = engagements.length > 0;

  const completedSessions = engagements.reduce((acc, e) => 
    acc + (e.sessions?.filter(s => s.status === 'ended')?.length || 0), 0
  );

  const loadLatestSummary = useCallback(async () => {
    if (!activeEngagements[0]?.sessions?.length) return;
    
    setLoadingSummary(true);
    try {
      const endedSessions = activeEngagements[0].sessions
        .filter(s => s.status === 'ended')
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
      
      if (endedSessions.length > 0) {
        const res = await fetch(`/api/sessions/${endedSessions[0].id}/summary`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data) setLatestSummary(data);
        }
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  }, [activeEngagements]);

  useEffect(() => {
    if (activeEngagements.length > 0) {
      loadLatestSummary();
    }
  }, [activeEngagements, loadLatestSummary]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleStartChat = async () => {
    if (!activeEngagements[0]) return;
    
    const activeSession = activeEngagements[0].sessions?.find(s => s.status === 'active');
    
    if (activeSession) {
      navigate(`/chat/${activeSession.id}`);
    } else {
      try {
        const latestSession = activeEngagements[0].sessions?.sort((a, b) => 
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        )[0];
        
        const res = await apiRequest('POST', '/api/sessions', {
          engagementId: activeEngagements[0].id,
          initialStage: latestSession?.initial_stage || getLatestStage(activeEngagements[0])
        });
        const newSession = await res.json();
        navigate(`/chat/${newSession.id}`);
      } catch (error) {
        toast.error('Failed to start session');
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-greeting">
          {getGreeting()}
        </h1>
        <p className="text-muted-foreground">
          {hasEngagements 
            ? "Continue your journey of growth and self-discovery" 
            : "Begin your path toward meaningful change"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-warm" data-testid="card-sessions-completed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sessions</p>
                <p className="text-3xl font-semibold text-foreground mt-1">{completedSessions}</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-warm" data-testid="card-current-stage">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Stage</p>
                <p className="text-lg font-semibold text-foreground mt-1 truncate max-w-[160px]">
                  {activeEngagements[0] ? getLatestStage(activeEngagements[0]) : 'Not Started'}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-accent/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-warm" data-testid="card-last-session">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Session</p>
                <p className="text-lg font-semibold text-foreground mt-1">
                  {activeEngagements[0] ? getLastSessionDate(activeEngagements[0]) : 'N/A'}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SeekerProgressCard onTileNavigate={handleProgressTileNav} />

      <Card className="shadow-warm border-primary/10" data-testid="card-journal-cta">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Reflection journal</p>
                <p className="text-sm text-muted-foreground">
                  Write between sessions. Share entries with your coach when you're ready.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/journal')}
              data-testid="button-open-journal"
            >
              Open journal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasEngagements && activeEngagements[0] && (
        <Card ref={journeyCardRef} className="shadow-warm-md border-primary/10 scroll-mt-24" data-testid="card-active-journey">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Your Active Journey
              </CardTitle>
              <TrajectoryChip status={getTrajectoryStatus(activeEngagements[0])} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">
                  {activeEngagements[0].provider?.email || 'Your Coach'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Stage: {getLatestStage(activeEngagements[0])}
                </p>
              </div>
              <Button 
                onClick={handleStartChat}
                data-testid="button-continue-chat"
              >
                Continue Session
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {latestSummary && (
              <div className="space-y-4 pt-4 border-t border-border/60">
                {latestSummary.key_insights && latestSummary.key_insights.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                      Recent Insights
                    </h4>
                    <div className="space-y-1.5">
                      {latestSummary.key_insights.slice(0, 2).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <span>{typeof item === 'string' ? item : item.insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {latestSummary.next_action && (
                  <div className="bg-primary/5 rounded-xl p-3.5 border border-primary/10">
                    <h4 className="text-sm font-medium text-foreground mb-1 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-primary" />
                      Recommended Next Step
                    </h4>
                    <p className="text-sm text-muted-foreground">{latestSummary.next_action}</p>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const latestSession = activeEngagements[0].sessions?.sort((a, b) => 
                      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
                    )[0];
                    if (latestSession) {
                      navigate(`/session-summary/${latestSession.id}`);
                    }
                  }}
                  data-testid="button-view-summary"
                >
                  View Full Summary
                </Button>
              </div>
            )}

            {loadingSummary && !latestSummary && (
              <div className="space-y-2 pt-4 border-t border-border/60">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}

            {!loadingSummary && !latestSummary && (
              <div className="pt-4 border-t border-border/60">
                <p className="text-sm text-muted-foreground">
                  Complete your first session to unlock insights and progress tracking.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-warm bg-gradient-warm-card" data-testid="card-start-journey">
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sunrise className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {hasEngagements ? 'Start a New Journey' : 'Begin Your First Journey'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {hasEngagements 
                ? "Ready to explore a new area of growth with a coach?" 
                : "Connect with a coach and take the first step toward the change you seek."}
            </p>
            <Button 
              onClick={() => navigate('/onboarding')} 
              data-testid="button-start-journey"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {hasEngagements ? 'Start New Journey' : 'Find Your Coach'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
