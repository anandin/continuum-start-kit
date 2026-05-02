import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HavenLogo } from "@/components/HavenLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("seeker@haven.test");
  const [password, setPassword] = useState("test1234");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)");
    }
  }, [loading, user, router]);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
      router.replace("/(tabs)");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={[
        colors.gradientHeroStart,
        colors.gradientHeroMid,
        colors.gradientHeroEnd,
      ]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <HavenLogo size={32} />
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius * 1.25,
                shadowColor: "#7A5A3C",
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Feather name="heart" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                A safe space for your growth journey
              </Text>
              <Text
                style={[styles.cardSubtitle, { color: colors.mutedForeground }]}
              >
                {mode === "signin"
                  ? "Welcome back. We're glad you're here."
                  : "Take the first step. Creating an account is quick."}
              </Text>
            </View>

            <View style={[styles.tabs, { borderColor: colors.border }]}>
              {(["signin", "signup"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor:
                        mode === m ? colors.primary : "transparent",
                    },
                  ]}
                  testID={`auth-tab-${m}`}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color:
                          mode === m ? colors.primaryForeground : colors.mutedForeground,
                      },
                    ]}
                  >
                    {m === "signin" ? "Welcome Back" : "Get Started"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                    borderRadius: 12,
                  },
                ]}
                testID="auth-email"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                    borderRadius: 12,
                  },
                ]}
                testID="auth-password"
              />
            </View>

            {error ? (
              <Text style={[styles.errorText, { color: colors.crisis }]}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [
                styles.submit,
                {
                  backgroundColor: colors.primary,
                  opacity: busy || pressed ? 0.85 : 1,
                  borderRadius: 999,
                },
              ]}
              testID="auth-submit"
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text
                  style={[
                    styles.submitLabel,
                    { color: colors.primaryForeground },
                  ]}
                >
                  {mode === "signin" ? "Sign In" : "Create My Account"}
                </Text>
              )}
            </Pressable>

            <View style={styles.privacy}>
              <Feather name="shield" size={12} color={colors.mutedForeground} />
              <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
                Your privacy and safety are our priority
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 22,
    gap: 24,
  },
  brandRow: {
    alignItems: "center",
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    padding: 22,
    gap: 18,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardHeader: {
    alignItems: "center",
    gap: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 999,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  submit: {
    paddingVertical: 14,
    alignItems: "center",
  },
  submitLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  privacyText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
