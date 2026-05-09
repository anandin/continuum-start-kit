import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";

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

const MOOD_OPTIONS: Array<{ score: number; emoji: string; label: string }> = [
  { score: 1, emoji: "😔", label: "Rough" },
  { score: 2, emoji: "🙁", label: "Low" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "😄", label: "Great" },
];

interface MoodCardProps {
  engagementId?: string | null;
}

export function MoodCard({ engagementId }: MoodCardProps) {
  const colors = useColors();
  const qc = useQueryClient();

  const moodQ = useQuery({
    queryKey: ["mood", "me"],
    queryFn: () => api<MoodMeResponse>("/api/mood/me?days=14"),
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const today = moodQ.data?.today ?? null;
  const [showNote, setShowNote] = useState(false);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  // When today's entry loads, reset local state so we render the "logged" state.
  useEffect(() => {
    if (today && !editing) {
      setPendingScore(null);
      setShowNote(false);
      setNote("");
    }
  }, [today, editing]);

  const submitMutation = useMutation({
    mutationFn: async (payload: { score: number; note?: string | null }) => {
      return api<MoodEntry>("/api/mood/today", {
        method: "POST",
        body: JSON.stringify({
          score: payload.score,
          note: payload.note?.trim() ? payload.note.trim() : null,
          engagementId: engagementId ?? null,
        }),
      });
    },
    onSuccess: () => {
      setEditing(false);
      setPendingScore(null);
      setShowNote(false);
      setNote("");
      qc.invalidateQueries({ queryKey: ["mood", "me"] });
      if (engagementId) {
        qc.invalidateQueries({
          queryKey: ["mood", "engagement", engagementId],
        });
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
    },
  });

  const handlePickScore = (score: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setPendingScore(score);
    setShowNote(true);
  };

  const handleSave = () => {
    if (pendingScore == null) return;
    submitMutation.mutate({ score: pendingScore, note });
  };

  const handleSkipNote = () => {
    if (pendingScore == null) return;
    submitMutation.mutate({ score: pendingScore });
  };

  const handleEdit = () => {
    setEditing(true);
    setPendingScore(today?.score ?? null);
    setNote(today?.note ?? "");
    setShowNote(!!today);
  };

  const showLoggedState = !!today && !editing;
  const todaysOption = today
    ? MOOD_OPTIONS.find((o) => o.score === today.score)
    : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          shadowColor: "#7A5A3C",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Feather name="activity" size={16} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            {showLoggedState ? "Today's mood" : "How are you today?"}
          </Text>
        </View>
        {showLoggedState ? (
          <Pressable
            onPress={handleEdit}
            accessibilityLabel="Change today's mood"
            testID="mood-edit"
          >
            <Text style={[styles.editLink, { color: colors.primary }]}>
              Change
            </Text>
          </Pressable>
        ) : null}
      </View>

      {moodQ.isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : showLoggedState && todaysOption ? (
        <View style={styles.loggedRow}>
          <Text style={styles.loggedEmoji}>{todaysOption.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.loggedLabel, { color: colors.foreground }]}>
              {todaysOption.label}
            </Text>
            {today?.note ? (
              <Text
                style={[styles.loggedNote, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                "{today.note}"
              </Text>
            ) : (
              <Text
                style={[styles.loggedNote, { color: colors.mutedForeground }]}
              >
                Logged for today
              </Text>
            )}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.optionsRow}>
            {MOOD_OPTIONS.map((opt) => {
              const selected = pendingScore === opt.score;
              return (
                <Pressable
                  key={opt.score}
                  onPress={() => handlePickScore(opt.score)}
                  accessibilityLabel={`Mood ${opt.score} of 5: ${opt.label}`}
                  testID={`mood-option-${opt.score}`}
                  style={({ pressed }) => [
                    styles.optionBtn,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? colors.gradientHeroMid
                        : "transparent",
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {showNote && pendingScore != null ? (
            <View style={styles.noteBlock}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="One line about how you feel (optional)"
                placeholderTextColor={colors.mutedForeground}
                maxLength={280}
                style={[
                  styles.noteInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.muted,
                  },
                ]}
                accessibilityLabel="Optional mood note"
                testID="mood-note-input"
              />
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={handleSkipNote}
                  disabled={submitMutation.isPending}
                  accessibilityLabel="Save mood without a note"
                  testID="mood-save-no-note"
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryLabel,
                      { color: colors.foreground },
                    ]}
                  >
                    Skip note
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={submitMutation.isPending}
                  accessibilityLabel="Save mood entry"
                  testID="mood-save"
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed || submitMutation.isPending ? 0.85 : 1,
                    },
                  ]}
                >
                  {submitMutation.isPending ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primaryForeground}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.primaryLabel,
                        { color: colors.primaryForeground },
                      ]}
                    >
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>
              {submitMutation.error ? (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  Couldn't save — please try again.
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <MoodSparkline entries={moodQ.data?.entries ?? []} />
    </View>
  );
}

interface SparklineProps {
  entries: MoodEntry[];
}

function MoodSparkline({ entries }: SparklineProps) {
  const colors = useColors();
  const width = 280;
  const height = 56;
  const padding = 6;
  const days = 14;

  const series = useMemo(() => {
    // Build a 14-slot array; entries are sorted ascending by day.
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
      // Score 1..5 → bottom..top
      const y = height - padding - ((s.score - 1) * (height - padding * 2)) / 4;
      return { x, y, score: s.score };
    })
    .filter((p): p is { x: number; y: number; score: number } => p != null);

  if (points.length === 0) {
    return (
      <View style={[styles.sparkBlock, { borderTopColor: colors.border }]}>
        <Text style={[styles.sparkEmpty, { color: colors.mutedForeground }]}>
          Your 14-day trend will appear here as you check in.
        </Text>
      </View>
    );
  }

  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View style={[styles.sparkBlock, { borderTopColor: colors.border }]}>
      <View style={styles.sparkHeaderRow}>
        <Text style={[styles.sparkLabel, { color: colors.mutedForeground }]}>
          Last 14 days
        </Text>
        <Text style={[styles.sparkLabel, { color: colors.mutedForeground }]}>
          {points.length} check-in{points.length === 1 ? "" : "s"}
        </Text>
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  editLink: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  loadingRow: {
    paddingVertical: 12,
    alignItems: "center",
  },
  loggedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loggedEmoji: {
    fontSize: 32,
  },
  loggedLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  loggedNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 18,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    gap: 4,
  },
  optionEmoji: {
    fontSize: 22,
  },
  optionLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  noteBlock: {
    gap: 10,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 999,
  },
  secondaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  primaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 80,
    alignItems: "center",
  },
  primaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  sparkBlock: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 6,
  },
  sparkHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sparkLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  sparkEmpty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
