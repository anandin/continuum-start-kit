import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Rocket, Search, MessageSquare, Calendar } from 'lucide-react';
import { useEngagements } from '@/hooks/useEngagements';
import { TrajectoryChip } from '@/components/TrajectoryChip';

interface SeekerDashboardViewProps {
  userId: string;
}

export function SeekerDashboardView({ userId }: SeekerDashboardViewProps) {
  const navigate = useNavigate();
  const { loading, engagements, getLastSessionDate, getLatestStage, getTrajectoryStatus } = useEngagements(userId, 'seeker');

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const activeEngagements = engagements.filter(e => e.status === 'active');
  const hasEngagements = engagements.length > 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <CardHeader>
          <CardTitle className="text-2xl">Your Growth Journey</CardTitle>
          <CardDescription>
            {hasEngagements 
              ? `You have ${activeEngagements.length} active ${activeEngagements.length === 1 ? 'engagement' : 'engagements'}`
              : 'Ready to start your personal growth journey?'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasEngagements ? (
            <Button onClick={() => navigate('/onboarding')} size="lg" className="w-full md:w-auto">
              <Rocket className="mr-2 h-5 w-5" />
              Start Your Journey
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button onClick={() => navigate('/onboarding')} size="sm">
                <Rocket className="mr-2 h-4 w-4" />
                Start New Journey
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Engagements */}
      {hasEngagements && (
        <Card>
          <CardHeader>
            <CardTitle>Your Active Sessions</CardTitle>
            <CardDescription>
              Continue your growth with your providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeEngagements.map((engagement) => {
                const trajectoryStatus = getTrajectoryStatus(engagement);
                const latestStage = getLatestStage(engagement);
                const lastSessionDate = getLastSessionDate(engagement);
                const hasActiveSessions = engagement.sessions.some(s => s.status === 'active');

                return (
                  <Card key={engagement.id} className="border-muted">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              {engagement.provider?.email || 'Your Provider'}
                            </h3>
                            <TrajectoryChip status={trajectoryStatus} />
                          </div>
                          
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{latestStage}</Badge>
                              <span>Current Stage</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>Last session: {lastSessionDate}</span>
                            </div>
                          </div>
                        </div>

                        <Button 
                          onClick={() => {
                            // Find active session or most recent
                            const activeSession = engagement.sessions.find(s => s.status === 'active');
                            const latestSession = engagement.sessions.sort((a, b) => 
                              new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
                            )[0];
                            const sessionId = activeSession?.id || latestSession?.id;
                            
                            if (sessionId) {
                              navigate(`/chat/${sessionId}`);
                            }
                          }}
                          disabled={!engagement.sessions?.length}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          {hasActiveSessions ? 'Continue Session' : 'View History'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Find Providers Section - Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Discover Providers</CardTitle>
          <CardDescription>
            Find the right guide for your growth journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center border-2 border-dashed rounded-lg border-muted-foreground/25">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              Provider search and discovery coming soon
            </p>
            <p className="text-sm text-muted-foreground">
              You'll be able to browse and connect with providers that match your needs
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
