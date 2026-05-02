import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

interface Engagement {
  id: string;
  status?: string;
  providerId?: string;
  provider?: { email?: string };
  sessions?: SessionRow[];
}

interface SessionRow {
  id: string;
  engagementId?: string;
  status?: string;
  initialStage?: string;
  initial_stage?: string;
  startedAt?: string;
  started_at?: string;
}

interface Message {
  id: string;
  role: "seeker" | "agent" | "provider";
  content: string;
  createdAt?: string;
  created_at?: string;
}

interface ProviderConfig {
  providerId: string;
  title?: string;
}

function ts(s?: SessionRow | Message): number {
  return new Date(
    (s as SessionRow | Message | undefined)?.["createdAt" as never] ??
      (s as SessionRow | Message | undefined)?.["created_at" as never] ??
      (s as SessionRow | undefined)?.startedAt ??
      (s as SessionRow | undefined)?.started_at ??
      0,
  ).getTime();
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const listRef = useRef<FlatList<Message>>(null);

  const [input, setInput] = useState("");

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

  const sessionsQ = useQuery({
    queryKey: ["engagement-sessions", activeEngagement?.id],
    queryFn: () =>
      api<SessionRow[]>(`/api/engagements/${activeEngagement!.id}/sessions`),
    enabled: !!activeEngagement?.id,
  });

  const ensureSession = useMutation({
    mutationFn: async () => {
      if (!activeEngagement) throw new Error("No active engagement");
      const sessions = sessionsQ.data ?? [];
      const active = sessions.find((s) => s.status === "active");
      if (active) return active;
      const latest = sessions
        .slice()
        .sort((a, b) => ts(b) - ts(a))[0];
      const created = await api<SessionRow>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          engagementId: activeEngagement.id,
          initialStage:
            latest?.initialStage ?? latest?.initial_stage ?? "check-in",
        }),
      });
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["engagement-sessions", activeEngagement?.id],
      });
    },
  });

  const session: SessionRow | undefined = useMemo(() => {
    const sessions = sessionsQ.data ?? [];
    return (
      sessions.find((s) => s.status === "active") ??
      sessions.slice().sort((a, b) => ts(b) - ts(a))[0]
    );
  }, [sessionsQ.data]);

  useFocusEffect(
    useCallback(() => {
      if (
        activeEngagement &&
        sessionsQ.isSuccess &&
        (sessionsQ.data?.length ?? 0) === 0 &&
        !ensureSession.isPending
      ) {
        ensureSession.mutate();
      }
    }, [activeEngagement, sessionsQ.isSuccess, sessionsQ.data, ensureSession]),
  );

  const messagesQ = useQuery({
    queryKey: ["session-messages", session?.id],
    queryFn: () => api<Message[]>(`/api/sessions/${session!.id}/messages`),
    enabled: !!session?.id,
    refetchInterval: 4000,
  });

  const providerConfigsQ = useQuery({
    queryKey: ["provider-configs"],
    queryFn: () => api<ProviderConfig[]>("/api/provider-configs"),
    enabled: !!activeEngagement?.providerId,
  });

  const providerConfig = useMemo(
    () =>
      providerConfigsQ.data?.find(
        (c) => c.providerId === activeEngagement?.providerId,
      ),
    [providerConfigsQ.data, activeEngagement],
  );

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!session?.id) throw new Error("No active session");
      return api(`/api/chat`, {
        method: "POST",
        body: JSON.stringify({ sessionId: session.id, message }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["session-messages", session?.id],
      });
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending || !session?.id) return;
    setInput("");
    sendMutation.mutate(text);
  };

  const data = useMemo(() => {
    const arr = (messagesQ.data ?? []).slice().sort((a, b) => ts(a) - ts(b));
    return arr.slice().reverse();
  }, [messagesQ.data]);

  const coachInitial = providerConfig?.title?.charAt(0) ?? "H";
  const coachTitle = providerConfig?.title ?? "Your Coach";

  if (engagementsQ.isLoading || (activeEngagement && sessionsQ.isLoading)) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!activeEngagement) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingHorizontal: 24 }]}
      >
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: colors.gradientHeroMid },
          ]}
        >
          <Feather name="message-circle" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 12 }]}>
          No active coach yet
        </Text>
        <Text
          style={[
            styles.emptyBody,
            { color: colors.mutedForeground, marginTop: 6 },
          ]}
        >
          Connect with a coach from the web app, then come back here to start
          chatting.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push("/(tabs)")}
          accessibilityLabel="Back to home"
          hitSlop={10}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <View
          style={[styles.avatar, { backgroundColor: colors.gradientHeroMid }]}
        >
          <Text
            style={[styles.avatarText, { color: colors.primary }]}
          >
            {coachInitial}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.headerTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {coachTitle}
          </Text>
          <Text
            style={[styles.headerSub, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {session?.initialStage ??
              session?.initial_stage ??
              "Coaching session"}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor:
                session?.status === "ended"
                  ? colors.muted
                  : colors.gradientHeroMid,
            },
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              { color: colors.mutedForeground },
            ]}
          >
            {session?.status === "ended" ? "Completed" : "Active"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={data}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingTop: 16,
            paddingBottom: 16,
          }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            sendMutation.isPending ? (
              <View
                style={[styles.bubbleRow, { justifyContent: "flex-start" }]}
              >
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRadius: 18,
                    },
                  ]}
                >
                  <View style={styles.typingRow}>
                    <View
                      style={[styles.dot, { backgroundColor: colors.primary }]}
                    />
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: colors.primary, opacity: 0.7 },
                      ]}
                    />
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: colors.primary, opacity: 0.4 },
                      ]}
                    />
                    <Text
                      style={[
                        styles.typingText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Reflecting…
                    </Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !messagesQ.isLoading ? (
              <View style={styles.emptyChat}>
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: colors.gradientHeroMid },
                  ]}
                >
                  <Feather name="heart" size={22} color={colors.primary} />
                </View>
                <Text
                  style={[styles.emptyTitle, { color: colors.foreground }]}
                >
                  Welcome to your safe space
                </Text>
                <Text
                  style={[
                    styles.emptyBody,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Take your time. Share whatever feels right.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isSeeker = item.role === "seeker";
            return (
              <View
                style={[
                  styles.bubbleRow,
                  { justifyContent: isSeeker ? "flex-end" : "flex-start" },
                ]}
              >
                {!isSeeker ? (
                  <View
                    style={[
                      styles.miniAvatar,
                      { backgroundColor: colors.gradientHeroMid },
                    ]}
                  >
                    <Text
                      style={[
                        styles.miniAvatarText,
                        { color: colors.primary },
                      ]}
                    >
                      {coachInitial}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isSeeker ? colors.primary : colors.card,
                      borderColor: isSeeker ? "transparent" : colors.border,
                      borderRadius: 18,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      {
                        color: isSeeker
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {item.content}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom:
                Math.max(insets.bottom, 8) + (Platform.OS === "web" ? 84 : 70),
            },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={
              session?.status === "ended"
                ? "This session has ended"
                : "Share what's on your mind…"
            }
            placeholderTextColor={colors.mutedForeground}
            editable={session?.status !== "ended"}
            multiline
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
                borderRadius: 22,
              },
            ]}
            testID="chat-input"
          />
          <Pressable
            onPress={handleSend}
            disabled={
              !input.trim() ||
              sendMutation.isPending ||
              session?.status === "ended"
            }
            accessibilityLabel="Send message"
            testID="chat-send"
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity:
                  !input.trim() ||
                  sendMutation.isPending ||
                  session?.status === "ended" ||
                  pressed
                    ? 0.6
                    : 1,
              },
            ]}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Feather
                name="send"
                size={18}
                color={colors.primaryForeground}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingHorizontal: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginVertical: 4,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginLeft: 6,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChat: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
    transform: [{ scaleY: -1 }],
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
    paddingHorizontal: 32,
    lineHeight: 19,
  },
});
