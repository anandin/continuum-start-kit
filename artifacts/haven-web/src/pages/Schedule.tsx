import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  Clock,
  Target,
  CalendarDays,
} from "lucide-react";

interface ScheduleOverview {
  recentSessions: Array<{
    engagementId: string;
    sessionId: string;
    startedAt: string;
    status: string;
  }>;
  inactiveClients: Array<{ engagementId: string; lastActivity: string }>;
  overdueGoals: Array<{
    engagementId: string;
    goalId: string;
    title: string;
    dueDate: string;
  }>;
}

export default function Schedule() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && (!user || role !== "provider")) navigate("/dashboard");
  }, [user, role, loading, navigate]);

  const { data, isLoading } = useQuery<ScheduleOverview>({
    queryKey: ["/api/schedule/overview"],
    enabled: !!user && role === "provider",
  });

  return (
    <AppLayout title="Your week" subtitle="What needs your attention right now">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="shadow-warm animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-accent" /> Inactive clients
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                No activity in 7+ days
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.inactiveClients ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Everyone's engaged. Nice work.
                </p>
              ) : (
                data!.inactiveClients.map((c) => (
                  <button
                    key={c.engagementId}
                    onClick={() =>
                      navigate(`/provider/engagement/${c.engagementId}`)
                    }
                    className="w-full text-left rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition-colors"
                    data-testid={`inactive-${c.engagementId}`}
                  >
                    <p className="text-sm font-medium">Client engagement</p>
                    <p className="text-xs text-muted-foreground">
                      Last activity:{" "}
                      {c.lastActivity
                        ? new Date(c.lastActivity).toLocaleDateString()
                        : "never"}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-warm animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" /> Overdue goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.overdueGoals ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No overdue goals.
                </p>
              ) : (
                data!.overdueGoals.map((g) => (
                  <button
                    key={g.goalId}
                    onClick={() =>
                      navigate(`/provider/engagement/${g.engagementId}`)
                    }
                    className="w-full text-left rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition-colors"
                    data-testid={`overdue-${g.goalId}`}
                  >
                    <p className="text-sm font-medium">{g.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {new Date(g.dueDate).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-warm animate-fade-in md:col-span-2 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" /> Recent sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.recentSessions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent sessions yet.
                </p>
              ) : (
                data!.recentSessions.map((s) => (
                  <button
                    key={s.sessionId}
                    onClick={() =>
                      navigate(`/provider/engagement/${s.engagementId}`)
                    }
                    className="w-full text-left rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition-colors flex items-center justify-between"
                    data-testid={`session-${s.sessionId}`}
                  >
                    <div>
                      <p className="text-sm font-medium">Session</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={s.status === "ended" ? "secondary" : "default"}
                    >
                      {s.status}
                    </Badge>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
