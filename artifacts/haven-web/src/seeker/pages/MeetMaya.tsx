import React, { useId } from "react";
import { useNavigate } from "react-router-dom";
import { useQHTheme, FONT, SERIF, HAND } from "../lib/theme";
import MayaAvatar from "../components/MayaAvatar";
import QHIcon from "../components/QHIcon";
import QHButton from "../components/QHButton";

function ProgressDots({ total, filled }: { total: number; filled: number }) {
  const { theme } = useQHTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: i < filled ? theme.accent : theme.borderSoft,
            transition: "background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

function WaveformBars() {
  const { theme } = useQHTheme();
  const heights = [6, 12, 16, 12, 8];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: 2.5,
            height: h,
            borderRadius: 2,
            background: theme.sage,
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}

export default function MeetMaya() {
  const { theme } = useQHTheme();
  const navigate = useNavigate();
  const uid = useId();

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: theme.pageGrad,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "48px 28px 48px",
          overflowY: "auto",
        }}
      >
        {/* Progress */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 36,
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 500,
              color: theme.muted,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Step 3 of 4
          </span>
          <ProgressDots total={4} filled={3} />
        </div>

        {/* Avatar */}
        <div style={{ marginBottom: 20 }}>
          <MayaAvatar size={140} ring={theme.accent} />
        </div>

        {/* Status badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 20,
            background: theme.surface,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: theme.sage,
              boxShadow: `0 0 6px ${theme.sage}`,
            }}
          />
          <span
            style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 700,
              color: theme.sage,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Here now
          </span>
          <WaveformBars />
        </div>

        {/* Hand greeting */}
        <p
          style={{
            fontFamily: HAND,
            fontSize: 26,
            color: theme.accent,
            margin: "0 0 4px",
          }}
        >
          hi, I'm
        </p>

        {/* Name */}
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 42,
            fontWeight: 400,
            color: theme.text,
            margin: "0 0 10px",
            lineHeight: 1,
          }}
        >
          Maya.
        </h1>

        {/* Credentials */}
        <p
          style={{
            fontFamily: FONT,
            fontSize: 13.5,
            color: theme.muted,
            margin: "0 0 28px",
            textAlign: "center",
            letterSpacing: "0.01em",
          }}
        >
          PhD, LCSW · Trauma-informed CBT · 11 years
        </p>

        {/* Philosophy quote card */}
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            background: theme.surface,
            borderRadius: 18,
            padding: "22px 24px",
            marginBottom: 16,
            border: `1px solid ${theme.borderSoft}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div style={{ color: theme.accent, flexShrink: 0, marginTop: 2 }}>
              <QHIcon name="quote" size={20} />
            </div>
            <p
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: 15.5,
                lineHeight: 1.55,
                color: theme.textSoft,
                margin: 0,
              }}
            >
              Healing happens between sessions — in the quiet drive home, the
              deep breath before a hard conversation, the moment you choose
              yourself. I'm here for all of it.
            </p>
          </div>
        </div>

        {/* How the Twin works card */}
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            background: theme.cardGrad,
            borderRadius: 18,
            padding: "18px 22px",
            marginBottom: 36,
            border: `1px solid ${theme.borderSoft}`,
            display: "flex",
            alignItems: "center",
            gap: 14,
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
              flexShrink: 0,
              color: theme.accent,
            }}
          >
            <QHIcon name="sparkle" size={20} />
          </div>
          <div>
            <p
              style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 700,
                color: theme.muted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: "0 0 3px",
              }}
            >
              How the Twin works
            </p>
            <p
              style={{
                fontFamily: FONT,
                fontSize: 13,
                color: theme.textSoft,
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Maya's therapeutic AI twin is trained on her methods, voice, and
              clinical approach — so it feels like her, anytime.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div style={{ width: "100%", maxWidth: 380 }}>
          <QHButton onClick={() => navigate("/seeker/home")}>
            Say hi to Maya
          </QHButton>
        </div>

        {/* Ghost link */}
        <button
          onClick={() => {}}
          style={{
            background: "none",
            border: "none",
            fontFamily: FONT,
            fontSize: 14,
            color: theme.accent,
            cursor: "pointer",
            marginTop: 16,
            padding: "4px 8px",
            opacity: 0.8,
          }}
        >
          Or browse other therapists
        </button>
      </div>
    </div>
  );
}
