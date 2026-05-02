import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_COOKIE_KEY = "haven.session";
const isNative = Platform.OS !== "web";

const baseUrl =
  process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";

let cachedCookie: string | null = null;
let cookieLoaded = false;

async function loadCookie(): Promise<string | null> {
  if (cookieLoaded) return cachedCookie;
  try {
    const stored = await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
    cachedCookie = stored;
  } catch {
    cachedCookie = null;
  }
  cookieLoaded = true;
  return cachedCookie;
}

async function persistCookie(cookie: string | null): Promise<void> {
  cachedCookie = cookie;
  cookieLoaded = true;
  try {
    if (cookie) {
      await SecureStore.setItemAsync(SESSION_COOKIE_KEY, cookie);
    } else {
      await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
    }
  } catch {
    // SecureStore may be unavailable on some web builds; in-memory fallback is fine.
  }
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/connect\.sid=[^;]+/);
  return match ? match[0] : null;
}

export async function clearSession(): Promise<void> {
  await persistCookie(null);
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  if (isNative) {
    const cookie = await loadCookie();
    if (cookie) headers.set("Cookie", cookie);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (isNative) {
    const setCookie = res.headers.get("set-cookie");
    const next = extractSessionCookie(setCookie);
    if (next) await persistCookie(next);
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : null) ||
      (typeof body === "string" ? body : null) ||
      `Request failed (${res.status})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return body as T;
}

export const apiBaseUrl = baseUrl;
