import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/lib/api";

// While the app is open, show notifications as banners + sound so the
// seeker still gets a visible cue when their coach replies during chat.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registering: Promise<string | null> | null = null;
let lastRegisteredToken: string | null = null;

function resolveProjectId(): string | undefined {
  const fromExpo = (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)
    ?.extra?.eas?.projectId;
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } })?.easConfig
    ?.projectId;
  return fromExpo ?? fromEas;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Coach updates",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#7A5A3C",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {
    // Channel setup is best-effort.
  }
}

async function fetchExpoPushToken(): Promise<string | null> {
  const projectId = resolveProjectId();
  try {
    const result = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return result?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Request notification permission, fetch an Expo push token, and register
 * it with the API server. Safe to call multiple times — concurrent and
 * repeat calls collapse into a single round-trip. Returns the token on
 * success, or `null` if push isn't available (web preview, simulator,
 * permission denied, missing projectId, etc.).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;
  if (registering) return registering;

  registering = (async () => {
    try {
      await ensureAndroidChannel();
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== "granted") {
        const next = await Notifications.requestPermissionsAsync();
        status = next.status;
      }
      if (status !== "granted") return null;

      const token = await fetchExpoPushToken();
      if (!token) return null;

      try {
        await api("/api/push-tokens", {
          method: "POST",
          body: JSON.stringify({ token, platform: Platform.OS }),
        });
        lastRegisteredToken = token;
      } catch {
        // Server may be unreachable; surface null so callers can retry later.
        return null;
      }
      return token;
    } finally {
      registering = null;
    }
  })();
  return registering;
}

/**
 * Remove this device's push token from the server. Best-effort — used on
 * sign-out so a shared device doesn't keep getting the previous user's
 * notifications.
 */
export async function unregisterPushNotifications(): Promise<void> {
  const token = lastRegisteredToken;
  lastRegisteredToken = null;
  if (!token) return;
  try {
    await api("/api/push-tokens", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  } catch {
    // ignore
  }
}

export type PushPreference = { enabled: boolean };

export async function getPushPreference(): Promise<PushPreference> {
  try {
    const data = await api<{ enabled: boolean }>("/api/push-tokens");
    return { enabled: Boolean(data?.enabled) };
  } catch {
    return { enabled: false };
  }
}

export async function setPushPreference(enabled: boolean): Promise<PushPreference> {
  if (enabled) {
    const token = await registerForPushNotifications();
    if (!token) {
      // No token available; flip server state anyway so the toggle reflects intent.
    }
  }
  await api("/api/push-tokens", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  return { enabled };
}

export { Notifications };
