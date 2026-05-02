import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Clock } from "lucide-react";

interface ScheduledSession {
  id: string;
  status: string;
  confirmedAt: string | null;
  title: string;
  timezone: string;
  durationMinutes: number;
}

function detectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function fmtTime(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return new Date(iso).toLocaleTimeString();
  }
}

// Cross-app banner shown when a confirmed scheduled session is within
// the next hour. Polls every 60s; the same GET endpoint also lazily
// triggers the seeker's 1h push reminder server-side.
export function SessionReminderBanner() {
  const { user } = useAuth();
  // Force a periodic re-render so the "starts in Xm" countdown ticks
  // even when the upcoming list itself is unchanged.
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const { data } = useQuery<{ scheduledSessions: ScheduledSession[] }>({
    queryKey: ["/api/me/scheduled-sessions"],
    queryFn: async () => (await apiRequest("GET", "/api/me/scheduled-sessions")).json(),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const imminent = useMemo(() => {
    const rows = data?.scheduledSessions ?? [];
    const now = Date.now();
    return rows.find((r) => {
      if (r.status !== "confirmed" || !r.confirmedAt) return false;
      const ts = new Date(r.confirmedAt).getTime();
      return ts > now && ts - now <= 60 * 60_000;
    });
  }, [data]);

  if (!imminent || !imminent.confirmedAt) return null;

  const minutes = Math.max(
    1,
    Math.round((new Date(imminent.confirmedAt).getTime() - Date.now()) / 60_000),
  );
  // Always render in the *viewer's* current local zone, not the row
  // snapshot — the banner is for the person looking at the screen.
  const tz = detectedTimezone();

  return (
    <div
      className="border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      data-testid="session-reminder-banner"
      role="status"
    >
      <div className="container mx-auto max-w-7xl px-4 py-2 flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 shrink-0" />
        <span className="font-medium">{imminent.title}</span>
        <span>starts in {minutes} min — {fmtTime(imminent.confirmedAt, tz)}</span>
      </div>
    </div>
  );
}
