import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";

import { Notifications } from "@/lib/notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CrisisProvider } from "@/components/Crisis";
import { BiometricLockProvider } from "@/components/BiometricLock";
import { AuthProvider } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function NotificationDeepLinkHandler() {
  // Route the seeker to chat when they tap a coach reply / check-in
  // notification. We honor explicit `data.path` overrides if the server
  // ever sends them, otherwise default to the chat tab.
  useEffect(() => {
    const handle = (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      const explicit = typeof data.path === "string" ? (data.path as string) : null;
      const type = typeof data.type === "string" ? (data.type as string) : null;
      try {
        if (explicit) {
          router.push(explicit as never);
          return;
        }
        if (type === "coach_message" || type === "coach_check_in") {
          router.push("/(tabs)/chat" as never);
        }
      } catch {
        // Router may not be ready yet; failure is acceptable.
      }
    };

    // Cold-start: the user tapped the notification while the app was killed.
    Notifications.getLastNotificationResponseAsync().then((res) => {
      handle(res?.notification.request.content.data as Record<string, unknown> | undefined);
    });

    // Warm-start: the app was already running.
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      handle(res.notification.request.content.data as Record<string, unknown> | undefined);
    });
    return () => sub.remove();
  }, []);

  return null;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FBF9F4" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="progress" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <CrisisProvider>
                  <BiometricLockProvider>
                    <NotificationDeepLinkHandler />
                    <RootLayoutNav />
                  </BiometricLockProvider>
                </CrisisProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
