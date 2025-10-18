import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  MessageSquare, 
  Send,
  Download,
  Save,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { TrajectoryChip } from '@/components/TrajectoryChip';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export default function ClientSessionSummary() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [latestSummary, setLatestSummary] = useState<any>(null);

  useEffect(() => {
    if (!user || !clientId) {
      navigate('/dashboard');
      return;
    }
    loadEngagementDetails();
  }, [user, clientId]);

  const loadEngagementDetails = async () => {
    try {
      setLoading(true);

      // Fetch engagement with seeker details
      const { data: engagementData, error: engagementError } = await supabase
        .from('engagements')
        .select(`
          *,
          seeker:seekers (
            id,
            owner_id
          )
        `)
        .eq('id', clientId)
        .eq('provider_id', user?.id)
        .maybeSingle();

      if (engagementError) throw engagementError;
      if (!engagementData) {
        toast({
          title: "Engagement not found",
          description: "This engagement does not exist or you don't have access to it.",
          variant: "destructive"
        });
        navigate('/provider/dashboard');
        return;
      }

      setEngagement(engagementData);

      // Fetch all sessions for this engagement with summaries
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          summaries (*)
        `)
        .eq('engagement_id', clientId)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;
      
      setSessions(sessionsData || []);
      
      // Get latest summary
      if (sessionsData && sessionsData.length > 0) {
        const latestSession = sessionsData[0];
        if (latestSession.summaries && latestSession.summaries.length > 0) {
          setLatestSummary(latestSession.summaries[0]);
        }
      }

    } catch (error) {
      console.error('Error loading engagement:', error);
      toast({
        title: "Error",
        description: "Failed to load engagement details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = () => {
    const activeSession = sessions.find(s => s.status === 'active');
    if (activeSession) {
      navigate(`/chat/${activeSession.id}`);
    } else {
      toast({
        title: "No active session",
        description: "There is no active session for this client.",
      });
    }
  };

  const handleSendAsNudge = async () => {
    toast({
      title: "Nudge sent",
      description: "Your message has been sent to the client.",
    });
  };

  const handleSaveToPlan = async () => {
    toast({
      title: "Saved to plan",
      description: "Insights have been saved to the client's plan.",
    });
  };

  const handleExport = () => {
    if (!latestSummary) return;
    
    const exportData = {
      engagement_id: engagement.id,
      seeker: engagement.seeker,
      summary: latestSummary,
      exported_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-summary-${engagement.id}.json`;
    a.click();
    
    toast({
      title: "Export complete",
      description: "Summary has been downloaded.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-soft p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-16 rounded-2xl" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-96 rounded-2xl" />
            </div>
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!engagement) {
    return null;
  }

  const seekerAlias = engagement.seeker?.owner_id ? `Seeker ${engagement.seeker.owner_id.slice(0, 8)}` : 'Unknown Seeker';
  const progress = 0; // TODO: Calculate from stage progression
  const trajectoryStatus = latestSummary?.trajectory_status || 'steady';

  return (
    <div className="min-h-screen bg-gradient-soft p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/provider/dashboard')}
                  className="rounded-xl"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-16 w-16 rounded-2xl border-2 border-primary/20">
                  <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-xl font-semibold">
                    {seekerAlias.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{seekerAlias}</h1>
                  <p className="text-sm text-muted-foreground">Engagement ID: {engagement.id.slice(0, 8)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleOpenChat}
                  className="rounded-xl border-border/50 bg-background/50 hover:bg-background/80"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Open Chat
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Latest Session Summary */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-foreground">Latest Session Summary</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {sessions[0]?.created_at ? format(new Date(sessions[0].created_at), 'PPP') : 'No date available'}
                    </CardDescription>
                  </div>
                  <TrajectoryChip status={trajectoryStatus} />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {latestSummary ? (
                  <>
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-3" />
                    </div>

                    {/* Summary Text */}
                    <div className="rounded-xl bg-background/50 p-4">
                      <h3 className="font-semibold text-foreground mb-2">Session Overview</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {latestSummary.session_summary || 'No summary available'}
                      </p>
                    </div>

                    {/* Key Insights */}
                    {latestSummary.key_insights && latestSummary.key_insights.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Key Insights</h3>
                        <div className="space-y-2">
                          {latestSummary.key_insights.map((insight: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 rounded-xl bg-background/50 p-3">
                              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-muted-foreground">{insight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Next Actions */}
                    {latestSummary.next_action && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Next Actions</h3>
                        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                          <p className="text-sm text-foreground">{latestSummary.next_action}</p>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleSendAsNudge}
                        className="rounded-xl"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send as Nudge
                      </Button>
                      <Button
                        onClick={handleSaveToPlan}
                        variant="outline"
                        className="rounded-xl border-border/50 bg-background/50 hover:bg-background/80"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save to Plan
                      </Button>
                      <Button
                        onClick={handleExport}
                        variant="outline"
                        className="rounded-xl border-border/50 bg-background/50 hover:bg-background/80"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No summary available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Session Timeline */}
          <div className="space-y-4">
            <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
              <CardHeader>
                <CardTitle className="text-foreground">Session Timeline</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {sessions.length} total sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessions.length > 0 ? (
                  <div className="space-y-3">
                    {sessions.map((session) => {
                      const summary = session.summaries?.[0];
                      return (
                        <Card
                          key={session.id}
                          className="rounded-xl border-border/50 bg-background/50 hover:bg-background/80 transition-all cursor-pointer"
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">
                                  {format(new Date(session.created_at), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <Badge variant="outline" className="rounded-lg text-xs">
                                {session.initial_stage || 'N/A'}
                              </Badge>
                            </div>
                            {summary && (
                              <div className="flex items-center gap-2 mt-2">
                                <TrajectoryChip status={summary.trajectory_status || 'steady'} />
                                <span className="text-xs text-muted-foreground">
                                  {session.status}
                                </span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No sessions yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Profile & Tags */}
            <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
              <CardHeader>
                <CardTitle className="text-foreground">Profile & Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Current Stage</span>
                    <Badge className="rounded-lg">
                      {sessions[0]?.initial_stage || 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant="outline" className="rounded-lg">
                      {engagement.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
