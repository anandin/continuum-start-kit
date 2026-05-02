import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";

import { MoodCard } from "@/components/MoodCard";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

interface MoodEntry {
  id: string;
  day: string;
  score: number;
  note: string | null;
  updatedAt: string;
}

interface MoodMeResponse {
  today: MoodEntry | null;
  entries: MoodEntry[];
}

const MOOD_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: "😔", label: "Rough" },
  2: { emoji: "🙁", label: "Low" },
  3: { emoji: "😐", label: "Okay" },
  4: { emoji: "🙂", label: "Good" },
  5: { emoji: "😄", label: "Great" },
};

interface MoodSummaryRowProps {
  engagementId?: string | null;
}

export function MoodSummaryRow({ engagementId }: MoodSummaryRowProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const moodQ = useQuery({
    queryKey: ["mood", "me"],
    queryFn: () => api<MoodMeResponse>("/api/mood/me?days=14"),
    staleTime: 60_000,
  });

  const today = moodQ.data?.today ?? null;
  const todayInfo = today ? MOOD_LABELS[today.score] : null;
  const entries = moodQ.data?.entries ?? [];

  const isOpen = expanded || (!moodQ.isLoading && !today);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityLabel={
          today ? "Change today's check-in" : "Check in for today"
        }
        accessibilityRole="button"
        testID="mood-summary-row"
        style={({ pressed }) => [
          styles.row,
          {
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.left}>
          <Text style={styles.emoji}>
            {todayInfo ? todayInfo.emoji : "·"}
          </Text>
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              TODAY
            </Text>
            <Text
              style={[styles.value, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {today
                ? today.note
                  ? `${todayInfo?.label ?? ""} — "${today.note}"`
                  : (todayInfo?.label ?? "Logged")
                : "Check in"}
            </Text>
          </View>
        </View>

        <Sparkline entries={entries} />

        <Feather
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>

      {isOpen ? (
        <View style={styles.expandedBlock}>
          <MoodCard engagementId={engagementId ?? null} />
        </View>
      ) : null}
    </View>
  );
}

interface SparklineProps {
  entries: MoodEntry[];
}

function Sparkline({ entries }: SparklineProps) {
  const colors = useColors();
  const width = 64;
  const height = 18;
  const padding = 2;
  const days = 14;

  const points = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const map = new Map(entries.map((e) => [e.day, e.score]));
    const result: Array<{ x: number; y: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const score = map.get(key);
      if (typeof score === "number") {
        const idx = days - 1 - i;
        const x = padding + (idx * (width - padding * 2)) / (days - 1);
        const y =
          height - padding - ((score - 1) * (height - padding * 2)) / 4;
        result.push({ x, y });
      }
    }
    return result;
  }, [entries]);

  if (points.length === 0) {
    return (
      <Text style={[styles.sparkEmpty, { color: colors.mutedForeground }]}>
        14d
      </Text>
    );
  }

  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      accessibilityLabel="Mood trend over the last 14 days"
    >
      {points.length > 1 ? (
        <Polyline
          points={polyPoints}
          fill="none"
          stroke={colors.primary}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      {points.map((p, idx) => (
        <Circle
          key={`${p.x}-${idx}`}
          cx={p.x}
          cy={p.y}
          r={1.5}
          fill={colors.primary}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  emoji: {
    fontSize: 22,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  sparkEmpty: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
  },
  expandedBlock: {
    marginTop: 2,
  },
});
