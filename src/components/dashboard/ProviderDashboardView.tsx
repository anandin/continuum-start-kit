import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Briefcase, TrendingUp, Users } from 'lucide-react';
import { useEngagements } from '@/hooks/useEngagements';
import { TrajectoryChip } from '@/components/TrajectoryChip';

interface ProviderDashboardViewProps {
  userId: string;
}

export function ProviderDashboardView({ userId }: ProviderDashboardViewProps) {
  const navigate = useNavigate();
  const { loading, engagements, getSeekerAlias, getLastSessionDate, getLatestStage, getTrajectoryStatus } = useEngagements(userId, 'provider');

  // Calculate quick metrics
  const activeEngagements = engagements.filter(e => e.status === 'active').length;
  const trajectoryDistribution = engagements.reduce((acc, eng) => {
    const status = getTrajectoryStatus(eng);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full bg-slate-800" />
        <Skeleton className="h-96 w-full bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Active Seekers</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{activeEngagements}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Accelerating</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{trajectoryDistribution.accelerating || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Engagements</CardTitle>
            <Briefcase className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{engagements.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Quick Actions</CardTitle>
            <Settings className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              onClick={() => navigate('/provider/setup')} 
              variant="outline" 
              size="sm"
              className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Configure Program
            </Button>
            <Button 
              onClick={() => navigate('/provider/agent-setup')} 
              variant="outline" 
              size="sm"
              className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Setup AI Agent
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Engagements Table */}
      <Card className="bg-slate-900/50 border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white">Active Engagements</CardTitle>
          <CardDescription className="text-slate-400">
            Click on an engagement to view detailed session history and progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          {engagements.length === 0 ? (
            <div className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-slate-500 mb-4" />
              <p className="text-slate-400 mb-4">
                No engagements yet. Seekers will appear here once they start working with you.
              </p>
              <Button onClick={() => navigate('/provider/setup')} variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Settings className="mr-2 h-4 w-4" />
                Set Up Your Program
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-300">Seeker</TableHead>
                  <TableHead className="text-slate-300">Last Session</TableHead>
                  <TableHead className="text-slate-300">Current Stage</TableHead>
                  <TableHead className="text-slate-300">Trajectory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {engagements.map((engagement) => {
                  const trajectoryStatus = getTrajectoryStatus(engagement);
                  return (
                    <TableRow
                      key={engagement.id}
                      className="cursor-pointer border-white/10 hover:bg-white/5 transition-colors"
                      onClick={() => navigate(`/provider/engagement/${engagement.id}`)}
                    >
                      <TableCell className="font-medium text-white">
                        {getSeekerAlias(engagement)}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {getLastSessionDate(engagement)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-white/20 bg-white/5 text-white">{getLatestStage(engagement)}</Badge>
                      </TableCell>
                      <TableCell>
                        <TrajectoryChip status={trajectoryStatus} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
