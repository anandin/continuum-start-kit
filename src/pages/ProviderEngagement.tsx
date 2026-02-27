import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, MessageSquare, TrendingUp, TrendingDown, Activity, AlertTriangle, Calendar, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Summary {
  id: string;
  assignedStage?: string;
  assigned_stage?: string;
  sessionSummary?: string;
  session_summary?: string;
  trajectoryStatus?: string;
  trajectory_status?: string;
  keyInsights?: any;
  key_insights?: any;
  nextAction?: string;
  next_action?: string;
}

interface Session {
  id: string;
  startedAt?: string;
  started_at?: string;
  endedAt?: string | null;
  ended_at?: string | null;
  status: string;
  initialStage?: string | null;
  initial_stage?: string | null;
  summary?: Summary | null;
}

interface Engagement {
  id: string;
  createdAt?: string;
  created_at?: string;
  seekerId?: string;
  seeker_id?: string;
}

export default function ProviderEngagement() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (role !== 'provider') {
      toast.error('Access denied. Provider role required.');
      navigate('/dashboard');
      return;
    }

    loadEngagement();
  }, [user, role, engagementId]);

  const loadEngagement = async () => {
    if (!engagementId) {
      toast.error('No engagement ID provided');
      navigate('/provider/dashboard');
      return;
    }

    setLoading(true);
    try {
      const engagementRes = await fetch(`/api/engagements/${engagementId}`, { credentials: 'include' });
      if (!engagementRes.ok) throw new Error('Engagement not found');
      const engagementData = await engagementRes.json();
      setEngagement(engagementData);

      const sessionsRes = await fetch(`/api/engagements/${engagementId}/sessions`, { credentials: 'include' });
      if (!sessionsRes.ok) throw new Error('Failed to load sessions');
      const sessionsData = await sessionsRes.json();

      const sessionsWithSummaries = await Promise.all(
        sessionsData.map(async (session: any) => {
          try {
            const summaryRes = await fetch(`/api/sessions/${session.id}/summary`, { credentials: 'include' });
            if (summaryRes.ok) {
              const summaryData = await summaryRes.json();
              return { ...session, summary: summaryData };
            }
          } catch {}
          return { ...session, summary: null };
        })
      );

      sessionsWithSummaries.sort((a: any, b: any) => {
        const dateA = new Date(b.startedAt || b.started_at || b.createdAt || b.created_at).getTime();
        const dateB = new Date(a.startedAt || a.started_at || a.createdAt || a.created_at).getTime();
        return dateA - dateB;
      });

      setSessions(sessionsWithSummaries);
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
    const seekerId = engagement.seekerId || engagement.seeker_id || engagement.id;
    return `Client ${seekerId.slice(0, 8)}`;
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
      case 'accelerating': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'steady': return 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
      case 'drifting': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'stalling': return 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      default: return 'bg-muted text-muted-foreground';
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm" data-testid="loading-engagement">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading engagement details...</p>
        </div>
      </div>
    );
  }

  if (!engagement) {
    return null;
  }

  const engagementDate = engagement.createdAt || engagement.created_at;

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b bg-card/80 backdrop-blur-lg shadow-warm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-warm-accent flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-seeker-alias">
                {getSeekerAlias()}
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="text-engagement-date">
                Engagement started {engagementDate ? new Date(engagementDate).toLocaleDateString() : 'recently'}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/provider/dashboard')}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card className="shadow-warm-md" data-testid="card-session-history">
            <CardHeader>
              <CardTitle>Session History</CardTitle>
              <CardDescription>
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="py-12 text-center" data-testid="text-no-sessions">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No sessions yet for this engagement.</p>
                  <p className="text-sm text-muted-foreground mt-1">Sessions will appear here once the client begins.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sessions.map((session, index) => {
                    const summary = session.summary;
                    const tStatus = summary?.trajectoryStatus || summary?.trajectory_status;
                    const sStage = summary?.assignedStage || summary?.assigned_stage;
                    const sSummary = summary?.sessionSummary || summary?.session_summary;
                    const sInsights = summary?.keyInsights || summary?.key_insights;
                    const sNextAction = summary?.nextAction || summary?.next_action;
                    const sentimentScore = summary ? getSentimentScore(sInsights) : null;
                    const sessionDate = session.startedAt || session.started_at;
                    const sessionEndDate = session.endedAt || session.ended_at;
                    
                    return (
                      <div key={session.id} data-testid={`card-session-${session.id}`}>
                        {index > 0 && <Separator className="my-6" />}
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground" data-testid={`text-session-number-${index}`}>
                                  Session {sessions.length - index}
                                </h3>
                                <Badge variant={session.status === 'ended' ? 'secondary' : 'default'} data-testid={`badge-status-${session.id}`}>
                                  {session.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {sessionDate && new Date(sessionDate).toLocaleDateString()} at{' '}
                                {sessionDate && new Date(sessionDate).toLocaleTimeString()}
                                {sessionEndDate && (
                                  <> &middot; Ended {new Date(sessionEndDate).toLocaleDateString()}</>
                                )}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/chat/${session.id}`)}
                              data-testid={`button-view-chat-${session.id}`}
                            >
                              <MessageSquare className="mr-2 h-4 w-4" />
                              View Chat
                            </Button>
                          </div>

                          {summary ? (
                            <Card data-testid={`card-summary-${session.id}`}>
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {sStage && (
                                    <Badge variant="outline" data-testid={`badge-stage-${session.id}`}>{sStage}</Badge>
                                  )}
                                  {tStatus && (
                                    <Badge className={getTrajectoryColor(tStatus)} data-testid={`badge-trajectory-${session.id}`}>
                                      <span className="mr-1">{getTrajectoryIcon(tStatus)}</span>
                                      {tStatus}
                                    </Badge>
                                  )}
                                  {sentimentScore !== null && (
                                    <Badge variant="secondary" data-testid={`badge-sentiment-${session.id}`}>
                                      Sentiment: {formatSentiment(sentimentScore)}
                                    </Badge>
                                  )}
                                </div>
                                
                                {sSummary && (
                                  <p className="text-sm text-muted-foreground" data-testid={`text-summary-${session.id}`}>
                                    {sSummary}
                                  </p>
                                )}

                                {Array.isArray(sInsights) && sInsights.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-foreground">Key Insights:</p>
                                    <ul className="space-y-1">
                                      {sInsights
                                        .filter((insight: any) => 
                                          typeof insight === 'string' || insight.label !== 'sentiment'
                                        )
                                        .map((insight: any, idx: number) => (
                                          <li key={idx} className="flex gap-2 text-sm text-muted-foreground">
                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                            {typeof insight === 'string' ? insight : insight.insight}
                                          </li>
                                        ))
                                      }
                                    </ul>
                                  </div>
                                )}

                                {sNextAction && (
                                  <div className="pt-2 border-t">
                                    <p className="text-sm">
                                      <span className="font-medium text-foreground">Next Action:</span>{' '}
                                      <span className="text-muted-foreground">{sNextAction}</span>
                                    </p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ) : (
                            <Card>
                              <CardContent className="p-4 text-sm text-muted-foreground">
                                {session.status === 'active' 
                                  ? 'Session in progress \u2014 summary will be generated when completed'
                                  : 'No summary available for this session'
                                }
                              </CardContent>
                            </Card>
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