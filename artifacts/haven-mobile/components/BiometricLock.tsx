import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCrisis } from "@/components/Crisis";
import { HavenLogo } from "@/components/HavenLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const PREF_KEY = "haven.biometric.enabled";
const RELOCK_AFTER_MS = 60_000;

export type BiometricSupport =
  | { kind: "supported"; types: LocalAuthentication.AuthenticationType[] }
  | { kind: "not-enrolled" }
  | { kind: "no-hardware" }
  | { kind: "web" }
  | { kind: "unknown" };

interface BiometricLockCtx {
  enabled: boolean;
  support: BiometricSupport;
  setEnabled: (next: boolean) => Promise<void>;
  isLoadingPref: boolean;
}

const BiometricLockContext = createContext<BiometricLockCtx | undefined>(
  undefined,
);

export function useBiometricLock(): BiometricLockCtx {
  const ctx = useContext(BiometricLockContext);
  if (!ctx) throw new Error("useBiometricLock must be inside <BiometricLockProvider>");
  return ctx;
}

async function detectSupport(): Promise<BiometricSupport> {
  if (Platform.OS === "web") return { kind: "web" };
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { kind: "no-hardware" };
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return { kind: "not-enrolled" };
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return { kind: "supported", types };
  } catch {
    return { kind: "unknown" };
  }
}

export function describeBiometric(support: BiometricSupport): string {
  if (support.kind !== "supported") return "biometrics";
  const t = support.types;
  if (t.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Face ID" : "face unlock";
  }
  if (t.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios" ? "Touch ID" : "fingerprint";
  }
  if (t.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "iris unlock";
  }
  return "device passcode";
}

