import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

interface ScheduledSession {
  id: string;
  status: string;
  confirmedAt: string | null;
  title: string;
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
    });
  } catch {
    return new Date(iso).toLocaleTimeString();
  }
}

// App-wide reminder banner shown across every screen when a confirmed
// scheduled session is within the next hour. Mounted in the mobile
// root layout (mirroring the web SessionReminderBanner in AppLayout)
// so the requirement of an in-app reminder visible across the app —
// not just on the home tab — is met.
export function SessionReminderBanner() {
  const { user } = useAuth();
  const colors = useColors();

  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const sessionsQ = useQuery({
    queryKey: ["scheduled-sessions", "me"],
    queryFn: () =>
      api<{ scheduledSessions: ScheduledSession[] }>(
        "/api/me/scheduled-sessions",
      ),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const imminent = useMemo(() => {
    const rows = sessionsQ.data?.scheduledSessions ?? [];
    const now = Date.now();
    return rows.find((r) => {
      if (r.status !== "confirmed" || !r.confirmedAt) return false;
      const ts = new Date(r.confirmedAt).getTime();
      return ts > now && ts - now <= 60 * 60_000;
    });
  }, [sessionsQ.data]);

  if (!user || !imminent || !imminent.confirmedAt) return null;

  const minutes = Math.max(
    1,
    Math.round((new Date(imminent.confirmedAt).getTime() - Date.now()) / 60_000),
  );
  const tz = detectedTimezone();

  return (
    <View
      testID="mobile-session-reminder-banner"
      style={[
        styles.banner,
        {
          backgroundColor: colors.primary,
          paddingTop: Platform.OS === "ios" ? 44 : 8,
        },
      ]}
    >
      <Feather name="clock" size={14} color={colors.primaryForeground} />
      <Text
        style={[styles.text, { color: colors.primaryForeground }]}
        numberOfLines={1}
      >
        <Text style={styles.bold}>{imminent.title}</Text> starts in {minutes}m —{" "}
        {fmtTime(imminent.confirmedAt, tz)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  text: {
    fontSize: 13,
    flex: 1,
  },
  bold: {
    fontWeight: "700",
  },
});
