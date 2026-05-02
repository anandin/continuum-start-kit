/**
 * Haven brand palette.
 *
 * Mirrors artifacts/haven-web/src/index.css :root tokens (warm IDEO palette,
 * teal primary + warm amber accent on a cream canvas) so the mobile app
 * shares the exact same visual identity as the web app.
 */

const colors = {
  light: {
    text: "#3A322B",
    tint: "#298E89",

    background: "#FBF9F4",
    foreground: "#3A322B",

    card: "#FCFAF6",
    cardForeground: "#3A322B",

    primary: "#298E89",
    primaryForeground: "#FFFFFF",

    secondary: "#F4F0E8",
    secondaryForeground: "#574B40",

    muted: "#EDE8DD",
    mutedForeground: "#847C72",

    accent: "#EAB04A",
    accentForeground: "#3A2F26",

    destructive: "#D1503F",
    destructiveForeground: "#FFFFFF",

    success: "#3B9D7A",
    successForeground: "#FFFFFF",

    warning: "#E5A93D",
    warningForeground: "#3A2F26",

    border: "#E2DBD0",
    input: "#E2DBD0",

    crisis: "#D1503F",
    crisisSoft: "#F8E4E0",

    gradientWarmStart: "#FBF9F4",
    gradientWarmEnd: "#F4EFE3",
    gradientHeroStart: "#FCFBF6",
    gradientHeroMid: "#E5F0EF",
    gradientHeroEnd: "#FBF9F4",
  },

  dark: {
    text: "#ECE7DC",
    tint: "#2EA59F",

    background: "#1E1A16",
    foreground: "#ECE7DC",

    card: "#241F1A",
    cardForeground: "#ECE7DC",

    primary: "#2EA59F",
    primaryForeground: "#FFFFFF",

    secondary: "#2F2924",
    secondaryForeground: "#ECE7DC",

    muted: "#34302B",
    mutedForeground: "#A39A8E",

    accent: "#E5A93D",
    accentForeground: "#ECE7DC",

    destructive: "#B84638",
    destructiveForeground: "#ECE7DC",

    success: "#3B9D7A",
    successForeground: "#FFFFFF",

    warning: "#E5A93D",
    warningForeground: "#3A2F26",

    border: "#3A352F",
    input: "#3A352F",

    crisis: "#E76A58",
    crisisSoft: "#3A1F1A",

    gradientWarmStart: "#1E1A16",
    gradientWarmEnd: "#241F1A",
    gradientHeroStart: "#1E1A16",
    gradientHeroMid: "#1F2A29",
    gradientHeroEnd: "#1E1A16",
  },

  radius: 16,
};

export default colors;
