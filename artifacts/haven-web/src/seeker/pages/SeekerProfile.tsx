import React from "react";
import { useNavigate } from "react-router-dom";
import { useQHTheme, FONT, SERIF, HAND } from "../lib/theme";
import { useAuth } from "../../contexts/AuthContext";
import QHIcon from "../components/QHIcon";
import QHButton from "../components/QHButton";
import TabBar from "../components/TabBar";
import ThemeToggle from "../components/ThemeToggle";

export default function SeekerProfile() {
  const { theme } = useQHTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleNav = (tab: string) => {
    const routes: Record<string, string> = {
      today: "/seeker/home",
      twin: "/seeker/chat",
      journal: "/seeker/journal",
      progress: "/seeker/progress",
      you: "/seeker/you",
    };
    navigate(routes[tab] ?? "/seeker/home");
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: theme.pageGrad,
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          padding: "24px 24px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 600,
            color: theme.muted,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Profile
        </span>
        <ThemeToggle />
      </div>

      <div style={{ padding: "32px 24px" }}>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 30,
            color: theme.text,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Your space.
        </h1>
        <p
          style={{
            fontFamily: FONT,
            fontSize: 14,
            color: theme.muted,
            marginTop: 8,
          }}
        >
          {user?.email ?? ""}
        </p>
      </div>

      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {[
          {
            icon: "bookmark",
            label: "Saved moments",
            sub: "Bookmarked messages and insights",
          },
          {
            icon: "target",
            label: "My commitments",
            sub: "Goals from your sessions",
          },
          {
            icon: "phone",
            label: "Scheduled sessions",
            sub: "Upcoming with Maya",
          },
          {
            icon: "user",
            label: "Account settings",
            sub: "Email, password, notifications",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: "16px 18px",
              background: theme.surface,
              border: `1px solid ${theme.borderSoft}`,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: theme.iconChipBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: theme.accent,
              }}
            >
              <QHIcon name={item.icon} size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 500,
                  color: theme.text,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  color: theme.muted,
                  marginTop: 2,
                }}
              >
                {item.sub}
              </div>
            </div>
            <QHIcon name="chevR" size={16} />
          </div>
        ))}
      </div>

      <div style={{ padding: "32px 24px" }}>
        <QHButton
          variant="ghost"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          Sign out
        </QHButton>
      </div>

      <TabBar active="you" onNavigate={handleNav} />
    </div>
  );
}
