import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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

interface InlineStatusStripProps {
  engagementId?: string | null;
  sessionsCompleted: number;
  stage: string;
}

const SPARKLINE_DAYS = 14;

export function InlineStatusStrip({
  engagementId,
  sessionsCompleted,
  stage,
}: InlineStatusStripProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const moodQ = useQuery({
    queryKey: ["mood", "me"],
    queryFn: () => api<MoodMeResponse>("/api/mood/me?days=14"),
    staleTime: 60_000,
  });

  const today = moodQ.data?.today ?? null;
  const entries = moodQ.data?.entries ?? [];

  // Build an aligned 14-day array of scores (or null for missing days),
  // oldest → newest, so the rightmost bar is "today".
  const bars = useMemo(() => {
    const map = new Map(entries.map((e) => [e.day, e.score]));
    const result: Array<number | null> = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = SPARKLINE_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const score = map.get(key);
      result.push(typeof score === "number" ? score : null);
    }
    return result;
  }, [entries]);

  const isOpen = expanded || (!moodQ.isLoading && !today);

  const todayScore = today?.score ?? null;
  const todayNote = today?.note ?? null;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={
          today ? "Change today's check-in" : "Check in for today"
        }
        testID="home-status-strip"
        style={({ pressed }) => [
          styles.row,
          { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        {/* Today + score + sparkline */}
        <View style={styles.left}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            TODAY
          </Text>
          <Text style={[styles.score, { color: colors.foreground }]}>
            {todayScore != null ? todayScore : "—"}
            <Text
              style={[styles.scoreDenom, { color: colors.mutedForeground }]}
            >
              /5
            </Text>
          </Text>
          <Sparkline bars={bars} colors={colors} />
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Sessions / Stage */}
        <View style={styles.right}>
          <Text style={[styles.factGroup, { color: colors.mutedForeground }]}>
            <Text style={styles.label}>SESSIONS </Text>
            <Text style={[styles.factValue, { color: colors.foreground }]}>
              {sessionsCompleted}
            </Text>
            <Text style={[styles.dot, { color: colors.border }]}>
              {"  ·  "}
            </Text>
            <Text style={styles.label}>STAGE </Text>
            <Text style={[styles.factValue, { color: colors.foreground }]}>
              {stage}
            </Text>
          </Text>
        </View>

        <Feather
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.mutedForeground}
        />
      </Pressable>

      {todayNote ? (
        <Text
          style={[styles.noteLine, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {todayNote}
        </Text>
      ) : null}

      {isOpen ? (
        <View style={styles.expandedBlock}>
          <MoodCard engagementId={engagementId ?? null} />
        </View>
      ) : null}
    </View>
  );
}

interface SparklineProps {
  bars: Array<number | null>;
  colors: ReturnType<typeof useColors>;
}

function Sparkline({ bars, colors }: SparklineProps) {
  const lastIdx = bars.length - 1;
  return (
    <View style={styles.sparkline} accessibilityLabel="Mood — last 14 days">
      {bars.map((score, i) => {
        const filled = score != null;
        const heightPx = filled ? Math.max(2, (score / 5) * 18) : 2;
        const isToday = i === lastIdx;
        return (
          <View
            key={i}
            style={{
              width: 2,
              height: heightPx,
              borderTopLeftRadius: 1,
              borderTopRightRadius: 1,
              backgroundColor:
                isToday && filled
                  ? colors.primary
                  : filled
                    ? colors.border
                    : colors.muted,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  divider: {
    width: 1,
    height: 22,
  },
  right: {
    flexShrink: 1,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.1,
  },
  score: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  scoreDenom: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  sparkline: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 18,
    marginLeft: 2,
  },
  factGroup: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  factValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  dot: {
    fontFamily: "Inter_500Medium",
  },
  noteLine: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
  },
  expandedBlock: {
    marginTop: 4,
  },
});
