import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import React from 'react';
import { 
  MessageSquare, 
  TrendingUp, 
  Calendar, 
  Target, 
  Sparkles,
  ArrowRight,
  Activity
} from 'lucide-react';
import { useEngagements } from '@/hooks/useEngagements';
import { TrajectoryChip } from '@/components/TrajectoryChip';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SeekerDashboardViewProps {
  userId: string;
}

export function SeekerDashboardView({ userId }: SeekerDashboardViewProps) {
  const navigate = useNavigate();
  const { loading, engagements, getLastSessionDate, getLatestStage, getTrajectoryStatus } = useEngagements(userId, 'seeker');
  const [latestSummary, setLatestSummary] = React.useState<any>(null);
  const [loadingSummary, setLoadingSummary] = React.useState(false);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const activeEngagements = React.useMemo(() => 
    engagements.filter(e => e.status === 'active'), 
    [engagements]
  );
  const hasEngagements = engagements.length > 0;
  const totalSessions = engagements.reduce((acc, e) => acc + (e.sessions?.length || 0), 0);

  const loadLatestSummary = React.useCallback(async () => {
    if (!activeEngagements[0]?.sessions) return;
    
    setLoadingSummary(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('summaries')
        .select('*')
        .in('session_id', activeEngagements[0].sessions.map(s => s.id))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLatestSummary(data);
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  }, [activeEngagements]);

  React.useEffect(() => {
    if (activeEngagements.length > 0) {
      loadLatestSummary();
    }
  }, [activeEngagements, loadLatestSummary]);

  const completedSessions = engagements.reduce((acc, e) => 
    acc + (e.sessions?.filter(s => s.status === 'ended')?.length || 0), 0
  );

  // Mock data for growth timeline - replace with real data
  const growthData = [
    { session: 1, progress: 20 },
    { session: 2, progress: 35 },
    { session: 3, progress: 45 },
    { session: 4, progress: 60 },
    { session: 5, progress: 70 },
  ];

  // Mock insights - replace with AI-generated
  const insights = [
    "You're showing consistent progress in emotional awareness",
    "Consider exploring deeper reflection practices",
    "Your engagement level has increased 40% this week"
  ];

  const motivationalQuotes = [
    "Growth is a journey, not a destination.",
    "Every conversation brings you closer to your goals.",
    "Your dedication to growth is inspiring."
  ];
  const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

  return (
    <div className="space-y-6">
      {/* Header with Greeting and Summary Tiles */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Welcome back! 👋</h1>
          <p className="text-muted-foreground mt-1">Continue your journey of growth and transformation</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Sessions Completed</p>
                  <p className="text-3xl font-bold text-indigo-900 mt-2">{completedSessions}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Current Stage</p>
                  <p className="text-lg font-bold text-indigo-900 mt-2">
                    {activeEngagements[0] ? getLatestStage(activeEngagements[0]) : 'Not Started'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Target className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Last Chat</p>
                  <p className="text-lg font-bold text-indigo-900 mt-2">
                    {activeEngagements[0] ? getLastSessionDate(activeEngagements[0]) : 'N/A'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Journey Card */}
      {hasEngagements && activeEngagements[0] && (
        <Card className="bg-gradient-to-br from-white to-sky-50 border-sky-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-indigo-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              Your Active Journey
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 border-2 border-indigo-200">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activeEngagements[0].provider?.email}`} />
                <AvatarFallback className="bg-indigo-100 text-indigo-900">
                  {activeEngagements[0].provider?.email?.charAt(0).toUpperCase() || 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-semibold text-indigo-900">
                    {activeEngagements[0].provider?.email || 'Your Coach'}
                  </h3>
                  <TrajectoryChip status={getTrajectoryStatus(activeEngagements[0])} />
                </div>
                <p className="text-sm text-slate-700">Executive Leadership Development</p>
              </div>
              <Button 
                onClick={async () => {
                  const activeSession = activeEngagements[0].sessions?.find(s => s.status === 'active');
                  
                  if (activeSession) {
                    navigate(`/chat/${activeSession.id}`);
                  } else {
                    // Create new session if no active session exists
                    const latestSession = activeEngagements[0].sessions?.sort((a, b) => 
                      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
                    )[0];
                    
                    const { supabase } = await import('@/integrations/supabase/client');
                    const { data: newSession, error } = await supabase
                      .from('sessions')
                      .insert({
                        engagement_id: activeEngagements[0].id,
                        status: 'active',
                        initial_stage: latestSession?.initial_stage || getLatestStage(activeEngagements[0])
                      })
                      .select()
                      .single();

                    if (error) {
                      const { toast } = await import('sonner');
                      toast.error('Failed to create session');
                      return;
                    }

                    navigate(`/chat/${newSession.id}`);
                  }
                }}
                className="bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white shadow-md"
              >
                Continue Chat
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Recent Insights & Next Action */}
            {latestSummary && (
              <div className="space-y-4 pt-4 border-t border-sky-200">
                {/* Key Insights */}
                {latestSummary.key_insights && latestSummary.key_insights.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      Recent Insights
                    </h4>
                    <div className="space-y-2">
                      {latestSummary.key_insights.slice(0, 2).map((insight: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Action */}
                {latestSummary.next_action && (
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                    <h4 className="text-sm font-semibold text-indigo-900 mb-1 flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      Next Action
                    </h4>
                    <p className="text-sm text-slate-700">{latestSummary.next_action}</p>
                  </div>
                )}

                {/* View Full Summary */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => {
                    const latestSession = activeEngagements[0].sessions?.sort((a, b) => 
                      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
                    )[0];
                    if (latestSession) {
                      navigate(`/session-summary/${latestSession.id}`);
                    }
                  }}
                >
                  View Full Summary
                </Button>
              </div>
            )}

            {/* Loading state */}
            {loadingSummary && !latestSummary && (
              <div className="space-y-2 pt-4 border-t border-sky-200">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}

            {/* Empty state - first session */}
            {!loadingSummary && !latestSummary && (
              <div className="pt-4 border-t border-sky-200">
                <p className="text-sm text-slate-600 italic">
                  Complete your first session to see insights and progress tracking here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Growth Timeline Chart */}
      {hasEngagements && (
        <Card className="bg-white border-sky-200">
          <CardHeader>
            <CardTitle className="text-indigo-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              Growth Timeline
            </CardTitle>
            <CardDescription className="text-slate-600">Your progress across sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="session" 
                  label={{ value: 'Session Number', position: 'insideBottom', offset: -5 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  label={{ value: 'Progress %', angle: -90, position: 'insideLeft' }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="progress" 
                  stroke="hsl(220 90% 56%)" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(220 90% 56%)', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Insights & Nudges */}
      {hasEngagements && (
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
          <CardHeader>
            <CardTitle className="text-indigo-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-600" />
              Insights & Nudges
            </CardTitle>
            <CardDescription className="text-slate-600">AI-generated insights from your journey</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-sky-200">
                  <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="h-3 w-3 text-indigo-600" />
                  </div>
                  <p className="text-sm text-slate-700">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start New Session */}
      <Card className="bg-gradient-to-br from-sky-50 to-indigo-50 border-sky-200">
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <Button 
              onClick={() => navigate('/onboarding')} 
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white shadow-lg"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Start New Journey
            </Button>
            <p className="text-sm text-slate-600 mt-3">
              Ready to explore a new area of growth?
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer with Motivational Quote */}
      <Card className="bg-gradient-to-r from-indigo-100 to-sky-100 border-indigo-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-lg font-medium text-indigo-900 italic">"{randomQuote}"</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}