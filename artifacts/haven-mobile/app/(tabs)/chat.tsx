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
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
import {
  fetchAttachmentURL,
  uploadAttachment,
  type UploadedAttachment,
} from "@/lib/attachments";
import { fetchSpokenReplyUri } from "@/lib/voice";

interface MessageAttachment {
  id: string;
  kind: "image" | "audio";
  mime: string;
  durationS?: number | null;
  transcript?: string | null;
}

// expo-audio player methods throw if invoked after the player has been
// released; swallow those specific errors without masking real bugs.
function safeAudio<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Local-file preview player shown inside the voice-memo confirmation
// sheet so the seeker can hear the recording (and see its duration +
// a faux waveform) before deciding to send.
function VoicePreviewPlayer({
  uri,
  durationS,
  color,
  tintBg,
  fg,
  muted,
}: {
  uri: string;
  durationS: number;
  color: string;
  tintBg: string;
  fg: string;
  muted: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedS, setElapsedS] = useState(0);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      safeAudio(() => playerRef.current?.remove());
      playerRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    if (playerRef.current && isPlaying) {
      safeAudio(() => playerRef.current?.pause());
      setIsPlaying(false);
      return;
    }
    if (!playerRef.current) {
      const player = createAudioPlayer({ uri }, { updateInterval: 200 });
      playerRef.current = player;
      const sub = player.addListener("playbackStatusUpdate", (status) => {
        if (typeof status.currentTime === "number") {
          setElapsedS(status.currentTime);
        }
        if (status.didJustFinish) {
          setIsPlaying(false);
          setElapsedS(0);
          safeAudio(() => sub.remove());
          safeAudio(() => player.remove());
          playerRef.current = null;
        }
      });
    }
    safeAudio(() => playerRef.current?.play());
    setIsPlaying(true);
  }, [isPlaying, uri]);

  const bars = useMemo(() => {
    const seed = Math.max(uri.length, 1);
    return Array.from({ length: 28 }, (_, i) => {
      const v = Math.abs(Math.sin((i + 1) * (seed % 7) * 0.31));
      return 6 + Math.round(v * 22);
    });
  }, [uri]);

  const progress = durationS > 0 ? Math.min(1, elapsedS / durationS) : 0;
  const activeIdx = Math.floor(progress * bars.length);

  return (
    <View style={{ width: "100%", gap: 10, marginTop: 4 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: tintBg,
          borderRadius: 16,
        }}
      >
        <Pressable
          onPress={toggle}
          accessibilityLabel={isPlaying ? "Pause preview" : "Play preview"}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: color,
            alignItems: "center",
            justifyContent: "center",
          }}
          testID="voice-preview-toggle"
        >
          <Feather name={isPlaying ? "pause" : "play"} size={16} color="#fff" />
        </Pressable>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            height: 28,
          }}
        >
          {bars.map((h, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: h,
                borderRadius: 1.5,
                backgroundColor: i <= activeIdx ? color : muted,
                opacity: i <= activeIdx ? 1 : 0.45,
              }}
            />
          ))}
        </View>
        <Text
          style={{
            color: fg,
            fontSize: 12,
            fontFamily: "Inter_500Medium",
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {formatDuration(isPlaying || elapsedS > 0 ? elapsedS : durationS)}
        </Text>
      </View>
    </View>
  );
}

