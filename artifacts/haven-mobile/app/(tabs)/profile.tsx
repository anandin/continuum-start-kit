import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  biometricToggleSubtitle,
  openSystemSettingsForBiometrics,
  useBiometricLock,
} from "@/components/BiometricLock";
import { HavenLogo } from "@/components/HavenLogo";
import { useCrisis } from "@/components/Crisis";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import { getPushPreference, setPushPreference } from "@/lib/notifications";

interface NudgePrefs {
  enabled: boolean;
  windowStartHour: number;
  windowEndHour: number;
}

function formatHour(h: number): string {
  const suffix = h < 12 ? "am" : "pm";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${suffix}`;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const crisis = useCrisis();
  const biometric = useBiometricLock();
  const [signingOut, setSigningOut] = React.useState(false);
  const [togglingBiometric, setTogglingBiometric] = React.useState(false);

  const biometricUnavailable =
    biometric.support.kind !== "supported" &&
    biometric.support.kind !== "unknown";
  // Always allow turning the lock OFF, even if device support disappeared
  // (e.g. seeker removed Face ID enrollment) — otherwise an enabled pref
  // would be stuck on. Only turning ON requires working biometrics.
  const switchDisabled =
    biometric.isLoadingPref || (biometricUnavailable && !biometric.enabled);

  const handleToggleBiometric = async (next: boolean) => {
    if (next && biometricUnavailable) {
      if (biometric.support.kind === "not-enrolled") {
        openSystemSettingsForBiometrics();
      }
      return;
    }
    setTogglingBiometric(true);
    try {
      await biometric.setEnabled(next);
    } finally {
      setTogglingBiometric(false);
    }
  };

  const [notifEnabled, setNotifEnabled] = React.useState(false);
  const [notifLoading, setNotifLoading] = React.useState(true);
  const [notifSaving, setNotifSaving] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      setNotifLoading(false);
      return;
    }
    let cancelled = false;
    setNotifLoading(true);
    getPushPreference()
      .then((p) => {
        if (!cancelled) setNotifEnabled(p.enabled);
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const [nudgePrefs, setNudgePrefs] = React.useState<NudgePrefs | null>(null);
  const [nudgeLoading, setNudgeLoading] = React.useState(true);
  const [nudgeSaving, setNudgeSaving] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      setNudgeLoading(false);
      return;
    }
    let cancelled = false;
    setNudgeLoading(true);
    api<NudgePrefs>("/api/seeker/nudge-prefs")
      .then((p) => {
        if (!cancelled) setNudgePrefs(p);
      })
      .catch(() => {
        if (!cancelled) setNudgePrefs(null);
      })
      .finally(() => {
        if (!cancelled) setNudgeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveNudgePrefs = React.useCallback(
    async (patch: Partial<NudgePrefs>) => {
      if (!nudgePrefs || nudgeSaving) return;
      const prev = nudgePrefs;
      const next = { ...nudgePrefs, ...patch };
      setNudgePrefs(next);
      setNudgeSaving(true);
      try {
        const result = await api<NudgePrefs>("/api/seeker/nudge-prefs", {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setNudgePrefs(result);
      } catch {
        setNudgePrefs(prev);
      } finally {
        setNudgeSaving(false);
      }
    },
    [nudgePrefs, nudgeSaving],
  );

  const cycleNudgeWindow = React.useCallback(() => {
    if (!nudgePrefs) return;
    // Simple 4-preset rotation: morning(7-11), midday(11-14),
    // evening(17-21), night(21-23).
    const presets: Array<[number, number]> = [
      [7, 11],
      [11, 14],
      [17, 21],
      [21, 23],
    ];
    const currentIdx = presets.findIndex(
      ([s, e]) =>
        s === nudgePrefs.windowStartHour && e === nudgePrefs.windowEndHour,
    );
    const next = presets[(currentIdx + 1) % presets.length];
    void saveNudgePrefs({ windowStartHour: next[0], windowEndHour: next[1] });
  }, [nudgePrefs, saveNudgePrefs]);

  const handleNotifToggle = React.useCallback(
    async (next: boolean) => {
      if (notifSaving) return;
      const prev = notifEnabled;
      setNotifEnabled(next);
      setNotifSaving(true);
      try {
        const result = await setPushPreference(next);
        setNotifEnabled(result.enabled);
      } catch {
        setNotifEnabled(prev);
      } finally {
        setNotifSaving(false);
      }
    },
    [notifEnabled, notifSaving],
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/auth");
    } finally {
      setSigningOut(false);
    }
  };

  const initial = user?.email?.charAt(0).toUpperCase() ?? "H";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + 140,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <HavenLogo size={24} />
        </View>

        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              shadowColor: "#7A5A3C",
            },
          ]}
        >
          <View style={[styles.bigAvatar, { backgroundColor: colors.primary }]}>
            <Text
              style={[
                styles.bigAvatarText,
                { color: colors.primaryForeground },
              ]}
            >
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.name, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {user?.email ?? "Welcome"}
            </Text>
            <Text style={[styles.role, { color: colors.mutedForeground }]}>
              Seeker
            </Text>
          </View>
        </View>

        <View style={styles.sectionLabel}>
          <Text
            style={[styles.sectionLabelText, { color: colors.mutedForeground }]}
          >
            PRIVACY
          </Text>
        </View>

        <View
          style={[
            styles.toggleRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: biometric.isLoadingPref ? 0.6 : 1,
            },
          ]}
          testID="profile-biometric-row"
        >
          <View
            style={[
              styles.rowIcon,
              {
                backgroundColor: biometricUnavailable
                  ? colors.muted
                  : colors.gradientHeroMid,
              },
            ]}
          >
            <Feather
              name="lock"
              size={16}
              color={
                biometricUnavailable ? colors.mutedForeground : colors.primary
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              App lock
            </Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              {biometricToggleSubtitle({
                support: biometric.support,
                enabled: biometric.enabled,
              })}
            </Text>
            {biometric.support.kind === "not-enrolled" ? (
              <Pressable
                onPress={openSystemSettingsForBiometrics}
                accessibilityLabel="Open device settings"
                testID="profile-biometric-settings"
                style={({ pressed }) => [
                  styles.inlineLink,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text
                  style={[styles.inlineLinkText, { color: colors.primary }]}
                >
                  Open device settings
                </Text>
              </Pressable>
            ) : null}
          </View>
          {togglingBiometric ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Switch
              value={biometric.enabled}
              onValueChange={handleToggleBiometric}
              disabled={switchDisabled}
              accessibilityLabel="Require biometric to open Haven"
              testID="profile-biometric-toggle"
            />
          )}
        </View>

        <View style={styles.sectionLabel}>
          <Text
            style={[styles.sectionLabelText, { color: colors.mutedForeground }]}
          >
            SAFETY
          </Text>
        </View>

        <Row
          icon="life-buoy"
          label="Open crisis support"
          colors={colors}
          tone="crisis"
          onPress={crisis.open}
          testID="profile-open-crisis"
        />

        <View style={styles.sectionLabel}>
          <Text
            style={[styles.sectionLabelText, { color: colors.mutedForeground }]}
          >
            ACCOUNT
          </Text>
        </View>

        <Row
          icon="sliders"
          label="Manage account on the web"
          colors={colors}
          onPress={() =>
            Linking.openURL(
              process.env.EXPO_PUBLIC_DOMAIN
                ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/`
                : "https://replit.com/",
            )
          }
        />
        <Row
          icon="credit-card"
          label="Payment & tier"
          colors={colors}
          onPress={() =>
            Linking.openURL(
              process.env.EXPO_PUBLIC_DOMAIN
                ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/payment`
                : "https://replit.com/",
            )
          }
          testID="profile-open-payment"
        />
        <Row
          icon="cpu"
          label="Manage memory"
          colors={colors}
          onPress={() =>
            Linking.openURL(
              process.env.EXPO_PUBLIC_DOMAIN
                ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/memory`
                : "https://replit.com/",
            )
          }
          testID="profile-open-memory"
        />
        <ToggleRow
          icon="sun"
          label="Daily nudges"
          subtitle={
            nudgeLoading
              ? "Loading…"
              : nudgePrefs?.enabled
                ? `On — one prompt between ${formatHour(nudgePrefs.windowStartHour)} and ${formatHour(nudgePrefs.windowEndHour)}`
                : "Off — no between-session prompts"
          }
          colors={colors}
          value={nudgePrefs?.enabled ?? false}
          onValueChange={(next) => saveNudgePrefs({ enabled: next })}
          disabled={nudgeLoading || nudgeSaving || !nudgePrefs}
          testID="profile-toggle-nudges"
        />
        {nudgePrefs?.enabled ? (
          <Row
            icon="clock"
            label="Nudge time window"
            subtitle={`${formatHour(nudgePrefs.windowStartHour)} – ${formatHour(nudgePrefs.windowEndHour)} · tap to change`}
            colors={colors}
            onPress={cycleNudgeWindow}
            disabled={nudgeSaving}
            testID="profile-nudge-window"
          />
        ) : null}

        <ToggleRow
          icon="bell"
          label="Push notifications"
          subtitle={
            notifLoading
              ? "Loading…"
              : notifEnabled
                ? "On — coach replies & check-ins"
                : Platform.OS === "web"
                  ? "Push not supported on web preview"
                  : "Off — turn on to get coach updates"
          }
          colors={colors}
          value={notifEnabled}
          onValueChange={handleNotifToggle}
          disabled={notifLoading || notifSaving || Platform.OS === "web"}
          testID="profile-toggle-notifications"
        />

        <View style={styles.sectionLabel}>
          <Text
            style={[styles.sectionLabelText, { color: colors.mutedForeground }]}
          >
            ABOUT
          </Text>
        </View>

        <View
          style={[
            styles.aboutCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text style={[styles.aboutTitle, { color: colors.foreground }]}>
            Haven is your safe space
          </Text>
          <Text style={[styles.aboutBody, { color: colors.mutedForeground }]}>
            Conversations are guided by your coach's AI twin, with safety checks
            on every message. You're not alone in this — help is one tap away on
            every screen.
          </Text>
          <Text style={[styles.versionText, { color: colors.mutedForeground }]}>
            Haven Mobile · v1.0.0
            {Platform.OS === "web" ? " (web preview)" : ""}
          </Text>
        </View>

        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          accessibilityLabel="Sign out"
          testID="profile-sign-out"
          style={({ pressed }) => [
            styles.signOutBtn,
            {
              backgroundColor: colors.crisisSoft,
              borderColor: colors.border,
              borderRadius: 999,
              opacity: signingOut || pressed ? 0.7 : 1,
            },
          ]}
        >
          {signingOut ? (
            <ActivityIndicator color={colors.crisis} />
          ) : (
            <>
              <Feather name="log-out" size={16} color={colors.crisis} />
              <Text style={[styles.signOutLabel, { color: colors.crisis }]}>
                Sign out
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

interface RowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
  colors: ReturnType<typeof useColors>;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "default" | "crisis";
  testID?: string;
}

interface ToggleRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
  colors: ReturnType<typeof useColors>;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

function ToggleRow({
  icon,
  label,
  subtitle,
  colors,
  value,
  onValueChange,
  disabled,
  testID,
}: ToggleRowProps) {
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: disabled ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[styles.rowIcon, { backgroundColor: colors.gradientHeroMid }]}
      >
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        testID={testID}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={Platform.OS === "android" ? colors.card : undefined}
      />
    </View>
  );
}

function Row({
  icon,
  label,
  subtitle,
  colors,
  onPress,
  disabled,
  tone = "default",
  testID,
}: RowProps) {
  const iconColor = tone === "crisis" ? colors.crisis : colors.primary;
  const iconBg = tone === "crisis" ? colors.crisisSoft : colors.gradientHeroMid;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {!disabled && onPress ? (
        <Feather
          name="chevron-right"
          size={18}
          color={colors.mutedForeground}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderWidth: 1,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bigAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  bigAvatarText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  name: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  role: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sectionLabel: {
    paddingHorizontal: 4,
    marginTop: 6,
  },
  sectionLabelText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  rowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 17,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  inlineLink: {
    marginTop: 6,
    alignSelf: "flex-start",
  },
  inlineLinkText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  aboutCard: {
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  aboutTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  aboutBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  versionText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  signOutLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
