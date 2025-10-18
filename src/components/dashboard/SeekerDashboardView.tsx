import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
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

  const activeEngagements = engagements.filter(e => e.status === 'active');
  const hasEngagements = engagements.length > 0;
  const totalSessions = engagements.reduce((acc, e) => acc + (e.sessions?.length || 0), 0);
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

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Progress: {getLatestStage(activeEngagements[0])}</span>
                <span className="text-indigo-600 font-semibold">65%</span>
              </div>
              <Progress value={65} className="h-2" />
              <p className="text-sm text-slate-600 mt-2">
                "Your recent insights show strong progress in leadership awareness. Keep building on this momentum!"
              </p>
            </div>
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