export function BiometricLockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [enabled, setEnabledState] = useState(false);
  const [isLoadingPref, setIsLoadingPref] = useState(true);
  const [support, setSupport] = useState<BiometricSupport>({ kind: "unknown" });
  // `locked` triggers the real LockScreen (with biometric auto-prompt). It's
  // set on cold-launch and on return-to-active after the grace window.
  const [locked, setLocked] = useState<boolean>(true);
  // `veiled` is a lightweight privacy curtain shown while the app is
  // inactive/background. It hides app content from the iOS app-switcher
  // snapshot WITHOUT triggering a biometric prompt, so brief
  // backgrounding (notification banner, control center) is friction-free.
  const [veiled, setVeiled] = useState<boolean>(false);
  const lastBackgroundedAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Load saved preference + capability check on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stored, sup] = await Promise.all([
          SecureStore.getItemAsync(PREF_KEY).catch(() => null),
          detectSupport(),
        ]);
        if (cancelled) return;
        const isOn = stored === "1";
        setEnabledState(isOn);
        setSupport(sup);
        // Only show the lock screen if the pref is on AND we can actually authenticate.
        setLocked(isOn && sup.kind === "supported");
      } finally {
        if (!cancelled) setIsLoadingPref(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // AppState background tracking.
  //  1) Leaving active (active -> inactive/background): drop the privacy
  //     veil over the UI so the iOS app-switcher snapshot doesn't expose
  //     tab content. We deliberately do NOT set `locked` here — that would
  //     re-prompt biometrics on every brief background trip.
  //  2) Returning to active: only escalate to the real lock screen when the
  //     background duration met the RELOCK_AFTER_MS threshold. Always lift
  //     the veil so the user sees either their content or the lock screen.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;

      if (prev === "active" && next !== "active") {
        lastBackgroundedAt.current = Date.now();
        if (enabled && support.kind === "supported") {
          setVeiled(true);
        }
        return;
      }
      if (next === "active" && prev !== "active") {
        const since = lastBackgroundedAt.current;
        lastBackgroundedAt.current = null;
        if (enabled && support.kind === "supported") {
          if (since && Date.now() - since >= RELOCK_AFTER_MS) {
            setLocked(true);
          }
        }
        setVeiled(false);
      }
    });
    return () => sub.remove();
  }, [enabled, support.kind]);

  // If user signs out, drop the lock so the auth screen is reachable.
  useEffect(() => {
    if (!user) {
      setLocked(false);
      setVeiled(false);
    }
  }, [user]);

  const setEnabled = useCallback(async (next: boolean) => {
    if (next) {
      // Confirm capability before flipping it on.
      const sup = await detectSupport();
      setSupport(sup);
      if (sup.kind !== "supported") {
        // Caller (Profile screen) renders an explanatory message; we just no-op.
        return;
      }
      // Require an immediate auth so we know it works on this device.
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm to enable app lock",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (!result.success) return;
      await SecureStore.setItemAsync(PREF_KEY, "1");
      setEnabledState(true);
      // Don't lock right now — they just authenticated.
      setLocked(false);
    } else {
      // Require auth to disable too, so a thief who grabs an unlocked phone
      // can't toggle it off without biometrics. If support is gone (e.g. user
      // disabled biometrics in settings), allow the disable to proceed.
      const sup = await detectSupport();
      setSupport(sup);
      if (sup.kind === "supported") {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirm to turn off app lock",
          cancelLabel: "Cancel",
          disableDeviceFallback: false,
        });
        if (!result.success) return;
      }
      await SecureStore.deleteItemAsync(PREF_KEY);
      setEnabledState(false);
      setLocked(false);
    }
  }, []);

  const value = useMemo<BiometricLockCtx>(
    () => ({ enabled, support, setEnabled, isLoadingPref }),
    [enabled, support, setEnabled, isLoadingPref],
  );

  // Don't render the lock overlay until we know the pref AND user state is settled.
  // While we're loading the preference on a cold-launch, a user that ends up with
  // pref-on would briefly see the app — so block the children behind a neutral
  // splash-like view too.
  const isProtected =
    enabled && support.kind === "supported" && !!user;
  const shouldShowLock = locked && isProtected;
  const shouldShowVeil = veiled && isProtected && !shouldShowLock;
  const shouldShowGate = isLoadingPref;

  return (
    <BiometricLockContext.Provider value={value}>
      {children}
      {shouldShowGate ? <LoadingGate /> : null}
      {shouldShowVeil ? <PrivacyVeil /> : null}
      {shouldShowLock ? (
        <LockScreen
          support={support}
          onUnlock={() => setLocked(false)}
        />
      ) : null}
    </BiometricLockContext.Provider>
  );
}

function PrivacyVeil() {
  const colors = useColors();
  return (
    <View
      pointerEvents="auto"
      style={[
        StyleSheet.absoluteFillObject,
        styles.veil,
        { backgroundColor: colors.background },
      ]}
      testID="biometric-privacy-veil"
    >
      <HavenLogo size={48} />
    </View>
  );
}

