import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Heart,
} from "lucide-react";
import { toast } from "sonner";

export default function SessionSummary() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && sessionId) {
      loadSummary();
    }
  }, [user, sessionId]);

  const loadSummary = async () => {
    if (!sessionId) {
      toast.error("No session ID provided");
      navigate("/dashboard");
      return;
    }

    setLoading(true);
    try {
      const sessionRes = await fetch(`/api/sessions/${sessionId}`, {
        credentials: "include",
      });
      if (!sessionRes.ok) throw new Error("Session not found");
      const sessionData = await sessionRes.json();
      setSession(sessionData);

      const summaryRes = await fetch(`/api/sessions/${sessionId}/summary`, {
        credentials: "include",
      });
      if (!summaryRes.ok) throw new Error("Failed to load summary");
      const summaryData = await summaryRes.json();

      if (!summaryData) {
        if (sessionData.status === "active") {
          toast.info(
            "This session is still active. End it to generate a summary.",
          );
          navigate(`/chat/${sessionId}`);
        } else {
          setSummary(null);
        }
        setLoading(false);
        return;
      }

      setSummary(summaryData);
    } catch (error: any) {
      console.error("Error loading summary:", error);
      toast.error(error.message || "Failed to load summary");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!sessionId) return;

    setCreating(true);
    try {
      await apiRequest("POST", `/api/sessions/${sessionId}/finish`);
      toast.success("Summary generated successfully!");
      await loadSummary();
    } catch (error: any) {
      console.error("Error generating summary:", error);
      toast.error(error.message || "Failed to generate summary");
    } finally {
      setCreating(false);
    }
  };

  const handleStartNextSession = async () => {
    if (!session || !summary) return;

    setCreating(true);
    try {
      const res = await apiRequest("POST", "/api/sessions", {
        engagementId: session.engagementId,
        initialStage: summary.assignedStage || summary.assigned_stage,
      });
      const newSession = await res.json();
      toast.success("New session started!");
      navigate(`/chat/${newSession.id}`);
    } catch (error: any) {
      console.error("Error creating next session:", error);
      toast.error(error.message || "Failed to start next session");
    } finally {
      setCreating(false);
    }
  };

  const getTrajectoryIcon = (status: string) => {
    switch (status) {
      case "accelerating":
        return <TrendingUp className="h-5 w-5 text-emerald-600" />;
      case "steady":
        return <Activity className="h-5 w-5 text-sky-600" />;
      case "drifting":
        return <TrendingDown className="h-5 w-5 text-amber-600" />;
      case "stalling":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getTrajectoryColor = (status: string) => {
    switch (status) {
      case "accelerating":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
      case "steady":
        return "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
      case "drifting":
        return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
      case "stalling":
        return "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const trajectoryStatus =
    summary?.trajectoryStatus || summary?.trajectory_status;
  const assignedStage = summary?.assignedStage || summary?.assigned_stage;
  const sessionSummary = summary?.sessionSummary || summary?.session_summary;
  const keyInsights = summary?.keyInsights || summary?.key_insights;
  const nextAction = summary?.nextAction || summary?.next_action;

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gradient-warm"
        data-testid="loading-session-summary"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">
            Loading your session summary...
          </p>
        </div>
      </div>
    );
  }

  if (!summary && !creating) {
    return (
      <div className="min-h-screen bg-gradient-warm">
        <header className="border-b bg-card/80 backdrop-blur-lg shadow-warm sticky top-0 z-50">
          <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Session Summary
              </h1>
              <p className="text-sm text-muted-foreground">
                No summary available yet
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card className="shadow-warm-md" data-testid="card-no-summary">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Heart className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle className="mb-2">Summary Not Available</CardTitle>
                <CardDescription>
                  {session?.status === "active"
                    ? "This session is still in progress. End the session to see your personalized summary."
                    : "This session has ended but no summary has been generated yet. Let us create one for you."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {session?.status === "ended" && (
                  <Button
                    onClick={handleGenerateSummary}
                    disabled={creating}
                    data-testid="button-generate-summary"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Summary...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                )}
                {session?.status === "active" && (
                  <Button
                    onClick={() => navigate(`/chat/${sessionId}`)}
                    data-testid="button-back-to-chat"
                  >
                    Back to Chat
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b bg-card/80 backdrop-blur-lg shadow-warm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4 flex-wrap">
          <div>
            <h1
              className="text-2xl font-bold text-foreground flex items-center gap-2"
              data-testid="text-session-complete"
            >
              <CheckCircle className="h-6 w-6 text-emerald-600" />
              Session Complete
            </h1>
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-session-date"
            >
              Completed{" "}
              {new Date(
                session?.endedAt ||
                  session?.ended_at ||
                  session?.startedAt ||
                  session?.started_at,
              ).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="shadow-warm-md" data-testid="card-status">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-warm-accent flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle>Well Done! Session Completed</CardTitle>
                    <CardDescription>
                      Your progress has been thoughtfully analyzed and saved
                    </CardDescription>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2"
                  data-testid="badge-trajectory"
                >
                  {getTrajectoryIcon(trajectoryStatus)}
                  <Badge
                    variant="outline"
                    className={getTrajectoryColor(trajectoryStatus)}
                  >
                    {trajectoryStatus}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="shadow-warm-md" data-testid="card-next-stage">
            <CardHeader>
              <CardTitle>Your Next Stage</CardTitle>
              <CardDescription>
                Based on the progress you made in this session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-md bg-gradient-warm-card p-6 border"
                data-testid="text-assigned-stage"
              >
                <p className="text-2xl font-bold text-foreground">
                  {assignedStage}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-warm-md" data-testid="card-overview">
            <CardHeader>
              <CardTitle>Session Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className="whitespace-pre-wrap text-muted-foreground leading-relaxed"
                data-testid="text-session-summary"
              >
                {sessionSummary}
              </p>
            </CardContent>
          </Card>

          {Array.isArray(keyInsights) && keyInsights.length > 0 && (
            <Card className="shadow-warm-md" data-testid="card-insights">
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
                <CardDescription>
                  Important patterns and observations from your session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {keyInsights.map((insight: any, index: number) => (
                    <li
                      key={index}
                      className="flex gap-3"
                      data-testid={`text-insight-${index}`}
                    >
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      <p className="text-muted-foreground">
                        {typeof insight === "string"
                          ? insight
                          : insight.insight}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {nextAction && (
            <Card className="shadow-warm-md" data-testid="card-next-action">
              <CardHeader>
                <CardTitle>Recommended Next Step</CardTitle>
                <CardDescription>Your path forward</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-gradient-warm-card p-6">
                  <p
                    className="font-medium text-foreground"
                    data-testid="text-next-action"
                  >
                    {nextAction}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4 flex-wrap">
            <Button
              onClick={handleStartNextSession}
              disabled={creating}
              size="lg"
              className="flex-1"
              data-testid="button-start-next-session"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Continue Your Journey
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              size="lg"
              data-testid="button-return-dashboard"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
