import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, MessageSquare, TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Session {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  initial_stage: string | null;
  summaries: Array<{
    id: string;
    assigned_stage: string;
    session_summary: string;
    trajectory_status: string;
    key_insights: any;
    next_action: string;
  }>;
}

interface Engagement {
  id: string;
  created_at: string;
  seeker: {
    id: string;
  };
  sessions: Session[];
}

export default function ProviderEngagement() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<Engagement | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (profile?.role !== 'provider') {
      toast.error('Access denied. Provider role required.');
      navigate('/dashboard');
      return;
    }

    loadEngagement();
  }, [user, profile, engagementId]);

  const loadEngagement = async () => {
    if (!engagementId) {
      toast.error('No engagement ID provided');
      navigate('/provider/dashboard');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('engagements')
        .select(`
          id,
          created_at,
          seeker:seekers (
            id
          ),
          sessions (
            id,
            started_at,
            ended_at,
            status,
            initial_stage,
            summaries (
              id,
              assigned_stage,
              session_summary,
              trajectory_status,
              key_insights,
              next_action
            )
          )
        `)
        .eq('id', engagementId)
        .eq('provider_id', user?.id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Engagement not found');
      
      // Sort sessions by date
      const engagementData = data as any;
      if (engagementData.sessions) {
        engagementData.sessions.sort((a: Session, b: Session) => 
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
      }
      
      setEngagement(engagementData);
    } catch (error: any) {
      console.error('Error loading engagement:', error);
      toast.error(error.message || 'Failed to load engagement');
      navigate('/provider/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getSeekerAlias = () => {
    if (!engagement) return '';
    return `Seeker-${engagement.seeker.id.slice(0, 8)}`;
  };

  const getTrajectoryIcon = (status: string) => {
    switch (status) {
      case 'accelerating': return <TrendingUp className="h-4 w-4" />;
      case 'steady': return <Activity className="h-4 w-4" />;
      case 'drifting': return <TrendingDown className="h-4 w-4" />;
      case 'stalling': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getTrajectoryColor = (status: string) => {
    switch (status) {
      case 'accelerating': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'steady': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'drifting': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'stalling': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getSentimentScore = (keyInsights: any) => {
    if (!Array.isArray(keyInsights)) return null;
    const sentimentItem = keyInsights.find((item: any) => 
      typeof item === 'object' && item.label === 'sentiment'
    );
    return sentimentItem?.score ?? null;
  };

  const formatSentiment = (score: number | null) => {
    if (score === null) return 'N/A';
    if (score >= 0.5) return `+${score.toFixed(2)} (Positive)`;
    if (score >= 0) return `+${score.toFixed(2)} (Neutral)`;
    return `${score.toFixed(2)} (Negative)`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!engagement) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                {getSeekerAlias()}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Engagement started {new Date(engagement.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/provider/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
              <CardDescription>
                {engagement.sessions.length} session{engagement.sessions.length !== 1 ? 's' : ''} completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {engagement.sessions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No sessions yet for this engagement.
                </div>
              ) : (
                <div className="space-y-6">
                  {engagement.sessions.map((session, index) => {
                    const summary = session.summaries?.[0];
                    const sentimentScore = summary ? getSentimentScore(summary.key_insights) : null;
                    
                    return (
                      <div key={session.id}>
                        {index > 0 && <Separator className="my-6" />}
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">
                                  Session {engagement.sessions.length - index}
                                </h3>
                                <Badge variant={session.status === 'ended' ? 'secondary' : 'default'}>
                                  {session.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {new Date(session.started_at).toLocaleDateString()} at{' '}
                                {new Date(session.started_at).toLocaleTimeString()}
                                {session.ended_at && (
                                  <> • Ended {new Date(session.ended_at).toLocaleDateString()}</>
                                )}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/chat/${session.id}`)}
                            >
                              <MessageSquare className="mr-2 h-4 w-4" />
                              View Chat
                            </Button>
                          </div>

                          {summary ? (
                            <div className="rounded-lg border bg-card p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{summary.assigned_stage}</Badge>
                                  <Badge className={getTrajectoryColor(summary.trajectory_status)}>
                                    <span className="mr-1">{getTrajectoryIcon(summary.trajectory_status)}</span>
                                    {summary.trajectory_status}
                                  </Badge>
                                  {sentimentScore !== null && (
                                    <Badge variant="secondary">
                                      Sentiment: {formatSentiment(sentimentScore)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  {summary.session_summary}
                                </p>
                              </div>

                              <div className="space-y-2">
                                <p className="text-sm font-medium">Key Insights:</p>
                                <ul className="space-y-1">
                                  {Array.isArray(summary.key_insights) && 
                                    summary.key_insights
                                      .filter((insight: any) => 
                                        typeof insight === 'string' || insight.label !== 'sentiment'
                                      )
                                      .map((insight: string, idx: number) => (
                                        <li key={idx} className="flex gap-2 text-sm text-muted-foreground">
                                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                          {insight}
                                        </li>
                                      ))
                                  }
                                </ul>
                              </div>

                              <div className="pt-2 border-t">
                                <p className="text-sm">
                                  <span className="font-medium">Next Action:</span>{' '}
                                  <span className="text-muted-foreground">{summary.next_action}</span>
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
                              {session.status === 'active' 
                                ? 'Session in progress - summary will be generated when completed'
                                : 'No summary available for this session'
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
