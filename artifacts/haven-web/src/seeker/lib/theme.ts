import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import React from "react";

// ── Font stacks ──────────────────────────────────────────────────────────────

export const FONT = '"Geist", -apple-system, system-ui, sans-serif';
export const SERIF = '"Instrument Serif", Georgia, serif';
export const HAND = '"Caveat", cursive';

// ── Theme type ───────────────────────────────────────────────────────────────

export interface QHTheme {
  name: string;
  bg: string;
  bgSoft: string;
  surface: string;
  surfaceHi: string;
  text: string;
  textSoft: string;
  muted: string;
  dim: string;
  accent: string;
  accentSoft: string;
  accentInk: string;
  blush: string;
  sage: string;
  border: string;
  borderSoft: string;
  pageGrad: string;
  chatGrad: string;
  glowRGBA: string;
  glowRGBASoft: string;
  cardGrad: string;
  iconChipBg: string;
  btnShadow: string;
  composerShadow: string;
  pillActiveBg: string;
  statusDark: boolean;
}

// ── Palettes ─────────────────────────────────────────────────────────────────

export const QH_NIGHT: QHTheme = {
  name: "night",
  bg: "#15131D",
  bgSoft: "#1B1828",
  surface: "#1F1C2E",
  surfaceHi: "#272338",
  text: "#EFE6DC",
  textSoft: "#D9CFC4",
  muted: "#9089A2",
  dim: "#5A536A",
  accent: "#E8A89C",
  accentSoft: "#F0BFB6",
  accentInk: "#15131D",
  blush: "#E8A89C",
  sage: "#9FBBA5",
  border: "rgba(232,168,156,0.20)",
  borderSoft: "rgba(239,230,220,0.08)",
  pageGrad: "linear-gradient(180deg, #1B1828 0%, #15131D 70%)",
  chatGrad:
    "radial-gradient(ellipse at 50% 22%, rgba(232,168,156,0.18) 0%, transparent 60%), linear-gradient(180deg, #1B1828, #15131D)",
  glowRGBA: "rgba(232,168,156,0.22)",
  glowRGBASoft: "rgba(232,168,156,0.10)",
  cardGrad:
    "linear-gradient(180deg, rgba(232,168,156,0.13) 0%, rgba(232,168,156,0.04) 100%)",
  iconChipBg: "rgba(232,168,156,0.10)",
  btnShadow: "0 10px 26px rgba(232,168,156,0.22)",
  composerShadow: "0 8px 24px rgba(0,0,0,0.4)",
  pillActiveBg: "rgba(232,168,156,0.10)",
  statusDark: true,
};

export const QH_MORNING: QHTheme = {
  name: "morning",
  bg: "#EFE9DC",
  bgSoft: "#F4EFE3",
  surface: "#F9F5EB",
  surfaceHi: "#FFFFFF",
  text: "#1F1B2A",
  textSoft: "#3D3849",
  muted: "#7A7286",
  dim: "#A8A0B1",
  accent: "#C8786B",
  accentSoft: "#DC9587",
  accentInk: "#FFFFFF",
  blush: "#C8786B",
  sage: "#6F8E73",
  border: "rgba(200,120,107,0.26)",
  borderSoft: "rgba(31,27,42,0.10)",
  pageGrad: "linear-gradient(180deg, #F4EFE3 0%, #EFE9DC 60%, #E8E2D2 100%)",
  chatGrad:
    "radial-gradient(ellipse at 50% 22%, rgba(200,120,107,0.22) 0%, transparent 55%), linear-gradient(180deg, #F4EFE3 0%, #E8E2D2 100%)",
  glowRGBA: "rgba(200,120,107,0.28)",
  glowRGBASoft: "rgba(200,120,107,0.14)",
  cardGrad:
    "linear-gradient(180deg, rgba(200,120,107,0.13) 0%, rgba(200,120,107,0.03) 100%)",
  iconChipBg: "rgba(200,120,107,0.10)",
  btnShadow: "0 10px 26px rgba(200,120,107,0.22)",
  composerShadow: "0 10px 24px rgba(31,27,42,0.10)",
  pillActiveBg: "rgba(200,120,107,0.10)",
  statusDark: false,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export type ThemeMode = "night" | "morning";

function resolveMode(): ThemeMode {
  const h = new Date().getHours();
  return h >= 10 && h < 18 ? "morning" : "night";
}

function paletteFor(mode: ThemeMode): QHTheme {
  return mode === "morning" ? QH_MORNING : QH_NIGHT;
}

// ── Context ──────────────────────────────────────────────────────────────────

interface QHThemeContext {
  theme: QHTheme;
  mode: ThemeMode;
  reading: boolean;
  setReading: (v: boolean) => void;
}

const Ctx = createContext<QHThemeContext | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useMemo(resolveMode, []);
  const theme = useMemo(() => paletteFor(mode), [mode]);
  const [reading, setReading] = useState(false);

  const value = useMemo(
    () => ({ theme, mode, reading, setReading }),
    [theme, mode, reading],
  );

  return React.createElement(Ctx.Provider, { value }, children);
}

export function useQHTheme(): QHThemeContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQHTheme must be used inside <ThemeProvider>");
  return ctx;
}
