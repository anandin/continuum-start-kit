import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Engagement {
  id: string;
  created_at: string;
  seeker: {
    id: string;
  };
  sessions: Array<{
    id: string;
    started_at: string;
    ended_at: string | null;
    summaries: Array<{
      assigned_stage: string;
      trajectory_status: string;
    }>;
  }>;
  progress_indicators: Array<{
    type: string;
    created_at: string;
  }>;
}

export default function ProviderDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);

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

    loadEngagements();
  }, [user, profile]);

  const loadEngagements = async () => {
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
            summaries (
              assigned_stage,
              trajectory_status
            )
          ),
          progress_indicators (
            type,
            created_at
          )
        `)
        .eq('provider_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEngagements((data as any) || []);
    } catch (error: any) {
      console.error('Error loading engagements:', error);
      toast.error(error.message || 'Failed to load engagements');
    } finally {
      setLoading(false);
    }
  };

  const getSeekerAlias = (engagement: Engagement) => {
    return `Seeker-${engagement.seeker.id.slice(0, 8)}`;
  };

  const getLastSessionDate = (engagement: Engagement) => {
    if (!engagement.sessions || engagement.sessions.length === 0) return 'Never';
    const lastSession = engagement.sessions.sort((a, b) => 
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )[0];
    return new Date(lastSession.started_at).toLocaleDateString();
  };

  const getLatestStage = (engagement: Engagement) => {
    const sessionsWithSummaries = engagement.sessions
      .filter(s => s.summaries && s.summaries.length > 0)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    
    if (sessionsWithSummaries.length === 0) return 'Not assessed';
    return sessionsWithSummaries[0].summaries[0].assigned_stage;
  };

  const getTrajectoryStatus = (engagement: Engagement): string => {
    // Get latest summary trajectory
    const sessionsWithSummaries = engagement.sessions
      .filter(s => s.summaries && s.summaries.length > 0)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    
    if (sessionsWithSummaries.length === 0) return 'steady';

    const latestSummary = sessionsWithSummaries[0].summaries[0];
    let trajectoryStatus = latestSummary.trajectory_status || 'steady';

    // Check recent indicators (last 7 days)
    const recentIndicators = engagement.progress_indicators.filter(ind => {
      const daysSince = (Date.now() - new Date(ind.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    });

    // Downgrade trajectory if recent concerning indicators
    const concerningTypes = ['drift', 'stall', 'disengagement', 'repetition', 'no_progress'];
    const hasConcerningIndicators = recentIndicators.some(ind => 
      concerningTypes.includes(ind.type)
    );

    if (hasConcerningIndicators && trajectoryStatus === 'steady') {
      trajectoryStatus = 'drifting';
    }

    return trajectoryStatus;
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Provider Dashboard
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your engagements and track progress
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Active Engagements</CardTitle>
            <CardDescription>
              Click on an engagement to view detailed session history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {engagements.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No engagements yet. Seekers will appear here once they start working with you.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seeker</TableHead>
                    <TableHead>Last Session</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Trajectory</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {engagements.map((engagement) => {
                    const trajectoryStatus = getTrajectoryStatus(engagement);
                    return (
                      <TableRow
                        key={engagement.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/provider/engagement/${engagement.id}`)}
                      >
                        <TableCell className="font-medium">
                          {getSeekerAlias(engagement)}
                        </TableCell>
                        <TableCell>{getLastSessionDate(engagement)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getLatestStage(engagement)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTrajectoryColor(trajectoryStatus)}>
                            <span className="mr-1">{getTrajectoryIcon(trajectoryStatus)}</span>
                            {trajectoryStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
