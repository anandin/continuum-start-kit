import { useQHTheme, FONT } from "../lib/theme";
import QHIcon from "./QHIcon";

export default function ThemeToggle() {
  const { theme, mode, toggleMode } = useQHTheme();
  const isNight = mode === "night";

  return (
    <button
      onClick={toggleMode}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${theme.borderSoft}`,
        background: isNight
          ? "rgba(232,168,156,0.12)"
          : "rgba(200,120,107,0.08)",
        color: theme.accent,
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.2,
        cursor: "pointer",
        transition: "all 0.25s ease",
      }}
      title={isNight ? "Switch to morning mode" : "Switch to night mode"}
    >
      <QHIcon name={isNight ? "moon" : "sparkle"} size={14} />
      {isNight ? "Night" : "Morning"}
    </button>
  );
}
