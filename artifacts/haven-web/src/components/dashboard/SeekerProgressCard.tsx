import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Calendar,
  CheckSquare,
  ChevronRight,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type StreakStatus = "active" | "keep-going" | "none";

interface MoodPoint {
  day: string;
  score: number;
  note: string | null;
}

interface SeekerProgressSnapshot {
  sessionsCompleted: number;
  moodSeries: MoodPoint[];
  streak: {
    current: number;
    status: StreakStatus;
    lastCheckInDay: string | null;
  };
  goalsThisWeek: number;
  hasSeekerProfile: boolean;
}

async function fetchSeekerProgress(): Promise<SeekerProgressSnapshot> {
  const res = await fetch("/api/seeker/progress", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load progress");
  return res.json();
}

export type SeekerProgressTile = "sessions" | "streak" | "goals" | "mood";

interface SeekerProgressCardProps {
  onTileNavigate?: (tile: SeekerProgressTile) => void;
}

export function SeekerProgressCard({
  onTileNavigate,
}: SeekerProgressCardProps = {}) {
  const handleNav = (tile: SeekerProgressTile) => onTileNavigate?.(tile);
  const progressQ = useQuery({
    queryKey: ["seeker-progress"],
    queryFn: fetchSeekerProgress,
  });

  if (progressQ.isLoading) {
    return (
      <Card className="shadow-warm" data-testid="card-seeker-progress">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            My progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
        </CardContent>
      </Card>
    );
  }

  if (progressQ.error || !progressQ.data) {
    return (
      <Card className="shadow-warm" data-testid="card-seeker-progress-error">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            We couldn't load your progress right now. Try again in a moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  const snapshot = progressQ.data;

  return (
    <Card className="shadow-warm" data-testid="card-seeker-progress">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          My progress
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Your gentle snapshot — small, steady moves count.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ProgressTile
            icon={<Calendar className="h-4 w-4 text-primary" />}
            label="Sessions"
            value={String(snapshot.sessionsCompleted)}
            isEmpty={snapshot.sessionsCompleted === 0}
            emptyHint="Start your first session"
            onClick={() => handleNav("sessions")}
            testId="progress-tile-sessions"
          />
          <StreakTile
            streak={snapshot.streak}
            onClick={() => handleNav("streak")}
          />
          <ProgressTile
            icon={<CheckSquare className="h-4 w-4 text-primary" />}
            label="Goal check-ins this week"
            value={String(snapshot.goalsThisWeek)}
            isEmpty={snapshot.goalsThisWeek === 0}
            emptyHint="Add a goal with your coach"
            onClick={() => handleNav("goals")}
            testId="progress-tile-goals"
          />
          <ProgressTile
            icon={<Activity className="h-4 w-4 text-primary" />}
            label="Mood logged"
            value={String(snapshot.moodSeries.length)}
            isEmpty={snapshot.moodSeries.length === 0}
            emptyHint="Log a mood from your phone"
            onClick={() => handleNav("mood")}
            testId="progress-tile-mood"
          />
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Mood — last 30 days
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {snapshot.moodSeries.length} check-in
              {snapshot.moodSeries.length === 1 ? "" : "s"}
            </span>
          </div>
          <MoodTrendChart entries={snapshot.moodSeries} />
        </div>

        {!snapshot.hasSeekerProfile && (
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-3.5">
            <p className="text-sm text-foreground font-medium mb-1">
              Finish setting up your seeker profile
            </p>
            <p className="text-xs text-muted-foreground">
              Connect with a coach to start tracking your journey here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ProgressTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  isEmpty: boolean;
  emptyHint: string;
  onClick: () => void;
  testId?: string;
}

function ProgressTile({
  icon,
  label,
  value,
  isEmpty,
  emptyHint,
  onClick,
  testId,
}: ProgressTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-3.5 text-left transition-shadow hover:shadow-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-center justify-between">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {isEmpty ? (
        <p className="text-xs text-foreground leading-snug">{emptyHint}</p>
      ) : (
        <p className="text-2xl font-semibold text-foreground">{value}</p>
      )}
    </button>
  );
}

function StreakTile({
  streak,
  onClick,
}: {
  streak: SeekerProgressSnapshot["streak"];
  onClick: () => void;
}) {
  const isEmpty = streak.status === "none";
  const valueText = isEmpty
    ? "0 days"
    : `${streak.current} day${streak.current === 1 ? "" : "s"}`;

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="progress-tile-streak"
      className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-3.5 text-left transition-shadow hover:shadow-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-center justify-between">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Check-in streak
      </p>
      {isEmpty ? (
        <p className="text-xs text-foreground leading-snug">
          Log a mood or journal entry to start
        </p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl font-semibold text-foreground">
            {valueText}
          </span>
          {streak.status === "keep-going" && (
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 border-accent/40 text-accent-foreground bg-accent/15"
            >
              Keep going
            </Badge>
          )}
          {streak.status === "active" && (
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 border-primary/30 text-primary bg-primary/10"
            >
              On track
            </Badge>
          )}
        </div>
      )}
    </button>
  );
}

function MoodTrendChart({ entries }: { entries: MoodPoint[] }) {
  // Build a 30-slot series so the line spans the full window even with gaps.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = 30;
  const slots: Array<{ day: string; label: string; score: number | null }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    slots.push({
      day,
      label: d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      score: null,
    });
  }
  const map = new Map(entries.map((e) => [e.day, e.score]));
  for (const slot of slots) {
    const v = map.get(slot.day);
    if (typeof v === "number") slot.score = v;
  }

  const hasAnyPoint = slots.some((s) => s.score != null);

  if (!hasAnyPoint) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Tap "Log mood" each day on the mobile app. Your trend will fill in over
        the next month.
      </p>
    );
  }

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={slots}
          margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
        >
          <XAxis
            dataKey="label"
            interval={6}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            stroke="hsl(var(--muted-foreground) / 0.2)"
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            stroke="hsl(var(--muted-foreground) / 0.2)"
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
            }}
            formatter={(value) => [value == null ? "—" : String(value), "Mood"]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
