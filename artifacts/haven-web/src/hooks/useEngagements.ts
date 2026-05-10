import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export interface Engagement {
  id: string;
  created_at: string;
  status: string;
  seeker: {
    id: string;
  };
  provider: {
    id: string;
    email: string;
  };
  sessions: Array<{
    id: string;
    started_at: string;
    ended_at: string | null;
    status: string;
    initial_stage: string | null;
    summaries: Array<{
      assigned_stage: string;
      trajectory_status: string;
      session_summary: string;
    }>;
  }>;
}

export function useEngagements(
  userId: string | undefined,
  role: "provider" | "seeker",
) {
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);

  const loadEngagements = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch("/api/engagements", { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to load engagements");
      }
      const data = await res.json();
      setEngagements(data || []);
    } catch (error: any) {
      console.error("Error loading engagements:", error);
      toast.error(error.message || "Failed to load engagements");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadEngagements();
  }, [userId, role, loadEngagements]);

  const getSeekerAlias = useCallback((engagement: Engagement) => {
    return `Seeker-${engagement.seeker?.id?.slice(0, 8) || "unknown"}`;
  }, []);

  const getLastSessionDate = useCallback((engagement: Engagement) => {
    if (!engagement.sessions || engagement.sessions.length === 0)
      return "Never";
    const lastSession = [...engagement.sessions].sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    )[0];
    return new Date(lastSession.started_at).toLocaleDateString();
  }, []);

  const getLatestStage = useCallback((engagement: Engagement) => {
    const sessionsWithSummaries =
      engagement.sessions
        ?.filter((s) => s.summaries && s.summaries.length > 0)
        .sort(
          (a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
        ) || [];

    if (sessionsWithSummaries.length === 0) {
      const lastSession = [...(engagement.sessions || [])].sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      )[0];
      return lastSession?.initial_stage || "Not assessed";
    }
    return sessionsWithSummaries[0].summaries[0].assigned_stage;
  }, []);

  const getTrajectoryStatus = useCallback((engagement: Engagement): string => {
    const sessionsWithSummaries =
      engagement.sessions
        ?.filter((s) => s.summaries && s.summaries.length > 0)
        .sort(
          (a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
        ) || [];

    if (sessionsWithSummaries.length === 0) return "steady";

    const latestSummary = sessionsWithSummaries[0].summaries[0];
    return latestSummary.trajectory_status || "steady";
  }, []);

  return {
    loading,
    engagements,
    getSeekerAlias,
    getLastSessionDate,
    getLatestStage,
    getTrajectoryStatus,
    refetch: loadEngagements,
  };
}
