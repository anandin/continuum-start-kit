import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
  BookOpen,
  ClipboardList,
  BarChart3,
  Sparkles,
  Brain,
  Library,
  Shield,
  ListChecks,
} from "lucide-react";
import { useEngagements } from "@/hooks/useEngagements";
import { TrajectoryChip } from "@/components/TrajectoryChip";
import { isThisWeek } from "date-fns";

interface ProviderDashboardViewProps {
  userId: string;
}

export function ProviderDashboardView({ userId }: ProviderDashboardViewProps) {
  const navigate = useNavigate();
  const {
    loading,
    engagements,
    getSeekerAlias,
    getLastSessionDate,
    getLatestStage,
    getTrajectoryStatus,
  } = useEngagements(userId, "provider");
  const [searchQuery, setSearchQuery] = useState("");

  const activeClients = engagements.filter((e) => e.status === "active").length;

  const sessionsThisWeek = useMemo(() => {
    return engagements.reduce((count, eng) => {
      const weekSessions =
        eng.sessions?.filter(
          (s) => s.started_at && isThisWeek(new Date(s.started_at)),
        ) || [];
      return count + weekSessions.length;
    }, 0);
  }, [engagements]);

  const trajectoryDistribution = useMemo(() => {
    return engagements.reduce(
      (acc, eng) => {
        const status = getTrajectoryStatus(eng);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [engagements, getTrajectoryStatus]);

  const accelerating = trajectoryDistribution.accelerating || 0;
  const atRisk = trajectoryDistribution.stalling || 0;

  const filteredEngagements = useMemo(() => {
    if (!searchQuery) return engagements;
    return engagements.filter((eng) =>
      getSeekerAlias(eng).toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [engagements, searchQuery, getSeekerAlias]);

  const handleOpenChat = async (engagement: any) => {
    const activeSession = engagement.sessions?.find(
      (s: any) => s.status === "active",
    );
    if (activeSession) {
      navigate(`/chat/${activeSession.id}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-warm" data-testid="card-active-clients">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Clients
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {activeClients}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently engaged
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-warm" data-testid="card-sessions-week">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Week
            </CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {sessionsThisWeek}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sessions held</p>
          </CardContent>
        </Card>

        <Card className="shadow-warm" data-testid="card-accelerating">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Thriving
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {accelerating}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Strong progress
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-warm" data-testid="card-at-risk">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Needs Care
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {atRisk}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              May need attention
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-warm" data-testid="card-engagements">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Clients</CardTitle>
                  <CardDescription>
                    Active coaching relationships
                  </CardDescription>
                </div>
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-clients"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredEngagements.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground mb-4">
                    {searchQuery
                      ? "No clients match your search"
                      : "No clients yet"}
                  </p>
                  {!searchQuery && (
                    <Button
                      onClick={() => navigate("/provider/setup")}
                      variant="outline"
                      data-testid="button-setup-program"
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

                    return (
                      <Card
                        key={engagement.id}
                        className="border-border/60 hover:border-primary/30 transition-colors cursor-pointer"
                        onClick={() =>
                          navigate(`/provider/client/${engagement.id}`)
                        }
                        data-testid={`card-client-${engagement.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-11 w-11 rounded-xl border border-border">
                              <AvatarFallback className="rounded-xl bg-primary/8 text-primary font-medium text-sm">
                                {getSeekerAlias(engagement)
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1.5">
                                <div>
                                  <h4 className="font-medium text-foreground text-sm">
                                    {getSeekerAlias(engagement)}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    Last active {getLastSessionDate(engagement)}
                                  </p>
                                </div>
                                <TrajectoryChip status={trajectoryStatus} />
                              </div>

                              <div className="flex items-center gap-2 mb-3">
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-primary/5 border-primary/20 text-primary"
                                >
                                  {getLatestStage(engagement)}
                                </Badge>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                      `/provider/client/${engagement.id}`,
                                    );
                                  }}
                                  data-testid={`button-view-summary-${engagement.id}`}
                                >
                                  <Eye className="mr-1.5 h-3 w-3" />
                                  Summary
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenChat(engagement);
                                  }}
                                  data-testid={`button-open-chat-${engagement.id}`}
                                >
                                  <MessageSquare className="mr-1.5 h-3 w-3" />
                                  Chat
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

        <div className="space-y-4">
          <Card className="shadow-warm" data-testid="card-quick-actions">
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
              <CardDescription>Tools at your fingertips</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => navigate("/provider/onboarding")}
                variant="outline"
                size="sm"
                className="w-full justify-start bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20"
                data-testid="button-rerun-onboarding"
              >
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                Re-run setup chat
              </Button>
              <Button
                onClick={() => navigate("/provider/schedule")}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                data-testid="button-schedule"
              >
                <Calendar className="mr-2 h-4 w-4" /> Schedule
              </Button>
              <Button
                onClick={() => navigate("/provider/resources")}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                data-testid="button-resources"
              >
                <BookOpen className="mr-2 h-4 w-4" /> Resources
              </Button>
              <Button
                onClick={() => navigate("/provider/intake-forms")}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                data-testid="button-intake-forms"
              >
                <ClipboardList className="mr-2 h-4 w-4" /> Intake forms
              </Button>
              <Button
                onClick={() => navigate("/provider/analytics")}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                data-testid="button-analytics"
              >
                <BarChart3 className="mr-2 h-4 w-4" /> Insights
              </Button>
              <Button
                onClick={() => navigate("/provider/setup")}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                data-testid="button-edit-stages"
              >
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-warm" data-testid="card-twin-tower">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Therapist Twin
              </CardTitle>
              <CardDescription>
                Train, review, and supervise your AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => navigate("/provider/twin/calibration")}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                data-testid="button-twin-calibration"
              >
                <Sparkles className="mr-2 h-4 w-4" /> Calibration
              </Button>
              <Button
                onClick={() => navigate("/provider/twin/persona")}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                data-testid="button-twin-persona"
              >
                <Library className="mr-2 h-4 w-4" /> Persona library
              </Button>
              <Button
                onClick={() => navigate("/provider/twin/review")}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                data-testid="button-twin-review"
              >
                <ListChecks className="mr-2 h-4 w-4" /> Review queue
              </Button>
              <Button
                onClick={() => navigate("/provider/twin/audit")}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                data-testid="button-twin-audit"
              >
                <Shield className="mr-2 h-4 w-4" /> Safety audit log
              </Button>
            </CardContent>
          </Card>

          <Card
            className="shadow-warm bg-gradient-warm-card"
            data-testid="card-health-stats"
          >
            <CardHeader>
              <CardTitle className="text-base">Practice Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Active Rate
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {engagements.length > 0
                      ? Math.round((activeClients / engagements.length) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Total Clients
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {engagements.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Sessions This Week
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {sessionsThisWeek}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