function LoadingGate() {
  const colors = useColors();
  return (
    <View
      pointerEvents="auto"
      style={[
        StyleSheet.absoluteFillObject,
        styles.gate,
        { backgroundColor: colors.background },
      ]}
      testID="biometric-loading-gate"
    >
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

interface LockScreenProps {
  support: BiometricSupport;
  onUnlock: () => void;
}

function LockScreen({ support, onUnlock }: LockScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const crisis = useCrisis();
  const [authState, setAuthState] = useState<
    "idle" | "prompting" | "failed" | "cancelled"
  >("idle");
  const triedOnceRef = useRef(false);

  const label = describeBiometric(support);

  const tryAuth = useCallback(async () => {
    if (authState === "prompting") return;
    setAuthState("prompting");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock Haven with ${label}`,
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setAuthState("idle");
        onUnlock();
      } else if (
        "error" in result &&
        (result.error === "user_cancel" || result.error === "system_cancel" ||
          result.error === "app_cancel")
      ) {
        setAuthState("cancelled");
      } else {
        setAuthState("failed");
      }
    } catch {
      setAuthState("failed");
    }
  }, [authState, label, onUnlock]);

  // Auto-prompt once when the app is actually active and visible. We avoid
  // prompting while the app is inactive/background — the OS would refuse the
  // prompt and we'd land in a misleading "failed" state on resume.
  useEffect(() => {
    const maybePrompt = (state: AppStateStatus) => {
      if (triedOnceRef.current) return;
      if (state !== "active") return;
      triedOnceRef.current = true;
      tryAuth();
    };
    maybePrompt(AppState.currentState);
    const sub = AppState.addEventListener("change", maybePrompt);
    return () => sub.remove();
  }, [tryAuth]);

  const helper =
    authState === "failed"
      ? `Couldn't verify with ${label}. Tap Try again, or use your device passcode.`
      : authState === "cancelled"
        ? "Cancelled. Tap Try again when you're ready."
        : `Use ${label} to continue. Crisis support stays available below.`;

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        styles.lockRoot,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      testID="biometric-lock-screen"
    >
      <View style={styles.lockContent}>
        <HavenLogo size={48} />
        <View style={styles.lockTextBlock}>
          <Text style={[styles.lockTitle, { color: colors.foreground }]}>
            Haven is locked
          </Text>
          <Text style={[styles.lockHelp, { color: colors.mutedForeground }]}>
            {helper}
          </Text>
        </View>

        <Pressable
          onPress={tryAuth}
          disabled={authState === "prompting"}
          accessibilityLabel={`Unlock with ${label}`}
          testID="biometric-unlock-button"
          style={({ pressed }) => [
            styles.unlockBtn,
            {
              backgroundColor: colors.primary,
              opacity: authState === "prompting" || pressed ? 0.85 : 1,
              borderRadius: 999,
            },
          ]}
        >
          {authState === "prompting" ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather
                name="unlock"
                size={16}
                color={colors.primaryForeground}
              />
              <Text
                style={[
                  styles.unlockBtnText,
                  { color: colors.primaryForeground },
                ]}
              >
                {authState === "idle" ? `Unlock with ${label}` : "Try again"}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={crisis.open}
        accessibilityLabel="Open crisis support"
        testID="biometric-lock-crisis"
        style={({ pressed }) => [
          styles.crisisBtn,
          {
            backgroundColor: colors.crisisSoft,
            borderColor: colors.crisis,
            borderRadius: 999,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="life-buoy" size={16} color={colors.crisis} />
        <Text style={[styles.crisisBtnText, { color: colors.crisis }]}>
          Open crisis support
        </Text>
      </Pressable>
    </View>
  );
}

export function biometricToggleSubtitle({
  support,
  enabled,
}: {
  support: BiometricSupport;
  enabled: boolean;
}): string {
  if (support.kind === "web") {
    return "Available on the iOS and Android apps.";
  }
  if (support.kind === "no-hardware") {
    return "This device doesn't support biometric unlock.";
  }
  if (support.kind === "not-enrolled") {
    return "Add Face ID, Touch ID, or a passcode in your device settings first.";
  }
  if (support.kind === "unknown") {
    return "Checking device support…";
  }
  return enabled
    ? `Locked with ${describeBiometric(support)} after 60 seconds in the background.`
    : `Use ${describeBiometric(support)} to keep your reflections private.`;
}

export function openSystemSettingsForBiometrics(): void {
  if (Platform.OS === "ios") {
    Linking.openURL("app-settings:").catch(() => {});
  } else {
    Linking.openSettings().catch(() => {});
  }
}

const styles = StyleSheet.create({
  gate: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9998,
  },
  veil: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9991,
  },
  lockRoot: {
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 9990,
  },
  lockContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  lockTextBlock: {
    alignItems: "center",
    gap: 8,
    maxWidth: 320,
  },
  lockTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  lockHelp: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 26,
    minWidth: 220,
  },
  unlockBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  crisisBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderWidth: 1,
  },
  crisisBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
