import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  TrendingUp, 
  Calendar,
  AlertTriangle,
  Search,
  MessageSquare,
  Settings,
  FileText,
  Eye,
  Send
} from 'lucide-react';
import { useEngagements } from '@/hooks/useEngagements';
import { TrajectoryChip } from '@/components/TrajectoryChip';
import { format, isThisWeek } from 'date-fns';

interface ProviderDashboardViewProps {
  userId: string;
}

export function ProviderDashboardView({ userId }: ProviderDashboardViewProps) {
  const navigate = useNavigate();
  const { loading, engagements, getSeekerAlias, getLastSessionDate, getLatestStage, getTrajectoryStatus } = useEngagements(userId, 'provider');
  const [searchQuery, setSearchQuery] = useState('');
  const [nudgeText, setNudgeText] = useState('');

  // Calculate KPIs
  const activeClients = engagements.filter(e => e.status === 'active').length;
  
  const sessionsThisWeek = useMemo(() => {
    return engagements.reduce((count, eng) => {
      const weekSessions = eng.sessions?.filter(s => 
        s.started_at && isThisWeek(new Date(s.started_at))
      ) || [];
      return count + weekSessions.length;
    }, 0);
  }, [engagements]);

  const trajectoryDistribution = useMemo(() => {
    return engagements.reduce((acc, eng) => {
      const status = getTrajectoryStatus(eng);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [engagements, getTrajectoryStatus]);

  const accelerating = trajectoryDistribution.accelerating || 0;
  const atRisk = trajectoryDistribution.stalling || 0;

  // Filter engagements by search
  const filteredEngagements = useMemo(() => {
    if (!searchQuery) return engagements;
    return engagements.filter(eng => 
      getSeekerAlias(eng).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [engagements, searchQuery, getSeekerAlias]);

  const handleOpenChat = async (engagement: any) => {
    // Find active session or create new one
    const activeSession = engagement.sessions?.find((s: any) => s.status === 'active');
    if (activeSession) {
      navigate(`/chat/${activeSession.id}`);
    } else {
      // Create new session logic would go here
      console.log('Create new session for engagement:', engagement.id);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeClients}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently engaged</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Sessions This Week</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{sessionsThisWeek}</div>
            <p className="text-xs text-muted-foreground mt-1">Active conversations</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Accelerating</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{accelerating}</div>
            <p className="text-xs text-muted-foreground mt-1">Making great progress</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{atRisk}</div>
            <p className="text-xs text-muted-foreground mt-1">Need attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Engagements - Takes up 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">Active Engagements</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Your current client relationships
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-xl border-border/50 bg-background/50"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredEngagements.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? 'No clients match your search' : 'No active engagements yet'}
                  </p>
                  {!searchQuery && (
                    <Button 
                      onClick={() => navigate('/provider/setup')} 
                      className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Set Up Your Program
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEngagements.map((engagement) => {
                    const trajectoryStatus = getTrajectoryStatus(engagement);
                    const latestSession = engagement.sessions?.[0];
                    const latestSummary = latestSession?.summaries?.[0];
                    const progress = 0; // TODO: Calculate from stage progression
                    
                    return (
                      <Card
                        key={engagement.id}
                        className="rounded-xl border-border/50 bg-background/50 hover:bg-background/80 transition-all cursor-pointer"
                        onClick={() => navigate(`/provider/client/${engagement.id}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-12 w-12 rounded-xl border-2 border-primary/20">
                              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold">
                                {getSeekerAlias(engagement).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-semibold text-foreground">{getSeekerAlias(engagement)}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Last active {getLastSessionDate(engagement)}
                                  </p>
                                </div>
                                <TrajectoryChip status={trajectoryStatus} />
                              </div>
                              
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="outline" className="rounded-lg border-primary/30 bg-primary/5 text-primary">
                                  {getLatestStage(engagement)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {progress}% complete
                                </span>
                              </div>
                              
                              <Progress value={progress} className="h-2 mb-3" />
                              
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/provider/client/${engagement.id}`);
                                  }}
                                >
                                  <Eye className="mr-2 h-3 w-3" />
                                  View Summary
                                </Button>
                                <Button 
                                  size="sm"
                                  className="rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenChat(engagement);
                                  }}
                                >
                                  <MessageSquare className="mr-2 h-3 w-3" />
                                  Open Chat
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Today Panel */}
          <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
            <CardHeader>
              <CardTitle className="text-foreground">Today</CardTitle>
              <CardDescription className="text-muted-foreground">Quick actions and insights</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="nudges" className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/50">
                  <TabsTrigger value="nudges" className="rounded-lg">Nudges</TabsTrigger>
                  <TabsTrigger value="queue" className="rounded-lg">Queue</TabsTrigger>
                  <TabsTrigger value="health" className="rounded-lg">Health</TabsTrigger>
                </TabsList>
                
                <TabsContent value="nudges" className="space-y-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Send a personalized nudge to a client
                  </p>
                  <Textarea
                    placeholder="Type your message here..."
                    value={nudgeText}
                    onChange={(e) => setNudgeText(e.target.value)}
                    className="rounded-xl min-h-[100px] border-border/50 bg-background/50"
                  />
                  <Button 
                    className="w-full rounded-xl"
                    disabled={!nudgeText.trim()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send Nudge
                  </Button>
                </TabsContent>
                
                <TabsContent value="queue" className="mt-4">
                  <div className="text-center py-8">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No pending assignments
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="health" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg. Progress</span>
                      <span className="text-sm font-semibold text-foreground">
                        {engagements.length > 0 
                          ? Math.round(engagements.filter(e => e.status === 'active').length / engagements.length * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Active Rate</span>
                      <span className="text-sm font-semibold text-foreground">
                        {engagements.length > 0 
                          ? Math.round((activeClients / engagements.length) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Agent & Program Card */}
          <Card className="rounded-2xl border-none shadow-soft bg-card-gradient backdrop-blur">
            <CardHeader>
              <CardTitle className="text-foreground">Agent & Program</CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure your coaching setup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                onClick={() => navigate('/provider/agent-setup')} 
                variant="outline" 
                size="sm"
                className="w-full rounded-xl border-border/50 bg-background/50 hover:bg-background/80"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configure Agent
              </Button>
              <Button 
                onClick={() => navigate('/provider/setup')} 
                variant="outline" 
                size="sm"
                className="w-full rounded-xl border-border/50 bg-background/50 hover:bg-background/80"
              >
                <FileText className="mr-2 h-4 w-4" />
                Edit Stages
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
