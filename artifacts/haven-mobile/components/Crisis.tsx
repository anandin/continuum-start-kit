import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

interface CrisisCtx {
  open: () => void;
  close: () => void;
}

const CrisisContext = createContext<CrisisCtx | undefined>(undefined);

export function useCrisis() {
  const ctx = useContext(CrisisContext);
  if (!ctx) throw new Error("useCrisis must be inside <CrisisProvider>");
  return ctx;
}

interface Engagement {
  id: string;
  status?: string;
  providerId?: string;
  provider?: { email?: string };
}

const CRISIS_TEMPLATE =
  "I'm reaching out from Haven. I need to talk as soon as you can. (Sent from the Haven crisis sheet.)";

// Look up the active coach's email so we can hand off to the device's
// native mail composer. NOTE: this is a plain GET — no LLM, no chat
// pipeline, no /api/chat. The crisis sheet content itself is fully
// client-side templated.
async function lookupCoachEmail(): Promise<string | null> {
  try {
    const engagements = await api<Engagement[]>("/api/engagements");
    const active =
      engagements.find((e) => (e.status ?? "active") === "active") ??
      engagements[0];
    return active?.provider?.email ?? null;
  } catch {
    return null;
  }
}

async function emailCoach(): Promise<{ ok: boolean; message: string }> {
  const email = await lookupCoachEmail();
  if (!email) {
    return {
      ok: false,
      message:
        "No coach email on file yet. Please use a hotline above for immediate help.",
    };
  }
  const subject = encodeURIComponent("Urgent — reaching out from Haven");
  const body = encodeURIComponent(CRISIS_TEMPLATE);
  const url = `mailto:${email}?subject=${subject}&body=${body}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      return {
        ok: false,
        message:
          "Couldn't open your mail app. Please use a hotline above for immediate help.",
      };
    }
    await Linking.openURL(url);
    return {
      ok: true,
      message:
        "Opening your mail app — your coach will see your note when they next check in.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Couldn't open your mail app. Please use a hotline above for immediate help.",
    };
  }
}

export function CrisisProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
    }
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <CrisisContext.Provider value={value}>
      {children}
      <CrisisFAB onPress={open} />
      <CrisisSheet visible={visible} onClose={close} />
    </CrisisContext.Provider>
  );
}

function CrisisFAB({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottom =
    Math.max(insets.bottom, 12) + (Platform.OS === "ios" ? 78 : 70);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Open crisis support"
      accessibilityRole="button"
      testID="crisis-fab"
      style={({ pressed }) => [
        styles.fab,
        {
          bottom,
          backgroundColor: colors.crisis,
          shadowColor: "#7A1F12",
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Feather name="life-buoy" size={22} color="#FFFFFF" />
      <Text style={styles.fabLabel}>Help</Text>
    </Pressable>
  );
}

interface Hotline {
  region: string;
  name: string;
  phone?: string;
  text?: string;
  description: string;
}

const HOTLINES: Hotline[] = [
  {
    region: "US",
    name: "988 Suicide & Crisis Lifeline",
    phone: "988",
    text: "988",
    description: "24/7 free, confidential support — call or text 988.",
  },
  {
    region: "US",
    name: "Crisis Text Line",
    text: "741741",
    description: "Text HOME to 741741 from anywhere in the US.",
  },
  {
    region: "UK & ROI",
    name: "Samaritans",
    phone: "116123",
    description: "Free 24/7 listening line — UK & Republic of Ireland.",
  },
];

function CrisisSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<{
    kind: "idle" | "sending" | "sent" | "error";
    message?: string;
  }>({ kind: "idle" });

  const dial = (num: string) => {
    Linking.openURL(`tel:${num}`).catch(() => {});
  };
  const sms = (num: string) => {
    Linking.openURL(
      Platform.OS === "ios" ? `sms:&addresses=${num}` : `sms:${num}`,
    ).catch(() => {});
  };

  const messageCoach = async () => {
    setStatus({ kind: "sending" });
    const result = await emailCoach();
    setStatus({ kind: result.ok ? "sent" : "error", message: result.message });
  };

  const handleClose = () => {
    setStatus({ kind: "idle" });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.muted }]} />
        <View style={styles.headerRow}>
          <View
            style={[styles.crisisBadge, { backgroundColor: colors.crisisSoft }]}
          >
            <Feather name="life-buoy" size={20} color={colors.crisis} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              You are not alone
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              If you're in crisis, please reach out now. Real people are ready
              to listen.
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityLabel="Close crisis sheet"
            testID="crisis-sheet-close"
          >
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView
          style={{ marginTop: 8 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {HOTLINES.map((line) => (
            <View
              key={line.name}
              style={[
                styles.lineCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: 16,
                },
              ]}
            >
              <View style={styles.lineHeader}>
                <Text
                  style={[styles.lineRegion, { color: colors.mutedForeground }]}
                >
                  {line.region}
                </Text>
                <Text style={[styles.lineName, { color: colors.foreground }]}>
                  {line.name}
                </Text>
                <Text
                  style={[styles.lineDesc, { color: colors.mutedForeground }]}
                >
                  {line.description}
                </Text>
              </View>
              <View style={styles.lineActions}>
                {line.phone ? (
                  <Pressable
                    onPress={() => dial(line.phone!)}
                    accessibilityLabel={`Call ${line.name}`}
                    testID={`crisis-call-${line.region}`}
                    style={({ pressed }) => [
                      styles.lineBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather name="phone" size={16} color="#FFFFFF" />
                    <Text style={styles.lineBtnText}>Call {line.phone}</Text>
                  </Pressable>
                ) : null}
                {line.text ? (
                  <Pressable
                    onPress={() => sms(line.text!)}
                    accessibilityLabel={`Text ${line.name}`}
                    testID={`crisis-text-${line.region}`}
                    style={({ pressed }) => [
                      styles.lineBtn,
                      styles.lineBtnGhost,
                      {
                        borderColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name="message-circle"
                      size={16}
                      color={colors.primary}
                    />
                    <Text
                      style={[styles.lineBtnText, { color: colors.primary }]}
                    >
                      Text {line.text}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}

          <View
            style={[
              styles.coachCard,
              {
                backgroundColor: colors.gradientHeroMid,
                borderColor: colors.border,
                borderRadius: 16,
              },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.lineName, { color: colors.foreground }]}>
                Email my coach
              </Text>
              <Text
                style={[styles.lineDesc, { color: colors.mutedForeground }]}
              >
                Open your mail app with a pre-written note to your coach. For an
                emergency, please use a hotline above first.
              </Text>
              {status.kind === "sent" ? (
                <Text style={[styles.statusText, { color: colors.success }]}>
                  {status.message}
                </Text>
              ) : null}
              {status.kind === "error" ? (
                <Text style={[styles.statusText, { color: colors.crisis }]}>
                  {status.message}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={messageCoach}
              disabled={status.kind === "sending"}
              accessibilityLabel="Message my coach"
              testID="crisis-message-coach"
              style={({ pressed }) => [
                styles.coachBtn,
                {
                  backgroundColor: colors.accent,
                  opacity: status.kind === "sending" || pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="send" size={16} color={colors.accentForeground} />
              <Text
                style={[
                  styles.coachBtnText,
                  { color: colors.accentForeground },
                ]}
              >
                {status.kind === "sending" ? "Sending…" : "Notify"}
              </Text>
            </Pressable>
          </View>

          <Text
            style={[
              styles.safetyNote,
              { color: colors.mutedForeground, marginTop: 16 },
            ]}
          >
            Haven is not an emergency service. If you or someone else is in
            immediate danger, call your local emergency number.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 9999,
  },
  fabLabel: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 16, 12, 0.45)",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 14,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  crisisBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  lineCard: {
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
    gap: 10,
  },
  lineHeader: {
    gap: 4,
  },
  lineRegion: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  lineName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  lineDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  lineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  lineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  lineBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  lineBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  coachCard: {
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coachBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  coachBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  safetyNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
