/**
 * Haven brand palette — "Clinical Companion" theme.
 *
 * Deep forest-green primary on a near-white canvas, intentionally austere
 * to feel like a quiet companion-led space. Mirrored 1:1 in
 * artifacts/haven-web/src/index.css :root tokens so mobile and web share
 * the same visual identity.
 */

const colors = {
  light: {
    text: "#1A1A1A",
    tint: "#164E36",

    background: "#FAFAF7",
    foreground: "#1A1A1A",

    card: "#FFFFFF",
    cardForeground: "#1A1A1A",

    primary: "#164E36",
    primaryForeground: "#FFFFFF",

    secondary: "#F1F1EC",
    secondaryForeground: "#1A1A1A",

    muted: "#EFEFEA",
    mutedForeground: "#666666",

    accent: "#164E36",
    accentForeground: "#FFFFFF",

    destructive: "#B23A2A",
    destructiveForeground: "#FFFFFF",

    success: "#164E36",
    successForeground: "#FFFFFF",

    warning: "#B5832B",
    warningForeground: "#FFFFFF",

    border: "#E5E5E0",
    input: "#E5E5E0",

    crisis: "#B23A2A",
    crisisSoft: "#F4E4E0",

    gradientWarmStart: "#FAFAF7",
    gradientWarmEnd: "#F1F1EC",
    gradientHeroStart: "#FAFAF7",
    gradientHeroMid: "#FAFAF7",
    gradientHeroEnd: "#FAFAF7",
  },

  dark: {
    text: "#ECECE6",
    tint: "#3FA37C",

    background: "#0F1411",
    foreground: "#ECECE6",

    card: "#161C18",
    cardForeground: "#ECECE6",

    primary: "#3FA37C",
    primaryForeground: "#0F1411",

    secondary: "#1C231F",
    secondaryForeground: "#ECECE6",

    muted: "#1C231F",
    mutedForeground: "#9EA59E",

    accent: "#3FA37C",
    accentForeground: "#0F1411",

    destructive: "#B23A2A",
    destructiveForeground: "#FFFFFF",

    success: "#3FA37C",
    successForeground: "#0F1411",

    warning: "#D9A24A",
    warningForeground: "#0F1411",

    border: "#252C27",
    input: "#252C27",

    crisis: "#D9533F",
    crisisSoft: "#2A1814",

    gradientWarmStart: "#0F1411",
    gradientWarmEnd: "#161C18",
    gradientHeroStart: "#0F1411",
    gradientHeroMid: "#0F1411",
    gradientHeroEnd: "#0F1411",
  },

  radius: 16,
};

export default colors;
