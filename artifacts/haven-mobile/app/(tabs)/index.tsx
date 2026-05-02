import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HavenLogo } from "@/components/HavenLogo";
import { MoodCard } from "@/components/MoodCard";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import {
  buildPendingMap,
  checkOffGoal,
  fetchGoalProgress,
  uncheckGoal,
  type GoalProgress,
} from "@/lib/seekerGoals";

interface Engagement {
  id: string;
  status?: string;
  providerId?: string;
  provider?: { email?: string };
  sessions?: SessionRow[];
}

interface SessionRow {
  id: string;
  status?: string;
  initialStage?: string;
  initial_stage?: string;
  startedAt?: string;
  started_at?: string;
}

interface Summary {
  key_insights?: Array<string | { insight: string }>;
  next_action?: string;
}

interface Goal {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
}

function getStarted(s: SessionRow): number {
  return new Date(s.startedAt ?? s.started_at ?? 0).getTime();
}

function getStage(s?: SessionRow): string | undefined {
  return s?.initialStage ?? s?.initial_stage;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const engagementsQ = useQuery({
    queryKey: ["engagements"],
    queryFn: () => api<Engagement[]>("/api/engagements"),
    enabled: !!user,
  });

  const activeEngagement = useMemo(
    () =>
      engagementsQ.data?.find((e) => (e.status ?? "active") === "active") ??
      engagementsQ.data?.[0],
    [engagementsQ.data],
  );

  const completedSessions = useMemo(
    () =>
      (engagementsQ.data ?? []).reduce(
        (acc, e) =>
          acc + (e.sessions?.filter((s) => s.status === "ended").length ?? 0),
        0,
      ),
    [engagementsQ.data],
  );

  const lastEnded = useMemo(() => {
    const ended = (activeEngagement?.sessions ?? []).filter(
      (s) => s.status === "ended",
    );
    return ended.sort((a, b) => getStarted(b) - getStarted(a))[0];
  }, [activeEngagement]);

  const summaryQ = useQuery({
    queryKey: ["session-summary", lastEnded?.id],
    queryFn: () => api<Summary | null>(`/api/sessions/${lastEnded!.id}/summary`),
    enabled: !!lastEnded?.id,
  });

  const goalsQ = useQuery({
    queryKey: ["goals", activeEngagement?.id],
    queryFn: () =>
      api<Goal[]>(`/api/engagements/${activeEngagement!.id}/goals`),
    enabled: !!activeEngagement?.id,
  });

  const qc = useQueryClient();
  const progressQ = useQuery({
    queryKey: ["goal-progress", activeEngagement?.id],
    queryFn: () => fetchGoalProgress(activeEngagement!.id),
    enabled: !!activeEngagement?.id,
  });

  const seekerDone = useMemo(
    () => buildPendingMap(progressQ.data ?? [], user?.id),
    [progressQ.data, user?.id],
  );

  const checkMutation = useMutation({
    mutationFn: (goalId: string) => checkOffGoal(goalId),
    onMutate: async (goalId) => {
      const key = ["goal-progress", activeEngagement?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<GoalProgress[]>(key) ?? [];
      const optimistic: GoalProgress = {
        id: `optimistic-${goalId}`,
        goalId,
        engagementId: activeEngagement!.id,
        seekerUserId: user?.id ?? "",
        note: null,
        status: "pending",
      };
      qc.setQueryData<GoalProgress[]>(key, [optimistic, ...prev]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(["goal-progress", activeEngagement?.id], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: ["goal-progress", activeEngagement?.id],
      });
    },
  });

  const uncheckMutation = useMutation({
    mutationFn: (goalId: string) => uncheckGoal(goalId),
    onMutate: async (goalId) => {
      const key = ["goal-progress", activeEngagement?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<GoalProgress[]>(key) ?? [];
      qc.setQueryData<GoalProgress[]>(
        key,
        prev.filter(
          (r) =>
            !(
              r.goalId === goalId &&
              r.status === "pending" &&
              (!user?.id || r.seekerUserId === user.id)
            ),
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(["goal-progress", activeEngagement?.id], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: ["goal-progress", activeEngagement?.id],
      });
    },
  });

  const toggleGoal = useCallback(
    (goalId: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      if (seekerDone[goalId]) {
        uncheckMutation.mutate(goalId);
      } else {
        checkMutation.mutate(goalId);
      }
    },
    [seekerDone, checkMutation, uncheckMutation],
  );

  const activeGoals = useMemo(
    () => (goalsQ.data ?? []).filter((g) => g.status !== "completed"),
    [goalsQ.data],
  );

  const lastSessionLabel = useMemo(() => {
    const sessions = activeEngagement?.sessions ?? [];
    const latest = sessions
      .slice()
      .sort((a, b) => getStarted(b) - getStarted(a))[0];
    if (!latest) return "No sessions yet";
    const d = new Date(getStarted(latest));
    if (Number.isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }, [activeEngagement]);

  const currentStage = useMemo(() => {
    const sessions = activeEngagement?.sessions ?? [];
    const latest = sessions
      .slice()
      .sort((a, b) => getStarted(b) - getStarted(a))[0];
    return getStage(latest) ?? "Not started";
  }, [activeEngagement]);

  return (
    <LinearGradient
      colors={[colors.gradientHeroStart, colors.gradientHeroMid, colors.gradientHeroEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 140,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <HavenLogo size={26} />
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityLabel="Profile"
            style={[
              styles.avatarBtn,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Feather name="user" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.subGreeting, { color: colors.mutedForeground }]}>
            {activeEngagement
              ? "Continue your journey of growth and self-discovery"
              : "Your safe space — let's get you set up"}
          </Text>
        </View>

        {engagementsQ.isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard
            icon="calendar"
            label="Sessions"
            value={String(completedSessions)}
            colors={colors}
          />
          <StatCard
            icon="target"
            label="Stage"
            value={currentStage}
            colors={colors}
            tone="accent"
          />
          <StatCard
            icon="message-circle"
            label="Last"
            value={lastSessionLabel}
            colors={colors}
          />
        </View>

        <MoodCard engagementId={activeEngagement?.id ?? null} />

        {activeEngagement ? (
          <View
            style={[
              styles.journeyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                shadowColor: "#7A5A3C",
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Feather name="heart" size={16} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  Your Active Journey
                </Text>
              </View>
            </View>

            <View style={styles.journeyMain}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.coachLabel, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {activeEngagement.provider?.email ?? "Your coach"}
                </Text>
                <Text
                  style={[styles.coachStage, { color: colors.mutedForeground }]}
                >
                  Stage: {currentStage}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push("/(tabs)/chat")}
                accessibilityLabel="Continue session"
                testID="home-continue-chat"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.primaryBtnLabel,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Continue
                </Text>
                <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
              </Pressable>
            </View>

            {summaryQ.data?.key_insights?.length ? (
              <View
                style={[
                  styles.insightsBlock,
                  { borderTopColor: colors.border },
                ]}
              >
                <View style={styles.insightsHeader}>
                  <Feather name="zap" size={14} color={colors.accent} />
                  <Text
                    style={[
                      styles.insightsTitle,
                      { color: colors.foreground },
                    ]}
                  >
                    Recent Insights
                  </Text>
                </View>
                {summaryQ.data.key_insights.slice(0, 2).map((item, idx) => {
                  const text =
                    typeof item === "string" ? item : item.insight;
                  return (
                    <View key={idx} style={styles.insightRow}>
                      <View
                        style={[
                          styles.insightDot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                      <Text
                        style={[
                          styles.insightText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {text}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {activeGoals.length > 0 ? (
              <View
                style={[
                  styles.goalsBlock,
                  { borderTopColor: colors.border },
                ]}
              >
                <View style={styles.insightsHeader}>
                  <Feather name="check-square" size={14} color={colors.primary} />
                  <Text
                    style={[styles.insightsTitle, { color: colors.foreground }]}
                  >
                    Today's Goals
                  </Text>
                  <Text
                    style={[
                      styles.goalsCount,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {activeGoals.filter((g) => seekerDone[g.id]).length}/
                    {activeGoals.length}
                  </Text>
                </View>
                {activeGoals.slice(0, 3).map((g) => {
                  const checked = !!seekerDone[g.id];
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => toggleGoal(g.id)}
                      accessibilityLabel={`${
                        checked ? "Uncheck" : "Check off"
                      } goal: ${g.title}`}
                      testID={`home-goal-${g.id}`}
                      style={({ pressed }) => [
                        styles.goalRow,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <View
                        style={[
                          styles.goalCheckbox,
                          {
                            backgroundColor: checked
                              ? colors.primary
                              : "transparent",
                            borderColor: checked
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        {checked ? (
                          <Feather
                            name="check"
                            size={12}
                            color={colors.primaryForeground}
                          />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.goalText,
                          {
                            color: colors.foreground,
                            textDecorationLine: checked
                              ? "line-through"
                              : "none",
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {g.title}
                      </Text>
                    </Pressable>
                  );
                })}
                {activeGoals.length > 3 ? (
                  <Pressable
                    onPress={() => router.push("/(tabs)/goals")}
                    accessibilityLabel="See all goals"
                  >
                    <Text
                      style={[
                        styles.seeAll,
                        { color: colors.primary },
                      ]}
                    >
                      See all {activeGoals.length} goals →
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {summaryQ.data?.next_action ? (
              <View
                style={[
                  styles.nextStep,
                  {
                    backgroundColor: colors.gradientHeroMid,
                    borderColor: colors.border,
                    borderRadius: 12,
                  },
                ]}
              >
                <View style={styles.insightsHeader}>
                  <Feather name="target" size={14} color={colors.primary} />
                  <Text
                    style={[
                      styles.insightsTitle,
                      { color: colors.foreground },
                    ]}
                  >
                    Recommended Next Step
                  </Text>
                </View>
                <Text
                  style={[styles.insightText, { color: colors.mutedForeground }]}
                >
                  {summaryQ.data.next_action}
                </Text>
              </View>
            ) : null}
          </View>
        ) : engagementsQ.isLoading ? null : (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: colors.gradientHeroMid },
              ]}
            >
              <Feather name="sun" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Begin Your First Journey
            </Text>
            <Text
              style={[styles.emptyBody, { color: colors.mutedForeground }]}
            >
              Connect with a coach in the web app, then continue right here on
              your phone.
            </Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

interface StatCardProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  tone?: "primary" | "accent";
}

function StatCard({ icon, label, value, colors, tone = "primary" }: StatCardProps) {
  const iconBg =
    tone === "accent" ? colors.gradientHeroMid : colors.gradientHeroMid;
  const iconColor = tone === "accent" ? colors.accent : colors.primary;

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text
        style={[styles.statValue, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  greetingBlock: {
    gap: 4,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  subGreeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  loadingBlock: {
    paddingVertical: 24,
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  journeyCard: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  journeyMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coachLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  coachStage: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryBtnLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  insightsBlock: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 8,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  insightsTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  nextStep: {
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  goalsBlock: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 10,
  },
  goalsCount: {
    marginLeft: "auto",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  goalCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  goalText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  seeAll: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  emptyCard: {
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  emptyBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
});
