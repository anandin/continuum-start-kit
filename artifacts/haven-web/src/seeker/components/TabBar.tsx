import React from "react";
import { useQHTheme, FONT } from "../lib/theme";
import QHIcon from "./QHIcon";

const TABS = [
  { id: "today", label: "Today", icon: "home" },
  { id: "twin", label: "Twin", icon: "chat" },
  { id: "journal", label: "Journal", icon: "book" },
  { id: "progress", label: "Progress", icon: "chart" },
  { id: "you", label: "You", icon: "user" },
] as const;

interface TabBarProps {
  active: string;
  onNavigate: (tab: string) => void;
}

export default function TabBar({ active, onNavigate }: TabBarProps) {
  const { theme } = useQHTheme();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: 64,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: theme.statusDark
          ? "rgba(21,19,29,0.72)"
          : "rgba(239,233,220,0.78)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: `1px solid ${theme.borderSoft}`,
        fontFamily: FONT,
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px 0",
              color: isActive ? theme.accent : theme.muted,
              transition: "color 0.2s",
            }}
          >
            <QHIcon
              name={tab.icon}
              size={20}
              strokeWidth={isActive ? 2 : 1.5}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                letterSpacing: "0.02em",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
