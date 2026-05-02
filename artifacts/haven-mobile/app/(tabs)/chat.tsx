import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { fetchSpokenReplyUri, transcribeRecordingUri } from "@/lib/voice";

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

interface SessionSummary {
  sessionSummary?: string;
  session_summary?: string;
  assignedStage?: string;
  assigned_stage?: string;
  nextAction?: string;
  next_action?: string;
  trajectoryStatus?: string;
  trajectory_status?: string;
  keyInsights?: KeyInsight[];
  key_insights?: KeyInsight[];
}

interface KeyInsight {
  label?: string;
  insight?: string;
  score?: number;
}

interface FinishResponse {
  success: boolean;
  summary: SessionSummary | null;
  blockedBySafety?: boolean;
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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [activeSummary, setActiveSummary] = useState<SessionSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ---- Voice in/out state ---------------------------------------------------
  // `voiceOut` toggles whether new agent replies are spoken aloud.
  // `isTranscribing` covers the brief window between recording-stop and the
  // transcript being POSTed to /api/chat. `voiceError` surfaces transient
  // mic / network / Whisper failures without breaking text chat.
  const [voiceOut, setVoiceOut] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSpeakingMessageId, setIsSpeakingMessageId] = useState<string | null>(
    null,
  );

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const recordingActiveRef = useRef(false);

  const ttsPlayerRef = useRef<AudioPlayer | null>(null);
  const lastSpokenAgentMessageIdRef = useRef<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (recorderState.isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        pulseAnim.setValue(0);
      };
    }
    pulseAnim.setValue(0);
    return undefined;
  }, [recorderState.isRecording, pulseAnim]);

  // Configure the iOS audio session once so recording + playback can coexist.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    }).catch(() => {
      /* best-effort; voice features will surface their own error if unusable */
    });
  }, []);

  const stopAndReleaseTts = useCallback(() => {
    const player = ttsPlayerRef.current;
    ttsPlayerRef.current = null;
    setIsSpeakingMessageId(null);
    if (player) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      try {
        player.remove();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAndReleaseTts();
    };
  }, [stopAndReleaseTts]);

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

  // Ends the current session and shows the LLM-generated summary
  // (POST /api/sessions/:id/finish — same endpoint used by the web app).
  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!session?.id) throw new Error("No active session");
      return api<FinishResponse>(`/api/sessions/${session.id}/finish`, {
        method: "POST",
      });
    },
    onSuccess: (result) => {
      setActiveSummary(result.summary ?? null);
      if (!result.summary) {
        setSummaryError(
          result.blockedBySafety
            ? "Session ended. A summary couldn't be generated this time."
            : "Session ended. No summary was generated.",
        );
      } else {
        setSummaryError(null);
      }
      setConfirmEndOpen(false);
      setSummaryOpen(true);
      queryClient.invalidateQueries({
        queryKey: ["engagement-sessions", activeEngagement?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["session-messages", session?.id],
      });
    },
    onError: (err: unknown) => {
      setSummaryError(
        err instanceof Error
          ? err.message
          : "Couldn't end the session. Please try again.",
      );
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending || !session?.id) return;
    setInput("");
    sendMutation.mutate(text);
  };

  // ---- Voice recording (hold-to-talk) --------------------------------------
  const startRecording = useCallback(async () => {
    if (!session?.id || session.status === "ended") return;
    if (recordingActiveRef.current) return;
    setVoiceError(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setVoiceError(
          "Haven needs microphone access to hear your voice. Enable it in Settings.",
        );
        return;
      }
      // Stop any in-flight TTS so the mic isn't fighting the speaker.
      stopAndReleaseTts();
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingActiveRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (err) {
      recordingActiveRef.current = false;
      setVoiceError(
        err instanceof Error ? err.message : "Couldn't start recording.",
      );
    }
  }, [recorder, session?.id, session?.status, stopAndReleaseTts]);

  const finishRecording = useCallback(
    async (cancelled: boolean) => {
      // Hold-to-talk fires `onPressIn` (kicks off async startRecording) and
      // `onPressOut` (calls finishRecording). For brief taps or when iOS
      // shows a permission prompt on first use, onPressOut can land before
      // recordingActiveRef has flipped. Treat the recorder's own state as
      // authoritative so we still stop it cleanly in those races.
      const recorderIsLive =
        recorderState.isRecording || recorder.isRecording === true;
      if (!recordingActiveRef.current && !recorderIsLive) return;
      recordingActiveRef.current = false;
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri ?? null;
      } catch (err) {
        setVoiceError(
          err instanceof Error ? err.message : "Couldn't stop recording.",
        );
        return;
      }

      if (cancelled || !uri || !session?.id) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      setIsTranscribing(true);
      try {
        const text = await transcribeRecordingUri({ uri });
        if (!text) {
          setVoiceError("We couldn't hear you clearly. Try again.");
          return;
        }
        sendMutation.mutate(text);
      } catch (err) {
        setVoiceError(
          err instanceof Error
            ? err.message
            : "We couldn't transcribe that recording. Please try again.",
        );
      } finally {
        setIsTranscribing(false);
      }
    },
    [recorder, recorderState.isRecording, sendMutation, session?.id],
  );

  // ---- TTS auto-play of new agent replies -----------------------------------
  const speakAgentMessage = useCallback(
    async (msg: Message) => {
      if (!session?.id) return;
      try {
        stopAndReleaseTts();
        const uri = await fetchSpokenReplyUri({
          sessionId: session.id,
          messageId: msg.id,
        });
        const player = createAudioPlayer({ uri }, { updateInterval: 250 });
        ttsPlayerRef.current = player;
        setIsSpeakingMessageId(msg.id);
        const sub = player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish) {
            try {
              sub.remove();
            } catch {
              /* ignore */
            }
            if (ttsPlayerRef.current === player) {
              stopAndReleaseTts();
            }
          }
        });
        player.play();
      } catch (err) {
        setVoiceError(
          err instanceof Error
            ? err.message
            : "Couldn't play the reply out loud.",
        );
        stopAndReleaseTts();
      }
    },
    [session?.id, stopAndReleaseTts],
  );

  const data = useMemo(() => {
    const arr = (messagesQ.data ?? []).slice().sort((a, b) => ts(a) - ts(b));
    return arr.slice().reverse();
  }, [messagesQ.data]);

  // Auto-speak the latest agent message when voice-out is enabled and the
  // message id changes. We track `lastSpokenAgentMessageIdRef` so toggling
  // the speaker on mid-conversation doesn't replay older messages.
  useEffect(() => {
    if (!voiceOut) return;
    const sortedAsc = (messagesQ.data ?? [])
      .slice()
      .sort((a, b) => ts(a) - ts(b));
    const latestAgent = [...sortedAsc].reverse().find((m) => m.role === "agent");
    if (!latestAgent) return;
    if (lastSpokenAgentMessageIdRef.current === latestAgent.id) return;
    lastSpokenAgentMessageIdRef.current = latestAgent.id;
    void speakAgentMessage(latestAgent);
  }, [messagesQ.data, voiceOut, speakAgentMessage]);

  // When voice-out is turned off, silence anything currently speaking.
  useEffect(() => {
    if (!voiceOut) {
      stopAndReleaseTts();
    }
  }, [voiceOut, stopAndReleaseTts]);

  const toggleVoiceOut = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setVoiceOut((prev) => {
      const next = !prev;
      if (next) {
        // First enable: don't replay history, just start from the next reply.
        const sortedAsc = (messagesQ.data ?? [])
          .slice()
          .sort((a, b) => ts(a) - ts(b));
        const latestAgent = [...sortedAsc]
          .reverse()
          .find((m) => m.role === "agent");
        lastSpokenAgentMessageIdRef.current = latestAgent?.id ?? null;
      }
      return next;
    });
  }, [messagesQ.data]);

  const recordingDisabled =
    !session?.id ||
    session?.status === "ended" ||
    sendMutation.isPending ||
    isTranscribing;

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
        <Pressable
          onPress={toggleVoiceOut}
          accessibilityLabel={
            voiceOut ? "Mute coach voice playback" : "Hear coach replies aloud"
          }
          accessibilityRole="switch"
          accessibilityState={{ checked: voiceOut }}
          testID="chat-voice-out-toggle"
          hitSlop={8}
          style={({ pressed }) => [
            styles.voiceToggleBtn,
            {
              backgroundColor: voiceOut
                ? colors.primary
                : colors.gradientHeroMid,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather
            name={
              isSpeakingMessageId
                ? "volume-2"
                : voiceOut
                  ? "volume-2"
                  : "volume-x"
            }
            size={14}
            color={voiceOut ? colors.primaryForeground : colors.primary}
          />
        </Pressable>
        {session?.status === "ended" ? (
          <View
            style={[
              styles.statusPill,
              { backgroundColor: colors.muted },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: colors.mutedForeground },
              ]}
            >
              Completed
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => setConfirmEndOpen(true)}
            disabled={!session?.id || finishMutation.isPending}
            accessibilityLabel="End session and view summary"
            testID="chat-end-session"
            hitSlop={8}
            style={({ pressed }) => [
              styles.endBtn,
              {
                backgroundColor: colors.gradientHeroMid,
                opacity: pressed || finishMutation.isPending ? 0.7 : 1,
              },
            ]}
          >
            {finishMutation.isPending ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Feather name="check-circle" size={14} color={colors.primary} />
                <Text style={[styles.endBtnText, { color: colors.primary }]}>
                  End
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {session?.status === "ended" && !summaryOpen ? (
        <Pressable
          onPress={async () => {
            try {
              const existing = await api<SessionSummary | null>(
                `/api/sessions/${session.id}/summary`,
              );
              setActiveSummary(existing ?? null);
              if (!existing) {
                setSummaryError("No summary was saved for this session.");
              } else {
                setSummaryError(null);
              }
              setSummaryOpen(true);
            } catch (err: unknown) {
              setSummaryError(
                err instanceof Error
                  ? err.message
                  : "Couldn't load the session summary.",
              );
              setSummaryOpen(true);
            }
          }}
          style={({ pressed }) => [
            styles.viewSummaryBar,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="file-text" size={14} color={colors.primary} />
          <Text
            style={[styles.viewSummaryText, { color: colors.primary }]}
          >
            View session summary
          </Text>
        </Pressable>
      ) : null}

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

        {voiceError || recorderState.isRecording || isTranscribing ? (
          <View
            style={[
              styles.voiceBanner,
              {
                backgroundColor: voiceError
                  ? colors.muted
                  : colors.gradientHeroMid,
                borderTopColor: colors.border,
              },
            ]}
            accessibilityLiveRegion="polite"
          >
            {recorderState.isRecording ? (
              <>
                <Animated.View
                  style={[
                    styles.recordingDot,
                    {
                      backgroundColor: colors.primary,
                      opacity: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                      transform: [
                        {
                          scale: pulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1.3],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Text
                  style={[styles.voiceBannerText, { color: colors.primary }]}
                >
                  Listening… release to send
                </Text>
              </>
            ) : isTranscribing ? (
              <>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text
                  style={[styles.voiceBannerText, { color: colors.primary }]}
                >
                  Transcribing what you said…
                </Text>
              </>
            ) : (
              <>
                <Feather
                  name="alert-circle"
                  size={14}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.voiceBannerText,
                    { color: colors.mutedForeground, flex: 1 },
                  ]}
                  numberOfLines={2}
                >
                  {voiceError}
                </Text>
                <Pressable
                  onPress={() => setVoiceError(null)}
                  hitSlop={8}
                  accessibilityLabel="Dismiss voice error"
                >
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </Pressable>
              </>
            )}
          </View>
        ) : null}

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
                : recorderState.isRecording
                  ? "Listening…"
                  : isTranscribing
                    ? "Transcribing…"
                    : "Share what's on your mind…"
            }
            placeholderTextColor={colors.mutedForeground}
            editable={
              session?.status !== "ended" &&
              !recorderState.isRecording &&
              !isTranscribing
            }
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
          {input.trim().length > 0 ? (
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
                <ActivityIndicator
                  color={colors.primaryForeground}
                  size="small"
                />
              ) : (
                <Feather
                  name="send"
                  size={18}
                  color={colors.primaryForeground}
                />
              )}
            </Pressable>
          ) : (
            <Pressable
              onPressIn={() => {
                if (recordingDisabled) return;
                void startRecording();
              }}
              onPressOut={() => {
                void finishRecording(false);
              }}
              onLongPress={() => {
                /* hold-to-talk handled in onPressIn/onPressOut */
              }}
              delayLongPress={120}
              disabled={recordingDisabled}
              accessibilityLabel="Hold to record a voice message"
              accessibilityHint="Press and hold to record. Release to send your voice message."
              testID="chat-mic"
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: recorderState.isRecording
                    ? "#D9534F"
                    : colors.primary,
                  opacity:
                    recordingDisabled && !recorderState.isRecording
                      ? 0.4
                      : pressed && !recorderState.isRecording
                        ? 0.8
                        : 1,
                  transform: recorderState.isRecording
                    ? [
                        {
                          scale: pulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.12],
                          }),
                        },
                      ]
                    : undefined,
                },
              ]}
            >
              {isTranscribing ? (
                <ActivityIndicator
                  color={colors.primaryForeground}
                  size="small"
                />
              ) : (
                <Feather
                  name="mic"
                  size={20}
                  color={colors.primaryForeground}
                />
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={confirmEndOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmEndOpen(false)}
      >
        <Pressable
          onPress={() => setConfirmEndOpen(false)}
          style={[styles.modalBackdrop, { backgroundColor: "rgba(20,16,12,0.55)" }]}
        >
          <Pressable
            onPress={() => {}}
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: 22,
              },
            ]}
          >
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: colors.gradientHeroMid },
              ]}
            >
              <Feather name="check-circle" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              End this session?
            </Text>
            <Text
              style={[
                styles.modalBody,
                { color: colors.mutedForeground },
              ]}
            >
              We'll save what you talked about and write a short summary you and
              your coach can refer back to.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmEndOpen(false)}
                style={({ pressed }) => [
                  styles.modalBtnSecondary,
                  {
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    { color: colors.foreground },
                  ]}
                >
                  Keep chatting
                </Text>
              </Pressable>
              <Pressable
                onPress={() => finishMutation.mutate()}
                disabled={finishMutation.isPending}
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  {
                    backgroundColor: colors.primary,
                    opacity:
                      pressed || finishMutation.isPending ? 0.8 : 1,
                  },
                ]}
                testID="chat-confirm-end"
              >
                {finishMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.modalBtnText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    End & summarize
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={summaryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSummaryOpen(false)}
      >
        <View
          style={[styles.summaryBackdrop, { backgroundColor: "rgba(20,16,12,0.55)" }]}
        >
          <View
            style={[
              styles.summarySheet,
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: insets.bottom + 24,
              },
            ]}
          >
            <View style={styles.summaryHeader}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.summaryTitle, { color: colors.foreground }]}
                >
                  Session summary
                </Text>
                <Text
                  style={[
                    styles.summarySub,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Saved to your shared record with your coach.
                </Text>
              </View>
              <Pressable
                onPress={() => setSummaryOpen(false)}
                hitSlop={10}
                accessibilityLabel="Close summary"
                style={[
                  styles.summaryClose,
                  { backgroundColor: colors.muted },
                ]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              style={{ marginTop: 12 }}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {summaryError ? (
                <Text
                  style={[
                    styles.summaryParagraph,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {summaryError}
                </Text>
              ) : null}

              {activeSummary ? (
                <>
                  <Text
                    style={[
                      styles.summarySectionLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    What we explored
                  </Text>
                  <Text
                    style={[
                      styles.summaryParagraph,
                      { color: colors.foreground },
                    ]}
                  >
                    {activeSummary.sessionSummary ??
                      activeSummary.session_summary ??
                      "Your reflections were saved."}
                  </Text>

                  {(activeSummary.keyInsights ?? activeSummary.key_insights ?? [])
                    .length > 0 ? (
                    <>
                      <Text
                        style={[
                          styles.summarySectionLabel,
                          {
                            color: colors.mutedForeground,
                            marginTop: 18,
                          },
                        ]}
                      >
                        Key insights
                      </Text>
                      {(activeSummary.keyInsights ??
                        activeSummary.key_insights ??
                        []).map((k, i) => (
                        <View
                          key={`insight-${i}`}
                          style={[
                            styles.insightRow,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          {k.label ? (
                            <Text
                              style={[
                                styles.insightLabel,
                                { color: colors.primary },
                              ]}
                            >
                              {k.label}
                            </Text>
                          ) : null}
                          {k.insight ? (
                            <Text
                              style={[
                                styles.insightText,
                                { color: colors.foreground },
                              ]}
                            >
                              {k.insight}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </>
                  ) : null}

                  {activeSummary.nextAction ?? activeSummary.next_action ? (
                    <>
                      <Text
                        style={[
                          styles.summarySectionLabel,
                          {
                            color: colors.mutedForeground,
                            marginTop: 18,
                          },
                        ]}
                      >
                        Next step
                      </Text>
                      <Text
                        style={[
                          styles.summaryParagraph,
                          { color: colors.foreground },
                        ]}
                      >
                        {activeSummary.nextAction ?? activeSummary.next_action}
                      </Text>
                    </>
                  ) : null}

                  {activeSummary.assignedStage ?? activeSummary.assigned_stage ? (
                    <View
                      style={[
                        styles.stagePill,
                        { backgroundColor: colors.gradientHeroMid },
                      ]}
                    >
                      <Feather name="compass" size={12} color={colors.primary} />
                      <Text style={[styles.stageText, { color: colors.primary }]}>
                        Stage:{" "}
                        {activeSummary.assignedStage ??
                          activeSummary.assigned_stage}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>

            <Pressable
              onPress={() => {
                setSummaryOpen(false);
                ensureSession.mutate();
              }}
              style={({ pressed }) => [
                styles.summaryCta,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryCtaText,
                  { color: colors.primaryForeground },
                ]}
              >
                Start a new session
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  endBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 60,
    justifyContent: "center",
  },
  endBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  voiceToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  voiceBannerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  viewSummaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  viewSummaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    padding: 22,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  modalBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    width: "100%",
  },
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  summaryBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  summarySheet: {
    paddingHorizontal: 22,
    paddingTop: 18,
    maxHeight: "85%",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  summarySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  summaryClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  summarySectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  summaryParagraph: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  insightRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    gap: 4,
  },
  insightLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  insightText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  stagePill: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 16,
  },
  stageText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  summaryCta: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 14,
  },
  summaryCtaText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
