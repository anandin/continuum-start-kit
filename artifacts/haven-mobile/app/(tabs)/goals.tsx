import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
}

interface Goal {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  dueDate?: string | null;
  due_date?: string | null;
}

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();

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

  const goalsQ = useQuery({
    queryKey: ["goals", activeEngagement?.id],
    queryFn: () =>
      api<Goal[]>(`/api/engagements/${activeEngagement!.id}/goals`),
    enabled: !!activeEngagement?.id,
  });

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

  const goals = goalsQ.data ?? [];
  const activeGoals = goals.filter((g) => g.status !== "completed");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const seekerCheckedCount = activeGoals.filter((g) => seekerDone[g.id]).length;

  if (engagementsQ.isLoading || (activeEngagement && goalsQ.isLoading)) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!activeEngagement) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 24,
            paddingHorizontal: 24,
          },
        ]}
      >
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: colors.gradientHeroMid },
          ]}
        >
          <Feather name="target" size={22} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 12 }]}>
          No goals yet
        </Text>
        <Text
          style={[
            styles.emptyBody,
            { color: colors.mutedForeground, marginTop: 6 },
          ]}
        >
          Once you connect with a coach, your goals will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 16, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Goals</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {activeGoals.length === 0
            ? "No active goals — your coach will add some after your next session."
            : `${seekerCheckedCount} of ${activeGoals.length} checked off`}
        </Text>
      </View>

      <FlatList
        data={[...activeGoals, ...completedGoals]}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: insets.bottom + 140,
          gap: 10,
        }}
        ListEmptyComponent={
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
              <Feather name="target" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No goals yet
            </Text>
            <Text
              style={[styles.emptyBody, { color: colors.mutedForeground }]}
            >
              Your coach will add growth goals as your work together unfolds.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const completed = item.status === "completed";
          const checked = completed || !!seekerDone[item.id];
          return (
            <Pressable
              onPress={() => !completed && toggleGoal(item.id)}
              accessibilityLabel={`${
                checked ? "Uncheck" : "Check off"
              } goal: ${item.title}`}
              testID={`goal-${item.id}`}
              style={({ pressed }) => [
                styles.goalCard,
                {
                  backgroundColor: colors.card,
                  borderColor: checked ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: checked ? colors.primary : "transparent",
                    borderColor: checked ? colors.primary : colors.border,
                  },
                ]}
              >
                {checked ? (
                  <Feather name="check" size={14} color={colors.primaryForeground} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.goalTitle,
                    {
                      color: colors.foreground,
                      textDecorationLine: checked ? "line-through" : "none",
                    },
                  ]}
                >
                  {item.title}
                </Text>
                {item.description ? (
                  <Text
                    style={[
                      styles.goalDesc,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {item.description}
                  </Text>
                ) : null}
                {completed ? (
                  <Text
                    style={[styles.completedTag, { color: colors.success }]}
                  >
                    ✓ Completed by your coach
                  </Text>
                ) : !completed && seekerDone[item.id] ? (
                  <Text
                    style={[styles.pendingTag, { color: colors.mutedForeground }]}
                  >
                    Sent to your coach — waiting for confirmation
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  goalCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  goalTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  goalDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    lineHeight: 18,
  },
  completedTag: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
  },
  pendingTag: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
    fontStyle: "italic",
  },
  emptyCard: {
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    gap: 8,
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
