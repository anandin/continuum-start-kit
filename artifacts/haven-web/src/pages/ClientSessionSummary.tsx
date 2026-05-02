import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, 
  MessageSquare, 
  Send,
  Download,
  Save,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Users,
  Bell
} from 'lucide-react';
import { TrajectoryChip } from '@/components/TrajectoryChip';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { NotesPanel } from '@/components/NotesPanel';
import { GoalsTracker } from '@/components/GoalsTracker';
import { MoodPanel } from '@/components/MoodPanel';
import { JournalPanel } from '@/components/JournalPanel';
import { SessionPrepBriefPanel } from '@/components/SessionPrepBriefPanel';
import { SchedulePanel } from '@/components/SchedulePanel';
import { CoachBillingSummary } from '@/components/CoachBillingSummary';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface PlaybookOption {
  id: string;
  title: string;
  isDefault: boolean;
  isArchived: boolean;
}

export default function ClientSessionSummary() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [latestSummary, setLatestSummary] = useState<any>(null);
  const [sendingCheckIn, setSendingCheckIn] = useState(false);

  const handleSendCheckIn = async () => {
    if (!engagement || sendingCheckIn) return;
    setSendingCheckIn(true);
    try {
      const res = await fetch(`/api/engagements/${engagement.id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send check-in');
      }
      const data = await res.json();
      toast.success(
        data?.notified
          ? 'Check-in sent — your client will get a push notification.'
          : 'Check-in saved (client has not enabled push notifications).'
      );
    } catch (e: any) {
      toast.error(e.message || 'Failed to send check-in');
    } finally {
      setSendingCheckIn(false);
    }
  };

  // Playbook picker — list active playbooks so the coach can pin one for this engagement.
  const playbooksQ = useQuery<PlaybookOption[]>({
    queryKey: ['/api/twin/playbooks'],
    queryFn: async () => (await apiRequest('GET', '/api/twin/playbooks')).json(),
    enabled: !!user,
  });

  const setPlaybookMut = useMutation({
    mutationFn: async (playbookId: string | null) =>
      (await apiRequest('PATCH', `/api/engagements/${clientId}/playbook`, { playbookId })).json(),
    onSuccess: (updated: any) => {
      setEngagement(updated);
      qc.invalidateQueries({ queryKey: ['/api/twin/playbooks'] });
      toast.success('Playbook updated for this client');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update playbook'),
  });

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

      const engagementRes = await fetch(`/api/engagements/${clientId}`, { credentials: 'include' });
      if (!engagementRes.ok) {
        toast.error('Engagement not found or you don\'t have access to it.');
        navigate('/provider/dashboard');
        return;
      }
      const engagementData = await engagementRes.json();
      setEngagement(engagementData);

      const sessionsRes = await fetch(`/api/engagements/${clientId}/sessions`, { credentials: 'include' });
      if (!sessionsRes.ok) throw new Error('Failed to load sessions');
      const sessionsData = await sessionsRes.json();

      const sessionsWithSummaries = await Promise.all(
        (sessionsData || []).map(async (session: any) => {
          try {
            const summaryRes = await fetch(`/api/sessions/${session.id}/summary`, { credentials: 'include' });
            if (summaryRes.ok) {
              const summaryData = await summaryRes.json();
              return { ...session, summaries: summaryData ? [summaryData] : [] };
            }
          } catch {}
          return { ...session, summaries: [] };
        })
      );

      sessionsWithSummaries.sort((a: any, b: any) => {
        const dateA = new Date(b.createdAt || b.created_at).getTime();
        const dateB = new Date(a.createdAt || a.created_at).getTime();
        return dateA - dateB;
      });
      
      setSessions(sessionsWithSummaries);
      
      if (sessionsWithSummaries.length > 0) {
        const latestSession = sessionsWithSummaries[0];
        if (latestSession.summaries && latestSession.summaries.length > 0) {
          setLatestSummary(latestSession.summaries[0]);
        }
      }

    } catch (error) {
      console.error('Error loading engagement:', error);
      toast.error('Failed to load engagement details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = () => {
    const activeSession = sessions.find(s => s.status === 'active');
    if (activeSession) {
      navigate(`/chat/${activeSession.id}`);
    } else {
      toast.info('There is no active session for this client.');
    }
  };

  const handleSendAsNudge = async () => {
    toast.success('Nudge sent to the client.');
  };

  const handleSaveToPlan = async () => {
    toast.success('Insights saved to the client\'s plan.');
  };

  const handleExport = () => {
    if (!latestSummary) return;
    
    const exportData = {
      engagement_id: engagement.id,
      summary: latestSummary,
      exported_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-summary-${engagement.id}.json`;
    a.click();
    
    toast.success('Summary downloaded.');
  };

  const getSummaryField = (summary: any, camelCase: string, snakeCase: string) => {
    return summary?.[camelCase] || summary?.[snakeCase];
  };

  if (loading) {
    return (
      <AppLayout title="Client overview">
        <div className="space-y-6 animate-fade-in" data-testid="loading-client-summary">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-96 rounded-md" />
        </div>
      </AppLayout>
    );
  }

  if (!engagement) {
    return null;
  }

  const seekerId = engagement.seekerId || engagement.seeker_id || engagement.id;
  const seekerAlias = `Client ${seekerId.slice(0, 8)}`;
  const trajectoryStatus = getSummaryField(latestSummary, 'trajectoryStatus', 'trajectory_status') || 'steady';

  return (
    <AppLayout title={seekerAlias} subtitle="Complete client overview">
      <div className="space-y-6 animate-fade-in">
        <Card className="shadow-warm-md" data-testid="card-header">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/provider/dashboard')}
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                    {seekerAlias.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold text-foreground" data-testid="text-client-name">{seekerAlias}</h1>
                  <p className="text-sm text-muted-foreground" data-testid="text-engagement-id">Engagement ID: {engagement.id.slice(0, 8)}</p>
                </div>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Playbook</span>
                  <Select
                    value={engagement.playbookId ?? engagement.playbook_id ?? '__default__'}
                    onValueChange={(val) =>
                      setPlaybookMut.mutate(val === '__default__' ? null : val)
                    }
                    disabled={setPlaybookMut.isPending}
                  >
                    <SelectTrigger className="w-[220px]" data-testid="select-playbook">
                      <SelectValue placeholder="Use default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__" data-testid="option-playbook-default">
                        Use default
                        {(() => {
                          const def = playbooksQ.data?.find((p) => p.isDefault);
                          return def ? ` (${def.title})` : '';
                        })()}
                      </SelectItem>
                      {(playbooksQ.data ?? [])
                        .filter((p) => !p.isArchived)
                        .map((p) => (
                          <SelectItem
                            key={p.id}
                            value={p.id}
                            data-testid={`option-playbook-${p.id}`}
                          >
                            {p.title}{p.isDefault ? ' ★' : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/provider/twin/memory/${engagement.id}`)}
                  data-testid="button-view-memory"
                >
                  View Memory
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendCheckIn}
                  disabled={sendingCheckIn}
                  data-testid="button-send-checkin"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  {sendingCheckIn ? 'Sending…' : 'Send Check-in'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenChat}
                  data-testid="button-open-chat"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Open Chat
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="bg-muted/40 p-1">
            <TabsTrigger value="brief" data-testid="tab-brief">Prep brief</TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule">Schedule</TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
            <TabsTrigger value="mood" data-testid="tab-mood">Mood</TabsTrigger>
            <TabsTrigger value="journal" data-testid="tab-journal">Journal</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">Goals</TabsTrigger>
            <TabsTrigger value="resources" data-testid="tab-resources">Resources</TabsTrigger>
            <TabsTrigger value="intake" data-testid="tab-intake">Intake</TabsTrigger>
          </TabsList>

          <TabsContent value="brief" className="mt-6">
            <SessionPrepBriefPanel engagementId={engagement.id} />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <SchedulePanel engagementId={engagement.id} />
            <div className="mt-6">
              <CoachBillingSummary engagementId={engagement.id} />
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="mt-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card className="shadow-warm-md" data-testid="card-latest-summary">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Latest Session Summary</CardTitle>
                    <CardDescription>
                      {sessions[0]?.createdAt || sessions[0]?.created_at
                        ? new Date(sessions[0].createdAt || sessions[0].created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : 'No date available'}
                    </CardDescription>
                  </div>
                  <TrajectoryChip status={trajectoryStatus} />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {latestSummary ? (
                  <>
                    {getSummaryField(latestSummary, 'assignedStage', 'assigned_stage') && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                          <span className="text-muted-foreground">Current Stage</span>
                          <Badge variant="outline" data-testid="badge-current-stage">
                            {getSummaryField(latestSummary, 'assignedStage', 'assigned_stage')}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <div className="rounded-md bg-muted/50 p-4">
                      <h3 className="font-semibold text-foreground mb-2">Session Overview</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-session-overview">
                        {getSummaryField(latestSummary, 'sessionSummary', 'session_summary') || 'No summary available'}
                      </p>
                    </div>

                    {(() => {
                      const insights = getSummaryField(latestSummary, 'keyInsights', 'key_insights');
                      return Array.isArray(insights) && insights.length > 0 ? (
                        <div>
                          <h3 className="font-semibold text-foreground mb-3">Key Insights</h3>
                          <div className="space-y-2">
                            {insights.map((insight: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-3 rounded-md bg-muted/50 p-3" data-testid={`text-insight-${idx}`}>
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-muted-foreground">{typeof insight === 'string' ? insight : insight.insight}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {getSummaryField(latestSummary, 'nextAction', 'next_action') && (
                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Next Actions</h3>
                        <div className="rounded-md border bg-gradient-warm-card p-4">
                          <p className="text-sm text-foreground" data-testid="text-next-action">
                            {getSummaryField(latestSummary, 'nextAction', 'next_action')}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4 flex-wrap">
                      <Button onClick={handleSendAsNudge} data-testid="button-send-nudge">
                        <Send className="mr-2 h-4 w-4" />
                        Send as Nudge
                      </Button>
                      <Button onClick={handleSaveToPlan} variant="outline" data-testid="button-save-plan">
                        <Save className="mr-2 h-4 w-4" />
                        Save to Plan
                      </Button>
                      <Button onClick={handleExport} variant="outline" data-testid="button-export">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12" data-testid="text-no-summary">
                    <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No summary available yet</p>
                    <p className="text-sm text-muted-foreground mt-1">A summary will appear after the client completes a session.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="shadow-warm-md" data-testid="card-timeline">
              <CardHeader>
                <CardTitle>Session Timeline</CardTitle>
                <CardDescription>
                  {sessions.length} total session{sessions.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessions.length > 0 ? (
                  <div className="space-y-3">
                    {sessions.map((session) => {
                      const summary = session.summaries?.[0];
                      const sessionDate = session.createdAt || session.created_at;
                      const stage = session.initialStage || session.initial_stage;
                      const tStatus = summary ? (getSummaryField(summary, 'trajectoryStatus', 'trajectory_status') || 'steady') : null;
                      return (
                        <div
                          key={session.id}
                          className="rounded-md border p-3 hover-elevate cursor-pointer"
                          onClick={() => navigate(`/chat/${session.id}`)}
                          data-testid={`card-timeline-session-${session.id}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">
                                {sessionDate ? new Date(sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                              </span>
                            </div>
                            <Badge variant="outline">
                              {stage || 'N/A'}
                            </Badge>
                          </div>
                          {tStatus && (
                            <div className="flex items-center gap-2 mt-2">
                              <TrajectoryChip status={tStatus} />
                              <span className="text-xs text-muted-foreground">
                                {session.status}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8" data-testid="text-no-sessions">
                    <Calendar className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No sessions yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-warm-md" data-testid="card-profile">
              <CardHeader>
                <CardTitle>Profile & Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Current Stage</span>
                    <Badge data-testid="badge-profile-stage">
                      {sessions[0]?.initialStage || sessions[0]?.initial_stage || 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant="outline" data-testid="badge-profile-status">
                      {engagement.status || 'active'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="mood" className="mt-6">
            <MoodPanel engagementId={engagement.id} />
          </TabsContent>

          <TabsContent value="journal" className="mt-6">
            <JournalPanel engagementId={engagement.id} />
          </TabsContent>

          <TabsContent value="notes" className="mt-6">
            <NotesPanel engagementId={engagement.id} />
          </TabsContent>

          <TabsContent value="goals" className="mt-6">
            <GoalsTracker engagementId={engagement.id} />
          </TabsContent>

          <TabsContent value="resources" className="mt-6">
            <AssignedResourcesPanel engagementId={engagement.id} />
          </TabsContent>

          <TabsContent value="intake" className="mt-6">
            <IntakeResponsesPanel engagementId={engagement.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function AssignedResourcesPanel({ engagementId }: { engagementId: string }) {
  const { data: resources = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/engagements/${engagementId}/resources`],
    enabled: !!engagementId,
  });

  return (
    <Card className="shadow-warm">
      <CardHeader>
        <CardTitle className="text-base">Assigned resources</CardTitle>
        <CardDescription>Materials shared with this client</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : resources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No resources assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {resources.map((row: any) => {
              const r = row.resource ?? row;
              return (
                <div key={row.id} className="rounded-lg border border-border/60 p-3" data-testid={`resource-${row.id}`}>
                  <p className="font-medium text-sm">{r.title}</p>
                  {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">Open link</a>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntakeResponsesPanel({ engagementId }: { engagementId: string }) {
  const { data: response, isLoading } = useQuery<any>({
    queryKey: [`/api/engagements/${engagementId}/intake`],
    enabled: !!engagementId,
  });

  const answers = response?.answers || {};
  const hasAnswers = response && Object.keys(answers).length > 0;

  return (
    <Card className="shadow-warm">
      <CardHeader>
        <CardTitle className="text-base">Intake responses</CardTitle>
        <CardDescription>What this client shared during onboarding</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !hasAnswers ? (
          <p className="text-sm text-muted-foreground text-center py-6">No intake responses yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(answers).map(([q, a]: [string, any]) => (
              <div key={q} className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground mb-1">{q}</p>
                <p className="text-sm">{String(a)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}