import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, Activity, TrendingUp, MessageSquare } from "lucide-react";

interface PracticeOverview {
  totalClients: number;
  activeClients: number;
  totalSessions: number;
  endedSessions: number;
  avgSessionsPerClient: number;
  stageDistribution: Record<string, number>;
  trajectoryCounts: Record<string, number>;
  sessionsPerWeek: Record<string, number>;
}

const trajectoryColor: Record<string, string> = {
  steady: "bg-primary/70",
  drifting: "bg-amber-500/70",
  stalling: "bg-destructive/70",
  accelerating: "bg-emerald-500/70",
};

export default function Analytics() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && (!user || role !== "provider")) navigate("/dashboard");
  }, [user, role, loading, navigate]);

  const { data, isLoading } = useQuery<PracticeOverview>({
    queryKey: ["/api/analytics/practice-overview"],
    enabled: !!user && role === "provider",
  });

  const stageMax = data ? Math.max(1, ...Object.values(data.stageDistribution)) : 1;
  const trajectoryTotal = data ? Object.values(data.trajectoryCounts).reduce((a, b) => a + b, 0) : 0;
  const sessionDates = data ? Object.entries(data.sessionsPerWeek).sort(([a], [b]) => a.localeCompare(b)).slice(-12) : [];
  const sessionMax = Math.max(1, ...sessionDates.map(([, v]) => v));

  return (
    <AppLayout title="Practice insights" subtitle="A look at your work in numbers">
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data ? (
        <p className="text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPI icon={<Users className="h-4 w-4" />} label="Total clients" value={data.totalClients} />
            <KPI icon={<Activity className="h-4 w-4" />} label="Active engagements" value={data.activeClients} />
            <KPI icon={<MessageSquare className="h-4 w-4" />} label="Sessions held" value={data.totalSessions} />
            <KPI icon={<TrendingUp className="h-4 w-4" />} label="Avg sessions/client" value={data.avgSessionsPerClient} />
          </div>

          {/* Trajectory bar */}
          <Card className="shadow-warm animate-fade-in">
            <CardHeader><CardTitle className="text-base">Trajectory mix</CardTitle></CardHeader>
            <CardContent>
              {trajectoryTotal === 0 ? (
                <p className="text-sm text-muted-foreground">No completed summaries yet.</p>
              ) : (
                <>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    {Object.entries(data.trajectoryCounts).map(([k, v]) => (
                      v > 0 && (
                        <div key={k} className={trajectoryColor[k] || "bg-muted"} style={{ width: `${(v / trajectoryTotal) * 100}%` }} title={`${k}: ${v}`} />
                      )
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    {Object.entries(data.trajectoryCounts).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1.5">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${trajectoryColor[k] || "bg-muted"}`} />
                        <span className="capitalize text-muted-foreground">{k}</span>
                        <span className="font-medium text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Stages and sessions chart */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-warm animate-fade-in">
              <CardHeader><CardTitle className="text-base">Where clients are</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.keys(data.stageDistribution).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stage data yet.</p>
                ) : Object.entries(data.stageDistribution).sort(([, a], [, b]) => b - a).map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{k}</span>
                      <span className="text-muted-foreground">{v}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary/70" style={{ width: `${(v / stageMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-warm animate-fade-in">
              <CardHeader><CardTitle className="text-base">Sessions over time</CardTitle></CardHeader>
              <CardContent>
                {sessionDates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions yet.</p>
                ) : (
                  <div className="flex items-end gap-2 h-32">
                    {sessionDates.map(([date, count]) => (
                      <div key={date} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                        <div className="w-full bg-primary/60 rounded-t" style={{ height: `${(count / sessionMax) * 100}%`, minHeight: "4px" }} title={`${date}: ${count}`} />
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">{date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="shadow-warm animate-fade-in">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{icon}{label}</div>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
