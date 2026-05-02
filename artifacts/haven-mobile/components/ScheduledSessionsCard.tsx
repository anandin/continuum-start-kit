import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

interface ScheduledSession {
  id: string;
  engagementId: string;
  status: "proposed" | "confirmed" | "cancelled" | string;
  proposedSlots: string[];
  confirmedAt: string | null;
  timezone: string;
  durationMinutes: number;
  title: string;
}

function detectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function fmtSlot(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function fmtTimeOnly(iso: string, tz: string): string {
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

// Mobile equivalent of the web SchedulePanel (seeker-side only):
// confirms a coach proposal, shows the confirmed time, and surfaces an
// imminent banner inside the card when a session is within 1 hour.
// Polling the GET endpoint also lazy-fires the server-side push.
export function ScheduledSessionsCard() {
  const colors = useColors();
  const qc = useQueryClient();
  const tz = detectedTimezone();

  // Fire-and-forget timezone sync on mount; the server keeps the latest
  // value on the user record so .ics emails render in their local zone.
  useEffect(() => {
    api("/api/user/timezone", {
      method: "PATCH",
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {});
  }, [tz]);

  // Tick every 30s so countdown text re-renders even when the upcoming
  // list itself hasn't changed.
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
    refetchInterval: 60_000,
  });

  const confirmMut = useMutation({
    mutationFn: ({ id, slot }: { id: string; slot: string }) =>
      api<{ scheduledSession: ScheduledSession }>(
        `/api/scheduled-sessions/${id}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ slot, timezone: tz }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-sessions", "me"] });
    },
    onError: (e: Error) => {
      Alert.alert("Could not confirm", e.message);
    },
  });

  const rows = sessionsQ.data?.scheduledSessions ?? [];
  const proposed = useMemo(
    () => rows.find((r) => r.status === "proposed"),
    [rows],
  );
  const confirmed = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.status === "confirmed" &&
            r.confirmedAt &&
            new Date(r.confirmedAt).getTime() > Date.now(),
        )
        .sort(
          (a, b) =>
            new Date(a.confirmedAt!).getTime() -
            new Date(b.confirmedAt!).getTime(),
        )[0],
    [rows],
  );

  const handlePick = (id: string, slot: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    confirmMut.mutate({ id, slot });
  };

  if (sessionsQ.isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!proposed && !confirmed) return null;

  // Confirmed-and-imminent (≤ 60 min) takes precedence over a separate
  // proposed row because the user's "next thing" is the confirmed one.
  if (confirmed) {
    const ts = new Date(confirmed.confirmedAt!).getTime();
    const minutes = Math.round((ts - Date.now()) / 60_000);
    const imminent = minutes <= 60;
    return (
      <View
        testID="scheduled-confirmed-card"
        style={[
          styles.card,
          {
            backgroundColor: imminent ? colors.primary : colors.card,
            borderColor: imminent ? colors.primary : colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Feather
            name="calendar"
            size={14}
            color={imminent ? colors.primaryForeground : colors.primary}
          />
          <Text
            style={[
              styles.eyebrow,
              { color: imminent ? colors.primaryForeground : colors.primary },
            ]}
          >
            {imminent ? "STARTING SOON" : "NEXT SESSION"}
          </Text>
        </View>
        <Text
          style={[
            styles.title,
            { color: imminent ? colors.primaryForeground : colors.foreground },
          ]}
          numberOfLines={2}
        >
          {confirmed.title}
        </Text>
        <Text
          style={[
            styles.timeLine,
            {
              color: imminent
                ? colors.primaryForeground
                : colors.mutedForeground,
            },
          ]}
        >
          {fmtSlot(confirmed.confirmedAt!, tz)}
        </Text>
        {imminent ? (
          <Text
            style={[styles.countdown, { color: colors.primaryForeground }]}
          >
            Starts in {Math.max(1, minutes)} min ·{" "}
            {fmtTimeOnly(confirmed.confirmedAt!, tz)}
          </Text>
        ) : (
          <Text
            style={[styles.metaLine, { color: colors.mutedForeground }]}
          >
            {confirmed.durationMinutes} min
          </Text>
        )}
      </View>
    );
  }

  // Proposed-only branch — user picks one of the slots.
  if (proposed) {
    return (
      <View
        testID="scheduled-proposed-card"
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Feather name="calendar" size={14} color={colors.primary} />
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            PICK A TIME
          </Text>
        </View>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {proposed.title}
        </Text>
        <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
          Your coach proposed {proposed.proposedSlots.length} time
          {proposed.proposedSlots.length === 1 ? "" : "s"} ·{" "}
          {proposed.durationMinutes} min
        </Text>
        <View style={styles.slotsCol}>
          {proposed.proposedSlots.map((slot) => (
            <Pressable
              key={slot}
              testID={`slot-${slot}`}
              onPress={() => handlePick(proposed.id, slot)}
              disabled={confirmMut.isPending}
              style={({ pressed }) => [
                styles.slotBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.muted,
                  opacity: pressed || confirmMut.isPending ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.slotText, { color: colors.foreground }]}>
                {fmtSlot(slot, tz)}
              </Text>
              <Feather name="chevron-right" size={14} color={colors.primary} />
            </Pressable>
          ))}
        </View>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Tap a time to confirm. We&apos;ll email both of you a calendar invite.
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  timeLine: {
    fontSize: 14,
    marginTop: 2,
  },
  countdown: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  metaLine: {
    fontSize: 12,
  },
  slotsCol: {
    marginTop: 10,
    gap: 8,
  },
  slotBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  slotText: {
    fontSize: 14,
    fontWeight: "500",
  },
  helper: {
    fontSize: 11,
    marginTop: 8,
  },
});
