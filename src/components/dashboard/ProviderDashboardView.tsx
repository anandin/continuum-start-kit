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
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Seekers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEngagements}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accelerating</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trajectoryDistribution.accelerating || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Engagements</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagements.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/provider/setup')} 
              variant="outline" 
              size="sm"
              className="w-full"
            >
              Configure Program
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Engagements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Engagements</CardTitle>
          <CardDescription>
            Click on an engagement to view detailed session history and progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          {engagements.length === 0 ? (
            <div className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                No engagements yet. Seekers will appear here once they start working with you.
              </p>
              <Button onClick={() => navigate('/provider/setup')} variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Set Up Your Program
              </Button>
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
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/provider/engagement/${engagement.id}`)}
                    >
                      <TableCell className="font-medium">
                        {getSeekerAlias(engagement)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getLastSessionDate(engagement)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getLatestStage(engagement)}</Badge>
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
