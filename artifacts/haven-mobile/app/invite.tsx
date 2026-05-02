import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { HavenLogo } from "@/components/HavenLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

interface Engagement {
  id: string;
  providerId?: string;
  status?: string;
}

interface ProviderConfig {
  providerId: string;
  title?: string;
}

export default function InviteScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const params = useLocalSearchParams<{ provider?: string; coach?: string }>();
  const providerId = params.provider ?? params.coach ?? "";
  const acceptedRef = useRef(false);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!providerId) throw new Error("This invitation link is missing a coach.");
      const existing = await api<Engagement[]>("/api/engagements");
      const already = existing.find(
        (e) => e.providerId === providerId && (e.status ?? "active") === "active",
      );
      if (already) return { engagement: already, alreadyMember: true };
      const engagement = await api<Engagement>("/api/engagements", {
        method: "POST",
        body: JSON.stringify({ providerId }),
      });
      return { engagement, alreadyMember: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
    },
  });

  const previewQ = useMutation({
    mutationFn: async () => {
      const configs = await api<ProviderConfig[]>("/api/provider-configs");
      return configs.find((c) => c.providerId === providerId) ?? null;
    },
  });

  useEffect(() => {
    if (providerId && !previewQ.data && !previewQ.isPending) {
      previewQ.mutate();
    }
  }, [providerId, previewQ]);

  if (loading) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    const next = providerId
      ? `/invite?provider=${encodeURIComponent(providerId)}`
      : "/invite";
    return <Redirect href={`/auth?next=${encodeURIComponent(next)}`} />;
  }

  if (!providerId) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}
      >
        <Stack.Screen options={{ title: "Invitation" }} />
        <HavenLogo size={56} />
        <Text style={[styles.title, { color: colors.foreground, marginTop: 16 }]}>
          Invitation link is incomplete
        </Text>
        <Text
          style={[styles.body, { color: colors.mutedForeground, marginTop: 8 }]}
        >
          Please ask your coach to send you a fresh link.
        </Text>
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
            Go to home
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleAccept = () => {
    if (acceptedRef.current || acceptMutation.isPending) return;
    acceptedRef.current = true;
    acceptMutation.mutate(undefined, {
      onSuccess: () => {
        setTimeout(() => router.replace("/(tabs)/chat"), 600);
      },
      onError: () => {
        acceptedRef.current = false;
      },
    });
  };

  const coachName = previewQ.data?.title ?? "your coach";

  if (acceptMutation.isSuccess) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.gradientHeroMid },
          ]}
        >
          <Feather name="check" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground, marginTop: 16 }]}>
          You're connected
        </Text>
        <Text
          style={[styles.body, { color: colors.mutedForeground, marginTop: 8 }]}
        >
          Taking you to your chat with {coachName}…
        </Text>
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: 20 }}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}
    >
      <Stack.Screen options={{ title: "Coach Invitation" }} />
      <HavenLogo size={64} />
      <Text style={[styles.title, { color: colors.foreground, marginTop: 20 }]}>
        Connect with {coachName}
      </Text>
      <Text
        style={[styles.body, { color: colors.mutedForeground, marginTop: 10 }]}
      >
        You've been invited to start a coaching engagement. Tap accept to begin
        chatting between sessions.
      </Text>

      {acceptMutation.isError ? (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: colors.muted, borderColor: colors.destructive },
          ]}
        >
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {(acceptMutation.error as Error)?.message ??
              "Couldn't accept the invitation. Try again?"}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleAccept}
        disabled={acceptMutation.isPending}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: colors.primary,
            opacity: pressed || acceptMutation.isPending ? 0.7 : 1,
            marginTop: 28,
          },
        ]}
      >
        {acceptMutation.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
            Accept invitation
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.replace("/(tabs)")}
        style={({ pressed }) => [
          styles.linkBtn,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
          Not now
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    minWidth: 220,
    alignItems: "center",
  },
  btnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  linkBtn: {
    marginTop: 16,
    padding: 12,
  },
  linkText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  errorBox: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 320,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
