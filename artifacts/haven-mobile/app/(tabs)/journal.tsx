import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

interface JournalPrompt {
  id: string;
  text: string;
  category: string | null;
}

interface JournalEntry {
  id: string;
  body: string;
  promptId: string | null;
  sharedWithCoach: boolean;
  sharedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [shareToggle, setShareToggle] = useState(false);

  const promptsQ = useQuery({
    queryKey: ["journal", "prompts", "available"],
    queryFn: () => api<JournalPrompt[]>("/api/journal/prompts/available"),
    enabled: !!user,
  });

  const entriesQ = useQuery({
    queryKey: ["journal", "entries", "me"],
    queryFn: () => api<JournalEntry[]>("/api/journal/entries/me"),
    enabled: !!user,
  });

  const promptById = useMemo(() => {
    const map = new Map<string, JournalPrompt>();
    for (const p of promptsQ.data ?? []) map.set(p.id, p);
    return map;
  }, [promptsQ.data]);

  const createMutation = useMutation({
    mutationFn: async () =>
      api<JournalEntry>("/api/journal/entries", {
        method: "POST",
        body: JSON.stringify({
          body: body.trim(),
          promptId: selectedPromptId,
          sharedWithCoach: shareToggle,
        }),
      }),
    onSuccess: () => {
      setComposerOpen(false);
      setSelectedPromptId(null);
      setBody("");
      setShareToggle(false);
      qc.invalidateQueries({ queryKey: ["journal", "entries", "me"] });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
    },
    onError: (err: Error) => {
      Alert.alert("Couldn't save", err.message);
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (entryId: string) =>
      api<JournalEntry>(`/api/journal/entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ sharedWithCoach: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal", "entries", "me"] });
    },
    onError: (err: Error) => {
      Alert.alert("Couldn't share", err.message);
    },
  });

  const startNewEntry = (promptId: string | null) => {
    setSelectedPromptId(promptId);
    setBody("");
    setShareToggle(false);
    setComposerOpen(true);
  };

  const renderEntry = ({ item }: { item: JournalEntry }) => {
    const prompt = item.promptId ? promptById.get(item.promptId) : null;
    const date = new Date(item.createdAt);
    return (
      <View
        style={[
          styles.entryCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.entryHeader}>
          <Text style={[styles.entryDate, { color: colors.mutedForeground }]}>
            {date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
          {item.sharedWithCoach ? (
            <View
              style={[
                styles.sharedBadge,
                { backgroundColor: colors.gradientHeroMid },
              ]}
            >
              <Feather name="users" size={11} color={colors.primary} />
              <Text style={[styles.sharedBadgeText, { color: colors.primary }]}>
                Shared with coach
              </Text>
            </View>
          ) : null}
        </View>
        {prompt ? (
          <Text
            style={[styles.promptLine, { color: colors.primary }]}
            numberOfLines={2}
          >
            {prompt.text}
          </Text>
        ) : null}
        <Text style={[styles.entryBody, { color: colors.foreground }]}>
          {item.body}
        </Text>
        {!item.sharedWithCoach ? (
          <Pressable
            onPress={() => {
              Alert.alert(
                "Share with coach?",
                "Once shared, this entry can't be edited or unshared.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Share",
                    onPress: () => shareMutation.mutate(item.id),
                  },
                ],
              );
            }}
            disabled={shareMutation.isPending}
            style={({ pressed }) => [
              styles.shareLink,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            testID={`journal-share-${item.id}`}
          >
            <Feather name="send" size={13} color={colors.primary} />
            <Text style={[styles.shareLinkText, { color: colors.primary }]}>
              Share with coach
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  if (entriesQ.isLoading) {
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

  const entries = entriesQ.data ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        renderItem={renderEntry}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 96 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Journal
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              A private space to reflect. Share entries with your coach when
              you're ready.
            </Text>
            <Pressable
              onPress={() => startNewEntry(null)}
              style={({ pressed }) => [
                styles.newBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                  borderRadius: colors.radius,
                },
              ]}
              testID="journal-new-entry"
            >
              <Feather
                name="edit-3"
                size={16}
                color={colors.primaryForeground}
              />
              <Text
                style={[styles.newBtnText, { color: colors.primaryForeground }]}
              >
                New entry
              </Text>
            </Pressable>

            {(promptsQ.data ?? []).length > 0 ? (
              <View style={styles.promptsBlock}>
                <Text
                  style={[
                    styles.promptsLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Or start from a prompt
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.promptsRow}
                >
                  {(promptsQ.data ?? []).slice(0, 8).map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => startNewEntry(p.id)}
                      style={({ pressed }) => [
                        styles.promptChip,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          borderRadius: colors.radius,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                      testID={`journal-prompt-${p.id}`}
                    >
                      <Text
                        style={[
                          styles.promptChipText,
                          { color: colors.foreground },
                        ]}
                        numberOfLines={3}
                      >
                        {p.text}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.empty,
              { borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <Feather
              name="book-open"
              size={28}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No entries yet
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.mutedForeground }]}
            >
              Reflect on your week, a feeling, or something you want to bring to
              your next session.
            </Text>
          </View>
        }
      />

      {composerOpen ? (
        <Composer
          colors={colors}
          insets={insets}
          prompt={
            selectedPromptId ? (promptById.get(selectedPromptId) ?? null) : null
          }
          body={body}
          setBody={setBody}
          shareToggle={shareToggle}
          setShareToggle={setShareToggle}
          isSaving={createMutation.isPending}
          onCancel={() => setComposerOpen(false)}
          onSave={() => createMutation.mutate()}
        />
      ) : null}
    </View>
  );
}

interface ComposerProps {
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  prompt: JournalPrompt | null;
  body: string;
  setBody: (v: string) => void;
  shareToggle: boolean;
  setShareToggle: (v: boolean) => void;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

function Composer({
  colors,
  insets,
  prompt,
  body,
  setBody,
  shareToggle,
  setShareToggle,
  isSaving,
  onCancel,
  onSave,
}: ComposerProps) {
  const canSave = body.trim().length > 0 && !isSaving;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.composerOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}
    >
      <View
        style={[
          styles.composerSheet,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 16,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          },
        ]}
      >
        <View style={styles.composerHeader}>
          <Pressable onPress={onCancel} testID="journal-cancel">
            <Text
              style={[styles.composerCancel, { color: colors.mutedForeground }]}
            >
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.composerTitle, { color: colors.foreground }]}>
            New entry
          </Text>
          <Pressable onPress={onSave} disabled={!canSave} testID="journal-save">
            <Text
              style={[
                styles.composerSave,
                {
                  color: canSave ? colors.primary : colors.mutedForeground,
                  opacity: canSave ? 1 : 0.6,
                },
              ]}
            >
              {isSaving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        </View>

        {prompt ? (
          <View
            style={[
              styles.composerPrompt,
              {
                backgroundColor: colors.gradientHeroMid,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="message-circle" size={14} color={colors.primary} />
            <Text
              style={[styles.composerPromptText, { color: colors.primary }]}
            >
              {prompt.text}
            </Text>
          </View>
        ) : null}

        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write what's on your mind…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          textAlignVertical="top"
          maxLength={10000}
          style={[
            styles.composerInput,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.card,
              borderRadius: colors.radius,
            },
          ]}
          testID="journal-body-input"
        />

        <View
          style={[
            styles.shareRow,
            { borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.shareLabel, { color: colors.foreground }]}>
              Share with coach
            </Text>
            <Text style={[styles.shareHelp, { color: colors.mutedForeground }]}>
              Once shared, this entry can't be edited or unshared.
            </Text>
          </View>
          <Switch
            value={shareToggle}
            onValueChange={setShareToggle}
            testID="journal-share-toggle"
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 16, gap: 12 },
  header: { gap: 10, marginBottom: 6 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginTop: 4,
  },
  newBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  promptsBlock: { gap: 8, marginTop: 6 },
  promptsLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  promptsRow: { gap: 8, paddingRight: 8 },
  promptChip: {
    width: 200,
    borderWidth: 1,
    padding: 12,
    minHeight: 72,
    justifyContent: "center",
  },
  promptChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 24,
    alignItems: "center",
    gap: 6,
    marginTop: 16,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  entryCard: {
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryDate: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sharedBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  promptLine: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  entryBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  shareLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  shareLinkText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  composerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  composerSheet: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    maxHeight: "92%",
  },
  composerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  composerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  composerCancel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  composerSave: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  composerPrompt: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    alignItems: "flex-start",
  },
  composerPromptText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  composerInput: {
    borderWidth: 1,
    minHeight: 200,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  shareRow: {
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shareLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  shareHelp: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
