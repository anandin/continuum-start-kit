import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, MessageSquareQuote } from "lucide-react";

interface MoodEntry {
  id: string;
  day: string;
  score: number;
  note: string | null;
  updatedAt: string;
}

interface MoodEngagementResponse {
  latest: MoodEntry | null;
  entries: MoodEntry[];
}

const SCORE_LABEL: Record<number, { label: string; emoji: string }> = {
  1: { label: "Rough", emoji: "😔" },
  2: { label: "Low", emoji: "🙁" },
  3: { label: "Okay", emoji: "😐" },
  4: { label: "Good", emoji: "🙂" },
  5: { label: "Great", emoji: "😄" },
};

interface MoodPanelProps {
  engagementId: string;
}

export function MoodPanel({ engagementId }: MoodPanelProps) {
  const { data, isLoading } = useQuery<MoodEngagementResponse>({
    queryKey: [`/api/engagements/${engagementId}/mood`, 14],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${engagementId}/mood?days=14`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load mood entries");
      return res.json();
    },
    enabled: !!engagementId,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    const entries = data.entries ?? [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const map = new Map<string, MoodEntry>(entries.map((e) => [e.day, e]));
    const slots: Array<{
      day: string;
      label: string;
      score: number | null;
      note: string | null;
    }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const ymd = d.toISOString().slice(0, 10);
      const entry = map.get(ymd);
      slots.push({
        day: ymd,
        label: d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        score: entry ? entry.score : null,
        note: entry?.note ?? null,
      });
    }
    return slots;
  }, [data]);

  const checkinCount = (data?.entries ?? []).length;
  const latest = data?.latest ?? null;
  const latestMeta = latest ? SCORE_LABEL[latest.score] : null;
  const latestDate = latest
    ? new Date(`${latest.day}T00:00:00Z`).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
      })
    : null;

  if (isLoading) {
    return (
      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle className="text-base">Mood</CardTitle>
          <CardDescription>14-day check-in trend</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-warm" data-testid="mood-panel">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Mood
            </CardTitle>
            <CardDescription>14-day check-in trend</CardDescription>
          </div>
          <div
            className="text-xs text-muted-foreground"
            data-testid="mood-checkin-count"
          >
            {checkinCount} check-in{checkinCount === 1 ? "" : "s"} in window
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {checkinCount === 0 ? (
          <p
            className="text-sm text-muted-foreground text-center py-8"
            data-testid="mood-empty"
          >
            No mood check-ins yet. They will appear here as your client logs how
            they feel each day.
          </p>
        ) : (
          <>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fontSize: 11 }}
                    width={28}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0)
                        return null;
                      const datum = payload[0].payload as {
                        label: string;
                        score: number | null;
                        note: string | null;
                      };
                      if (datum.score == null) {
                        return (
                          <div className="rounded-md border bg-background px-2 py-1 text-xs shadow-sm">
                            <div className="font-medium">{datum.label}</div>
                            <div className="text-muted-foreground">
                              No check-in
                            </div>
                          </div>
                        );
                      }
                      const meta = SCORE_LABEL[datum.score];
                      return (
                        <div className="rounded-md border bg-background px-2 py-1 text-xs shadow-sm max-w-[220px]">
                          <div className="font-medium">{datum.label}</div>
                          <div>
                            {meta?.emoji} {meta?.label} ({datum.score}/5)
                          </div>
                          {datum.note ? (
                            <div className="mt-1 text-muted-foreground italic">
                              "{datum.note}"
                            </div>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {latest && latestMeta ? (
              <div
                className="rounded-md border bg-muted/40 p-3"
                data-testid="mood-latest"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">
                    {latestMeta.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {latestMeta.label}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({latest.score}/5)
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Most recent — {latestDate}
                    </div>
                  </div>
                </div>
                {latest.note ? (
                  <div className="mt-3 flex items-start gap-2 text-sm text-foreground">
                    <MessageSquareQuote className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="italic" data-testid="mood-latest-note">
                      "{latest.note}"
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