function AttachmentView({
  att,
  isSeeker,
  bubbleColors,
}: {
  att: MessageAttachment;
  isSeeker: boolean;
  bubbleColors: { foreground: string; muted: string };
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAttachmentURL(att.id)
      .then((res) => {
        if (!cancelled) setUrl(res.url);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Couldn't load attachment",
          );
        }
      });
    return () => {
      cancelled = true;
      safeAudio(() => playerRef.current?.remove());
      playerRef.current = null;
    };
  }, [att.id]);

  const togglePlay = useCallback(() => {
    if (!url) return;
    if (playerRef.current && isPlaying) {
      safeAudio(() => playerRef.current?.pause());
      setIsPlaying(false);
      return;
    }
    if (!playerRef.current) {
      const player = createAudioPlayer({ uri: url }, { updateInterval: 250 });
      playerRef.current = player;
      const sub = player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          safeAudio(() => sub.remove());
          safeAudio(() => player.remove());
          playerRef.current = null;
        }
      });
    }
    try {
      playerRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't play audio");
    }
  }, [isPlaying, url]);

  if (att.kind === "image") {
    if (error) {
      return (
        <Text style={{ color: bubbleColors.muted, fontSize: 12, marginTop: 4 }}>
          {error}
        </Text>
      );
    }
    return (
      <ExpoImage
        source={url ? { uri: url } : undefined}
        style={{
          width: 200,
          height: 200,
          borderRadius: 12,
          marginTop: 4,
          backgroundColor: "rgba(0,0,0,0.05)",
        }}
        contentFit="cover"
        transition={150}
        accessibilityLabel="Shared photo"
      />
    );
  }

  // audio
  return (
    <View style={{ marginTop: 4, gap: 6 }}>
      <Pressable
        onPress={togglePlay}
        disabled={!url}
        accessibilityLabel={isPlaying ? "Pause voice memo" : "Play voice memo"}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: isSeeker
            ? "rgba(255,255,255,0.18)"
            : "rgba(0,0,0,0.06)",
          alignSelf: "flex-start",
          opacity: url ? 1 : 0.5,
        }}
      >
        <Feather
          name={isPlaying ? "pause" : "play"}
          size={14}
          color={bubbleColors.foreground}
        />
        <Text style={{ color: bubbleColors.foreground, fontSize: 13 }}>
          Voice memo
          {att.durationS ? ` · ${att.durationS}s` : ""}
        </Text>
      </Pressable>
      {error ? (
        <Text style={{ color: bubbleColors.muted, fontSize: 12 }}>{error}</Text>
      ) : null}
    </View>
  );
}

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
  redactedAt?: string | null;
  redacted_at?: string | null;
  attachments?: MessageAttachment[];
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
  const [redactTarget, setRedactTarget] = useState<Message | null>(null);
  const redactMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api(`/api/messages/${messageId}/redact`, { method: "POST" });
      return messageId;
    },
    onSuccess: (messageId) => {
      setRedactTarget(null);
      // Optimistic patch; server already strips content + sets redactedAt.
      const sid = session?.id;
      if (sid) {
        queryClient.setQueryData<Message[] | undefined>(
          ["session-messages", sid],
          (prev) =>
            prev?.map((m) =>
              m.id === messageId
                ? { ...m, content: "", redactedAt: new Date().toISOString() }
                : m,
            ),
        );
        void queryClient.invalidateQueries({
          queryKey: ["session-messages", sid],
        });
      }
    },
    onError: () => {
      setRedactTarget(null);
    },
  });
  const [activeSummary, setActiveSummary] = useState<SessionSummary | null>(
    null,
  );
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
      safeAudio(() => player.pause());
      safeAudio(() => player.remove());
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
      const latest = sessions.slice().sort((a, b) => ts(b) - ts(a))[0];
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
    mutationFn: async (input: {
      message?: string;
      attachments?: UploadedAttachment[];
    }) => {
      if (!session?.id) throw new Error("No active session");
      return api(`/api/chat`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.id,
          message: input.message ?? "",
          attachments: input.attachments ?? [],
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["session-messages", session?.id],
      });
    },
  });

  // Photo flow: paperclip opens an action sheet (camera vs. library);
  // the chosen asset goes to a preview sheet where the seeker writes an
  // optional caption and confirms before any upload happens.
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{
    uri: string;
    mime: string;
    width?: number;
    height?: number;
  } | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");

  const handleAttachPress = useCallback(() => {
    if (!session?.id || session.status === "ended") return;
    if (sendMutation.isPending || isAttaching) return;
    setVoiceError(null);
    setAttachSheetOpen(true);
  }, [isAttaching, sendMutation.isPending, session?.id, session?.status]);

  const pickPhoto = useCallback(
    async (source: "camera" | "library") => {
      setAttachSheetOpen(false);
      try {
        const perm =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setVoiceError(
            source === "camera"
              ? "Haven needs camera access to take a photo."
              : "Haven needs photo library access to share images.",
          );
          return;
        }
        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                quality: 0.85,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.85,
                allowsMultipleSelection: false,
              });
        if (result.canceled || result.assets.length === 0) return;
        const asset = result.assets[0];
        setPhotoCaption(input.trim());
        setPendingPhoto({
          uri: asset.uri,
          mime: asset.mimeType || "image/jpeg",
          width: asset.width,
          height: asset.height,
        });
      } catch (err) {
        setVoiceError(
          err instanceof Error
            ? err.message
            : "Couldn't open the photo picker.",
        );
      }
    },
    [input],
  );

  const cancelPhoto = useCallback(() => {
    setPendingPhoto(null);
    setPhotoCaption("");
  }, []);

  const confirmSendPhoto = useCallback(async () => {
    if (!pendingPhoto || !session?.id) return;
    if (isAttaching) return;
    setIsAttaching(true);
    try {
      const uploaded = await uploadAttachment({
        sessionId: session.id,
        kind: "image",
        uri: pendingPhoto.uri,
        mime: pendingPhoto.mime,
      });
      const caption = photoCaption.trim();
      setPendingPhoto(null);
      setPhotoCaption("");
      setInput("");
      sendMutation.mutate({ message: caption, attachments: [uploaded] });
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : "Couldn't share that photo.",
      );
    } finally {
      setIsAttaching(false);
    }
  }, [pendingPhoto, photoCaption, sendMutation, session?.id, isAttaching]);

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

  const audioInFlight =
    sendMutation.isPending &&
    !!sendMutation.variables?.attachments?.some((a) => a.kind === "audio");

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending || !session?.id) return;
    setInput("");
    sendMutation.mutate({ message: text });
  };

  // ---- Voice recording (hold-to-talk) --------------------------------------
  // Hard cap voice memos at 2 minutes — matches the spec and keeps
  // Whisper round-trips bounded. We snapshot the duration in a ref
  // because the auto-stop runs from a setInterval where state would be
  // stale, and trip an auto-stop the moment the recorder crosses the
  // limit.
  const VOICE_MEMO_MAX_MS = 120_000;
  const autoStopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!recorderState.isRecording) {
      if (autoStopTimerRef.current) {
        clearInterval(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      return;
    }
    if (autoStopTimerRef.current) return;
    autoStopTimerRef.current = setInterval(() => {
      const ms = recorder.getStatus?.()?.durationMillis ?? 0;
      if (ms >= VOICE_MEMO_MAX_MS && recordingActiveRef.current) {
        void finishRecordingRef.current?.(false);
      }
    }, 250);
    return () => {
      if (autoStopTimerRef.current) {
        clearInterval(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
    };
  }, [recorder, recorderState.isRecording]);

  // Forward ref to finishRecording so the auto-stop timer can call it
  // before finishRecording is declared.
  const finishRecordingRef = useRef<
    ((cancelled: boolean) => Promise<void>) | null
  >(null);

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

  const [pendingVoice, setPendingVoice] = useState<{
    uri: string;
    mime: string;
    durationS: number;
  } | null>(null);

  const finishRecording = useCallback(
    async (cancelled: boolean) => {
      // onPressOut may fire before recordingActiveRef flips on iOS first-
      // permission prompts; treat the recorder's own state as authoritative.
      const recorderIsLive =
        recorderState.isRecording || recorder.isRecording === true;
      if (!recordingActiveRef.current && !recorderIsLive) return;
      recordingActiveRef.current = false;
      const durationMs = recorderState.durationMillis ?? 0;
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
      const mime = uri.toLowerCase().endsWith(".m4a")
        ? "audio/m4a"
        : uri.toLowerCase().endsWith(".mp4")
          ? "audio/mp4"
          : uri.toLowerCase().endsWith(".webm")
            ? "audio/webm"
            : uri.toLowerCase().endsWith(".wav")
              ? "audio/wav"
              : "audio/m4a";
      setPendingVoice({
        uri,
        mime,
        durationS:
          durationMs > 0 ? Math.max(1, Math.round(durationMs / 1000)) : 0,
      });
    },
    [
      recorder,
      recorderState.durationMillis,
      recorderState.isRecording,
      session?.id,
    ],
  );

  const cancelPendingVoice = useCallback(() => {
    setPendingVoice(null);
  }, []);

  const sendPendingVoice = useCallback(async () => {
    if (!pendingVoice || !session?.id) return;
    const voice = pendingVoice;
    setPendingVoice(null);
    setIsTranscribing(true);
    try {
      const uploaded = await uploadAttachment({
        sessionId: session.id,
        kind: "audio",
        uri: voice.uri,
        mime: voice.mime,
        durationS: voice.durationS > 0 ? voice.durationS : undefined,
      });
      sendMutation.mutate({ attachments: [uploaded] });
    } catch (err) {
      setVoiceError(
        err instanceof Error
          ? err.message
          : "We couldn't send that recording. Please try again.",
      );
    } finally {
      setIsTranscribing(false);
    }
  }, [pendingVoice, sendMutation, session?.id]);
  useEffect(() => {
    finishRecordingRef.current = finishRecording;
  }, [finishRecording]);

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
    const latestAgent = [...sortedAsc]
      .reverse()
      .find((m) => m.role === "agent");
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
          <Feather name="message-circle" size={24} color={colors.primary} />
        </View>
        <Text
          style={[
            styles.emptyTitle,
            { color: colors.foreground, marginTop: 12 },
          ]}
        >
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
          <Text style={[styles.avatarText, { color: colors.primary }]}>
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
          <View style={[styles.statusPill, { backgroundColor: colors.muted }]}>
            <Text
              style={[styles.statusPillText, { color: colors.mutedForeground }]}
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
          <Text style={[styles.viewSummaryText, { color: colors.primary }]}>
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
            isTranscribing || audioInFlight ? (
              <View style={[styles.bubbleRow, { justifyContent: "flex-end" }]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: colors.primary,
                      borderColor: "transparent",
                      borderRadius: 18,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    },
                  ]}
                >
                  <ActivityIndicator
                    color={colors.primaryForeground}
                    size="small"
                  />
                  <Text
                    style={[
                      styles.bubbleText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Transcribing voice memo…
                  </Text>
                </View>
              </View>
            ) : sendMutation.isPending ? (
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
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Welcome to your safe space
                </Text>
                <Text
                  style={[styles.emptyBody, { color: colors.mutedForeground }]}
                >
                  Take your time. Share whatever feels right.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isSeeker = item.role === "seeker";
            const redactedAt = item.redactedAt ?? item.redacted_at ?? null;
            // Seeker view hides redacted messages entirely; the coach's
            // web transcript still renders a placeholder for the gap.
            if (redactedAt) return null;
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
                      style={[styles.miniAvatarText, { color: colors.primary }]}
                    >
                      {coachInitial}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onLongPress={
                    isSeeker
                      ? () => {
                          void Haptics.selectionAsync();
                          setRedactTarget(item);
                        }
                      : undefined
                  }
                  delayLongPress={350}
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isSeeker ? colors.primary : colors.card,
                      borderColor: isSeeker ? "transparent" : colors.border,
                      borderRadius: 18,
                    },
                  ]}
                  testID={`bubble-${item.role}-${item.id}`}
                >
                  {item.content ? (
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
                  ) : null}
                  {item.attachments?.map((att) => (
                    <AttachmentView
                      key={att.id}
                      att={att}
                      isSeeker={isSeeker}
                      bubbleColors={{
                        foreground: isSeeker
                          ? colors.primaryForeground
                          : colors.foreground,
                        muted: isSeeker
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                      }}
                    />
                  ))}
                </Pressable>
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
          <Pressable
            onPress={handleAttachPress}
            disabled={
              !session?.id ||
              session?.status === "ended" ||
              sendMutation.isPending ||
              isAttaching ||
              recorderState.isRecording ||
              isTranscribing
            }
            accessibilityLabel="Attach a photo"
            testID="chat-attach-photo"
            hitSlop={6}
            style={({ pressed }) => [
              styles.attachBtn,
              {
                backgroundColor: colors.gradientHeroMid,
                opacity:
                  !session?.id ||
                  session?.status === "ended" ||
                  sendMutation.isPending ||
                  recorderState.isRecording ||
                  isTranscribing
                    ? 0.4
                    : pressed || isAttaching
                      ? 0.7
                      : 1,
              },
            ]}
          >
            {isAttaching ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Feather name="paperclip" size={18} color={colors.primary} />
            )}
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={
              session?.status === "ended"
                ? "This session has ended"
                : recorderState.isRecording
                  ? "Listening…"
                  : isTranscribing
                    ? "Sending voice memo…"
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
        visible={attachSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachSheetOpen(false)}
      >
        <Pressable
          onPress={() => setAttachSheetOpen(false)}
          style={[
            styles.modalBackdrop,
            {
              backgroundColor: "rgba(20,16,12,0.55)",
              justifyContent: "flex-end",
              padding: 16,
            },
          ]}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              marginBottom: insets.bottom + 8,
            }}
          >
            <Pressable
              onPress={() => void pickPhoto("camera")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 16,
                paddingHorizontal: 18,
                opacity: pressed ? 0.6 : 1,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              })}
              testID="attach-camera"
            >
              <Feather name="camera" size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontFamily: "Inter_500Medium",
                }}
              >
                Take a photo
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void pickPhoto("library")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 16,
                paddingHorizontal: 18,
                opacity: pressed ? 0.6 : 1,
              })}
              testID="attach-library"
            >
              <Feather name="image" size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontFamily: "Inter_500Medium",
                }}
              >
                Choose from library
              </Text>
            </Pressable>
          </Pressable>
          <Pressable
            onPress={() => setAttachSheetOpen(false)}
            style={({ pressed }) => ({
              backgroundColor: colors.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: insets.bottom,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 15,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!pendingPhoto}
        transparent
        animationType="slide"
        onRequestClose={cancelPhoto}
      >
        <View
          style={[
            styles.summaryBackdrop,
            { backgroundColor: "rgba(20,16,12,0.75)" },
          ]}
        >
          <View
            style={[
              styles.summarySheet,
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View style={styles.summaryHeader}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.summaryTitle, { color: colors.foreground }]}
                >
                  Share this photo?
                </Text>
                <Text
                  style={[styles.summarySub, { color: colors.mutedForeground }]}
                >
                  Add a note for your coach if you'd like.
                </Text>
              </View>
              <Pressable
                onPress={cancelPhoto}
                hitSlop={10}
                style={[styles.summaryClose, { backgroundColor: colors.muted }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            {pendingPhoto ? (
              <ExpoImage
                source={{ uri: pendingPhoto.uri }}
                style={{
                  width: "100%",
                  aspectRatio:
                    pendingPhoto.width && pendingPhoto.height
                      ? pendingPhoto.width / pendingPhoto.height
                      : 1,
                  maxHeight: 360,
                  borderRadius: 16,
                  marginTop: 14,
                  backgroundColor: colors.muted,
                }}
                contentFit="contain"
              />
            ) : null}

            <TextInput
              value={photoCaption}
              onChangeText={setPhotoCaption}
              placeholder="Add a caption (optional)"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                  borderRadius: 14,
                  marginTop: 14,
                  minHeight: 60,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                },
              ]}
              testID="photo-caption-input"
            />

            <View style={[styles.modalActions, { marginTop: 14 }]}>
              <Pressable
                onPress={cancelPhoto}
                disabled={isAttaching}
                style={({ pressed }) => [
                  styles.modalBtnSecondary,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text
                  style={[styles.modalBtnText, { color: colors.foreground }]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmSendPhoto()}
                disabled={isAttaching}
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed || isAttaching ? 0.8 : 1,
                  },
                ]}
                testID="photo-confirm-send"
              >
                {isAttaching ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.modalBtnText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Send
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!pendingVoice}
        transparent
        animationType="fade"
        onRequestClose={cancelPendingVoice}
      >
        <Pressable
          onPress={cancelPendingVoice}
          style={[
            styles.modalBackdrop,
            { backgroundColor: "rgba(20,16,12,0.55)" },
          ]}
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
              <Feather name="mic" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Send this voice memo?
            </Text>
            {pendingVoice ? (
              <VoicePreviewPlayer
                uri={pendingVoice.uri}
                durationS={pendingVoice.durationS}
                color={colors.primary}
                tintBg={colors.gradientHeroMid}
                fg={colors.foreground}
                muted={colors.mutedForeground}
              />
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={cancelPendingVoice}
                style={({ pressed }) => [
                  styles.modalBtnSecondary,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
                testID="voice-cancel"
              >
                <Text
                  style={[styles.modalBtnText, { color: colors.foreground }]}
                >
                  Discard
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void sendPendingVoice()}
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                testID="voice-confirm-send"
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Send
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!redactTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRedactTarget(null)}
      >
        <Pressable
          onPress={() => setRedactTarget(null)}
          style={[
            styles.modalBackdrop,
            { backgroundColor: "rgba(20,16,12,0.55)" },
          ]}
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
              <Feather name="trash-2" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Forget this message?
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Your coach will only see a "redacted" placeholder, and any memory
              the twin formed from this message will be forgotten too. This
              can't be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setRedactTarget(null)}
                style={({ pressed }) => [
                  styles.modalBtnSecondary,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text
                  style={[styles.modalBtnText, { color: colors.foreground }]}
                >
                  Keep it
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (redactTarget) redactMutation.mutate(redactTarget.id);
                }}
                disabled={redactMutation.isPending}
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed || redactMutation.isPending ? 0.8 : 1,
                  },
                ]}
                testID="chat-confirm-redact"
              >
                {redactMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.modalBtnText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Forget
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={confirmEndOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmEndOpen(false)}
      >
        <Pressable
          onPress={() => setConfirmEndOpen(false)}
          style={[
            styles.modalBackdrop,
            { backgroundColor: "rgba(20,16,12,0.55)" },
          ]}
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
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
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
                  style={[styles.modalBtnText, { color: colors.foreground }]}
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
                    opacity: pressed || finishMutation.isPending ? 0.8 : 1,
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
          style={[
            styles.summaryBackdrop,
            { backgroundColor: "rgba(20,16,12,0.55)" },
          ]}
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
                  style={[styles.summarySub, { color: colors.mutedForeground }]}
                >
                  Saved to your shared record with your coach.
                </Text>
              </View>
              <Pressable
                onPress={() => setSummaryOpen(false)}
                hitSlop={10}
                accessibilityLabel="Close summary"
                style={[styles.summaryClose, { backgroundColor: colors.muted }]}
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

                  {(
                    activeSummary.keyInsights ??
                    activeSummary.key_insights ??
                    []
                  ).length > 0 ? (
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
                      {(
                        activeSummary.keyInsights ??
                        activeSummary.key_insights ??
                        []
                      ).map((k, i) => (
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

                  {(activeSummary.nextAction ?? activeSummary.next_action) ? (
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

                  {(activeSummary.assignedStage ??
                  activeSummary.assigned_stage) ? (
                    <View
                      style={[
                        styles.stagePill,
                        { backgroundColor: colors.gradientHeroMid },
                      ]}
                    >
                      <Feather
                        name="compass"
                        size={12}
                        color={colors.primary}
                      />
                      <Text
                        style={[styles.stageText, { color: colors.primary }]}
                      >
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
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
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
