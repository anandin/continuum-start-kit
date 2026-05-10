import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Polyline } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import {
  fetchSeekerProgress,
  type MoodPoint,
  type SeekerProgressSnapshot,
  type StreakStatus,
} from "@/lib/seekerProgress";

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const progressQ = useQuery({
    queryKey: ["seeker-progress"],
    queryFn: fetchSeekerProgress,
  });

  const snapshot = progressQ.data;

  return (
    <LinearGradient
      colors={[
        colors.gradientHeroStart,
        colors.gradientHeroMid,
        colors.gradientHeroEnd,
      ]}
      style={{ flex: 1 }}
    >
      <View
        style={[
          styles.headerBar,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          testID="progress-back"
          style={({ pressed }) => [
            styles.backBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          hitSlop={12}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          My progress
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your gentle snapshot — small, steady moves count.
        </Text>

        {progressQ.isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {progressQ.error ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {(progressQ.error as Error & { status?: number }).status === 401
                ? "Please sign in to see your progress."
                : "Couldn't load your progress. Pull down or come back in a moment."}
            </Text>
            {(progressQ.error as Error & { status?: number }).status === 401 ? (
              <Pressable
                onPress={() => router.replace("/auth")}
                style={({ pressed }) => [
                  styles.errorCta,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                testID="progress-signin"
              >
                <Text
                  style={[
                    styles.errorCtaLabel,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Sign in
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void progressQ.refetch()}
                style={({ pressed }) => [
                  styles.errorCta,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                testID="progress-retry"
              >
                <Text
                  style={[
                    styles.errorCtaLabel,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Try again
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {snapshot ? (
          <>
            <View style={styles.tilesGrid}>
              <ProgressTile
                icon="calendar"
                label="Sessions"
                value={String(snapshot.sessionsCompleted)}
                emptyHint="Start your first session in Chat"
                isEmpty={snapshot.sessionsCompleted === 0}
                colors={colors}
                onPress={() => router.push("/(tabs)/chat")}
                testID="progress-tile-sessions"
              />
              <StreakTile
                streak={snapshot.streak}
                colors={colors}
                onPress={() => router.push("/(tabs)/journal")}
              />
              <ProgressTile
                icon="check-square"
                label="Goal check-ins this week"
                value={String(snapshot.goalsThisWeek)}
                emptyHint="Add a goal with your coach"
                isEmpty={snapshot.goalsThisWeek === 0}
                colors={colors}
                onPress={() => router.push("/(tabs)/goals")}
                testID="progress-tile-goals"
              />
              <ProgressTile
                icon="activity"
                label="Mood logged"
                value={String(snapshot.moodSeries.length)}
                emptyHint="Log a mood on the Home screen"
                isEmpty={snapshot.moodSeries.length === 0}
                colors={colors}
                onPress={() => router.push("/(tabs)")}
                testID="progress-tile-mood"
              />
            </View>

            <View
              style={[
                styles.trendCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View style={styles.trendHeader}>
                <View style={styles.trendHeaderLeft}>
                  <Feather
                    name="trending-up"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.trendTitle, { color: colors.foreground }]}
                  >
                    Mood — last 30 days
                  </Text>
                </View>
                <Text
                  style={[styles.trendCount, { color: colors.mutedForeground }]}
                >
                  {snapshot.moodSeries.length} check-in
                  {snapshot.moodSeries.length === 1 ? "" : "s"}
                </Text>
              </View>
              <MoodTrend entries={snapshot.moodSeries} />
            </View>

            {!snapshot.hasSeekerProfile ? (
              <View
                style={[
                  styles.noProfileCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather name="user-plus" size={20} color={colors.primary} />
                <Text
                  style={[styles.noProfileTitle, { color: colors.foreground }]}
                >
                  Finish setting up your seeker profile
                </Text>
                <Text
                  style={[
                    styles.noProfileBody,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Connect with a coach in the web app to start tracking your
                  journey here.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}

interface TileProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  emptyHint: string;
  isEmpty: boolean;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
  testID?: string;
}

function ProgressTile({
  icon,
  label,
  value,
  emptyHint,
  isEmpty,
  colors,
  onPress,
  testID,
}: TileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${label}: ${isEmpty ? emptyHint : value}`}
      testID={testID}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.tileHeader}>
        <View
          style={[styles.tileIcon, { backgroundColor: colors.gradientHeroMid }]}
        >
          <Feather name={icon} size={14} color={colors.primary} />
        </View>
        <Feather
          name="chevron-right"
          size={16}
          color={colors.mutedForeground}
        />
      </View>
      <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      {isEmpty ? (
        <Text
          style={[styles.tileEmpty, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {emptyHint}
        </Text>
      ) : (
        <Text style={[styles.tileValue, { color: colors.foreground }]}>
          {value}
        </Text>
      )}
    </Pressable>
  );
}

interface StreakTileProps {
  streak: SeekerProgressSnapshot["streak"];
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}

function StreakTile({ streak, colors, onPress }: StreakTileProps) {
  const isEmpty = streak.status === "none";
  const valueText = isEmpty
    ? "0 days"
    : `${streak.current} day${streak.current === 1 ? "" : "s"}`;
  const pillLabel = pillLabelFor(streak.status);
  const pillColor = pillColorFor(streak.status, colors);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Check-in streak: ${
        isEmpty ? "log a mood or journal entry to start" : valueText
      }`}
      testID="progress-tile-streak"
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.tileHeader}>
        <View
          style={[styles.tileIcon, { backgroundColor: colors.gradientHeroMid }]}
        >
          <Feather name="zap" size={14} color={colors.primary} />
        </View>
        <Feather
          name="chevron-right"
          size={16}
          color={colors.mutedForeground}
        />
      </View>
      <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>
        Check-in streak
      </Text>
      {isEmpty ? (
        <Text
          style={[styles.tileEmpty, { color: colors.foreground }]}
          numberOfLines={2}
        >
          Log a mood or journal entry to start
        </Text>
      ) : (
        <View style={styles.streakRow}>
          <Text style={[styles.tileValue, { color: colors.foreground }]}>
            {valueText}
          </Text>
          {pillLabel ? (
            <View
              style={[
                styles.pill,
                {
                  backgroundColor: pillColor.bg,
                  borderColor: pillColor.border,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: pillColor.fg }]}>
                {pillLabel}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function pillLabelFor(status: StreakStatus): string | null {
  if (status === "active") return "On track";
  if (status === "keep-going") return "Keep going";
  return null;
}

function pillColorFor(
  status: StreakStatus,
  colors: ReturnType<typeof useColors>,
): { bg: string; fg: string; border: string } {
  if (status === "keep-going") {
    return {
      bg: colors.gradientHeroMid,
      fg: colors.accent,
      border: colors.border,
    };
  }
  return {
    bg: colors.gradientHeroMid,
    fg: colors.primary,
    border: colors.border,
  };
}

interface TrendProps {
  entries: MoodPoint[];
}

function MoodTrend({ entries }: TrendProps) {
  const colors = useColors();
  const width = 320;
  const height = 110;
  const padding = 10;
  const days = 30;

  const series = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const slots: Array<{ day: string; score: number | null }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      slots.push({ day: d.toISOString().slice(0, 10), score: null });
    }
    const map = new Map(entries.map((e) => [e.day, e.score]));
    for (const slot of slots) {
      const v = map.get(slot.day);
      if (typeof v === "number") slot.score = v;
    }
    return slots;
  }, [entries]);

  const points = series
    .map((s, idx) => {
      if (s.score == null) return null;
      const x = padding + (idx * (width - padding * 2)) / (days - 1);
      const y = height - padding - ((s.score - 1) * (height - padding * 2)) / 4;
      return { x, y, score: s.score };
    })
    .filter((p): p is { x: number; y: number; score: number } => p != null);

  if (points.length === 0) {
    return (
      <View style={styles.trendEmpty}>
        <Text
          style={[styles.trendEmptyText, { color: colors.mutedForeground }]}
        >
          Tap "Log mood" on the Home screen each day. Your trend will fill in
          over the next month.
        </Text>
      </View>
    );
  }

  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        accessibilityLabel="Mood trend over the last 30 days"
      >
        {points.length > 1 ? (
          <Polyline
            points={polyPoints}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((p, idx) => (
          <Circle
            key={`${p.x}-${idx}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={colors.primary}
          />
        ))}
      </Svg>
      <View style={styles.trendAxisRow}>
        <Text
          style={[styles.trendAxisLabel, { color: colors.mutedForeground }]}
        >
          30 days ago
        </Text>
        <Text
          style={[styles.trendAxisLabel, { color: colors.mutedForeground }]}
        >
          Today
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 18,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  loadingBlock: {
    paddingVertical: 32,
    alignItems: "center",
  },
  errorCard: {
    borderWidth: 1,
    padding: 16,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  errorCta: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  errorCtaLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tile: {
    width: "48%",
    flexGrow: 1,
    minWidth: "47%",
    borderWidth: 1,
    padding: 14,
    gap: 8,
    minHeight: 120,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tileValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  tileEmpty: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  trendCard: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  trendHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trendHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  trendCount: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  trendEmpty: {
    paddingVertical: 18,
  },
  trendEmptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  trendAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  trendAxisLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  noProfileCard: {
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  noProfileTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  noProfileBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 17,
  },
});
