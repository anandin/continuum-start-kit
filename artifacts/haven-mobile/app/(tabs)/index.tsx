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
import { MoodSummaryRow } from "@/components/MoodSummaryRow";
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

interface Nudge {
  id: string;
  body: string;
  source?: string;
  status?: string;
  createdAt?: string;
}

type NudgeAction = "done" | "skip" | "snooze";

function getStarted(s: SessionRow): number {
  return new Date(s.startedAt ?? s.started_at ?? 0).getTime();
}

function getStage(s?: SessionRow): string | undefined {
  return s?.initialStage ?? s?.initial_stage;
}

function getPartOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getWeekdayLong(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

function nameFromEmail(email?: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0]?.split(/[._+-]/)[0];
  if (!local) return null;
  return local.charAt(0).toUpperCase() + local.slice(1);
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

  const nudgeQ = useQuery({
    queryKey: ["nudge", "today"],
    queryFn: () => api<{ nudge: Nudge | null }>("/api/nudges/today"),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const nudgeMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: NudgeAction }) =>
      api<{ nudge: Nudge }>(`/api/nudges/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: (data) => {
      qc.setQueryData<{ nudge: Nudge | null }>(["nudge", "today"], {
        nudge: data.nudge,
      });
    },
  });

  const handleNudge = useCallback(
    (id: string, action: NudgeAction) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      nudgeMutation.mutate({ id, action });
    },
    [nudgeMutation],
  );

  const todaysNudge = nudgeQ.data?.nudge ?? null;
  const nudgePending =
    todaysNudge &&
    (todaysNudge.status === "pending" || todaysNudge.status === "sent");
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

  const lastSessionDate = useMemo(() => {
    const sessions = activeEngagement?.sessions ?? [];
    const latest = sessions
      .slice()
      .sort((a, b) => getStarted(b) - getStarted(a))[0];
    if (!latest) return null;
    const d = new Date(getStarted(latest));
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }, [activeEngagement]);

  const lastSessionLabel = useMemo(() => {
    if (!lastSessionDate) return "No sessions yet";
    return lastSessionDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }, [lastSessionDate]);

  const lastSessionWeekday = useMemo(
    () => (lastSessionDate ? getWeekdayLong(lastSessionDate) : null),
    [lastSessionDate],
  );

  const currentStage = useMemo(() => {
    const sessions = activeEngagement?.sessions ?? [];
    const latest = sessions
      .slice()
      .sort((a, b) => getStarted(b) - getStarted(a))[0];
    return getStage(latest) ?? "Not started";
  }, [activeEngagement]);

  const coachName = useMemo(
    () => nameFromEmail(activeEngagement?.provider?.email) ?? "your coach",
    [activeEngagement],
  );

  const seekerName = useMemo(
    () => nameFromEmail(user?.email) ?? "there",
    [user],
  );

  const greetingLine = useMemo(() => {
    const today = new Date();
    return `${getWeekdayLong(today)} ${getPartOfDay()} · ${seekerName}`;
  }, [seekerName]);

  const insightsList = useMemo(() => {
    const items = summaryQ.data?.key_insights ?? [];
    return items
      .slice(0, 2)
      .map((it) => (typeof it === "string" ? it : it.insight))
      .filter((s): s is string => !!s);
  }, [summaryQ.data]);

  const coachSubline = useMemo(() => {
    if (!summaryQ.data) return null;
    const n = insightsList.length;
    if (!n) return null;
    return `Your last session was ${lastSessionLabel} — ${n} thing${n === 1 ? "" : "s"} to try`;
  }, [summaryQ.data, insightsList.length, lastSessionLabel]);

  const completedGoalCount = activeGoals.filter((g) => seekerDone[g.id]).length;

  return (
    <LinearGradient
      colors={[colors.gradientHeroStart, colors.gradientHeroMid, colors.gradientHeroEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 12,
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

        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
          {greetingLine}
        </Text>

        {engagementsQ.isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : activeEngagement ? (
          <View
            style={[
              styles.dominantCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View
              style={[styles.leftRule, { backgroundColor: colors.primary }]}
            />

            <Text
              style={[styles.eyebrow, { color: colors.primary }]}
              accessibilityRole="text"
            >
              THIS WEEK WITH
            </Text>
            <Text
              style={[styles.coachName, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {coachName}
            </Text>
            <Text
              style={[styles.metaLine, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              Stage {currentStage}
            </Text>
            {lastSessionDate ? (
              <Text
                style={[styles.metaLineDim, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                Last met {lastSessionLabel}
              </Text>
            ) : null}
            {coachSubline ? (
              <Text
                style={[styles.metaLine, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                {coachSubline}
              </Text>
            ) : null}

            <Pressable
              onPress={() => router.push("/(tabs)/chat")}
              accessibilityLabel="Continue session"
              testID="home-continue-chat"
              style={({ pressed }) => [
                styles.continueBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.continueLabel,
                  { color: colors.primaryForeground },
                ]}
              >
                Continue session
              </Text>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.primaryForeground}
              />
            </Pressable>

            {insightsList.length ? (
              <View
                style={[
                  styles.sectionBlock,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.sectionEyebrow, { color: colors.mutedForeground }]}
                >
                  {`FROM ${(lastSessionWeekday ?? "your last session").toUpperCase()}`}
                </Text>
                {insightsList.map((text, idx) => (
                  <View key={idx} style={styles.numberedRow}>
                    <Text
                      style={[styles.numberMark, { color: colors.primary }]}
                    >
                      {idx + 1}
                    </Text>
                    <Text
                      style={[styles.numberedText, { color: colors.foreground }]}
                    >
                      {text}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {activeGoals.length > 0 ? (
              <View
                style={[
                  styles.sectionBlock,
                  { borderTopColor: colors.border },
                ]}
              >
                <View style={styles.commitmentsHeader}>
                  <Text
                    style={[styles.sectionEyebrow, { color: colors.mutedForeground }]}
                  >
                    COMMITMENTS
                  </Text>
                  <Text
                    style={[styles.commitmentsCount, { color: colors.primary }]}
                  >
                    {completedGoalCount} / {activeGoals.length}
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
                      } commitment: ${g.title}`}
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
                            size={11}
                            color={colors.primaryForeground}
                          />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.goalText,
                          {
                            color: checked
                              ? colors.mutedForeground
                              : colors.foreground,
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
                    accessibilityLabel="See all commitments"
                  >
                    <Text style={[styles.seeAll, { color: colors.primary }]}>
                      See all {activeGoals.length} commitments →
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {todaysNudge ? (
              <View
                style={[
                  styles.sectionBlock,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.sectionEyebrow, { color: colors.primary }]}
                >
                  TODAY&apos;S NUDGE
                </Text>
                <Text
                  style={[styles.tryThisText, { color: colors.foreground }]}
                >
                  &ldquo;{todaysNudge.body}&rdquo;
                </Text>
                {nudgePending ? (
                  <View style={styles.nudgeActionsRow}>
                    <Pressable
                      onPress={() => handleNudge(todaysNudge.id, "done")}
                      accessibilityLabel="I did this"
                      testID={`nudge-done-${todaysNudge.id}`}
                      disabled={nudgeMutation.isPending}
                      style={({ pressed }) => [
                        styles.nudgePrimaryBtn,
                        {
                          backgroundColor: colors.primary,
                          opacity: pressed || nudgeMutation.isPending ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name="check"
                        size={13}
                        color={colors.primaryForeground}
                      />
                      <Text
                        style={[
                          styles.nudgePrimaryLabel,
                          { color: colors.primaryForeground },
                        ]}
                      >
                        I did this
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleNudge(todaysNudge.id, "snooze")}
                      accessibilityLabel="Snooze a day"
                      testID={`nudge-snooze-${todaysNudge.id}`}
                      disabled={nudgeMutation.isPending}
                      style={({ pressed }) => [
                        styles.nudgeGhostBtn,
                        {
                          borderColor: colors.border,
                          opacity: pressed || nudgeMutation.isPending ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.nudgeGhostLabel,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Snooze
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleNudge(todaysNudge.id, "skip")}
                      accessibilityLabel="Skip"
                      testID={`nudge-skip-${todaysNudge.id}`}
                      disabled={nudgeMutation.isPending}
                      style={({ pressed }) => [
                        styles.nudgeGhostBtn,
                        {
                          borderColor: colors.border,
                          opacity: pressed || nudgeMutation.isPending ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.nudgeGhostLabel,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Skip
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text
                    style={[styles.nudgeStatusLine, { color: colors.mutedForeground }]}
                  >
                    {todaysNudge.status === "done"
                      ? "Marked done — see you tomorrow."
                      : todaysNudge.status === "snoozed"
                        ? "Snoozed — back tomorrow."
                        : "Skipped — back tomorrow."}
                  </Text>
                )}
              </View>
            ) : summaryQ.data?.next_action ? (
              <View
                style={[
                  styles.sectionBlock,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.sectionEyebrow, { color: colors.primary }]}
                >
                  TRY THIS
                </Text>
                <Text
                  style={[styles.tryThisText, { color: colors.foreground }]}
                >
                  &ldquo;{summaryQ.data.next_action}&rdquo;
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
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
              style={[styles.leftRule, { backgroundColor: colors.primary }]}
            />
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              GET STARTED
            </Text>
            <Text style={[styles.coachName, { color: colors.foreground }]}>
              Connect with a coach to get started
            </Text>
            <Text
              style={[styles.metaLine, { color: colors.mutedForeground }]}
            >
              Once you&apos;re paired with a coach, your sessions, commitments,
              and reflections will live here.
            </Text>
            <Pressable
              onPress={() => router.push("/invite")}
              accessibilityLabel="Start your work with a coach"
              testID="home-start-coach"
              style={({ pressed }) => [
                styles.continueBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.continueLabel,
                  { color: colors.primaryForeground },
                ]}
              >
                Start your work with a coach
              </Text>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.primaryForeground}
              />
            </Pressable>
          </View>
        )}

        {/* Demoted status strip — facts + today's check-in folded inline */}
        {activeEngagement ? (
          <View style={styles.demotedStrip}>
            <View
              style={[styles.factsRow, { borderColor: colors.border }]}
            >
              <Text style={[styles.factText, { color: colors.mutedForeground }]}>
                <Text style={styles.factLabel}>SESSIONS </Text>
                <Text style={{ color: colors.foreground }}>
                  {completedSessions}
                </Text>
                <Text>   ·   </Text>
                <Text style={styles.factLabel}>STAGE </Text>
                <Text style={{ color: colors.foreground }}>{currentStage}</Text>
              </Text>
            </View>
            <MoodSummaryRow engagementId={activeEngagement?.id ?? null} />
          </View>
        ) : (
          <MoodSummaryRow engagementId={null} />
        )}

        <Pressable
          onPress={() => router.push("/progress")}
          accessibilityLabel="View full progress"
          testID="home-open-progress"
          style={({ pressed }) => [
            styles.progressLinkRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="trending-up" size={16} color={colors.primary} />
          <Text style={[styles.progressLinkText, { color: colors.foreground }]}>
            View full progress
          </Text>
          <Feather
            name="chevron-right"
            size={16}
            color={colors.mutedForeground}
            style={{ marginLeft: "auto" }}
          />
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  greeting: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    marginTop: -4,
  },
  loadingBlock: {
    paddingVertical: 24,
    alignItems: "center",
  },
  dominantCard: {
    position: "relative",
    borderWidth: 1,
    paddingTop: 18,
    paddingBottom: 18,
    paddingLeft: 20,
    paddingRight: 18,
    overflow: "hidden",
  },
  leftRule: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  coachName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    lineHeight: 30,
    marginBottom: 6,
  },
  metaLine: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
    marginTop: 2,
  },
  metaLineDim: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginTop: 2,
    opacity: 0.7,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    marginTop: 14,
  },
  continueLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  sectionBlock: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 16,
    gap: 8,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.1,
  },
  numberedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  numberMark: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    lineHeight: 18,
    width: 12,
  },
  numberedText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  commitmentsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  commitmentsCount: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  goalCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
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
  tryThisText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    lineHeight: 19,
  },
  emptyCard: {
    position: "relative",
    borderWidth: 1,
    paddingTop: 18,
    paddingBottom: 18,
    paddingLeft: 20,
    paddingRight: 18,
    overflow: "hidden",
  },
  demotedStrip: {
    gap: 0,
  },
  factsRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  factText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  factLabel: {
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  progressLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  progressLinkText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  nudgeActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  nudgePrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  nudgePrimaryLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  nudgeGhostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  nudgeGhostLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  nudgeStatusLine: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontStyle: "italic",
    marginTop: 10,
  },
});
