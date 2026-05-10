import React, { useState, useEffect, useCallback, useId } from "react";
import { useNavigate } from "react-router-dom";
import { useQHTheme, FONT, SERIF, HAND } from "../lib/theme";
import QHIcon from "../components/QHIcon";
import LampGlow from "../components/LampGlow";
import TabBar from "../components/TabBar";

interface MoodPoint {
  day: string;
  score: number;
}

interface ThemeItem {
  label: string;
  note: string;
  trend: "easing" | "new" | "flat";
}

interface ProgressData {
  weeksWithMaya: number;
  insight: string;
  insightHighlight: string;
  themes: ThemeItem[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FALLBACK_MOODS: MoodPoint[] = DAYS.map((day, i) => ({
  day,
  score: [3, 3.5, 4, 3, 4.5, 4, 4.5][i],
}));

const FALLBACK_PROGRESS: ProgressData = {
  weeksWithMaya: 6,
  insight:
    "You\u2019ve been noticing the difference between what drains you and what quietly restores you \u2014 and that awareness is already a kind of care.",
  insightHighlight: "that awareness is already a kind of care",
  themes: [
    {
      label: "Self-permission",
      note: "Came up 4 times this week",
      trend: "easing",
    },
    { label: "Sleep patterns", note: "First mention Wednesday", trend: "new" },
    { label: "Work boundaries", note: "Steady since week 3", trend: "flat" },
  ],
};

function MoodChart({
  data,
  theme,
}: {
  data: MoodPoint[];
  theme: ReturnType<typeof useQHTheme>["theme"];
}) {
  const gradId = useId();
  const chartW = 320;
  const chartH = 100;
  const padX = 8;
  const padTop = 8;
  const padBot = 24;
  const plotH = chartH - padTop - padBot;
  const minScore = 1;
  const maxScore = 5;

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (chartW - padX * 2);
    const yNorm = (d.score - minScore) / (maxScore - minScore);
    const y = padTop + plotH - yNorm * plotH;
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = [
    `M${points[0].x},${padTop + plotH}`,
    ...points.map((p) => `L${p.x},${p.y}`),
    `L${points[points.length - 1].x},${padTop + plotH}`,
    "Z",
  ].join(" ");

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${chartW} ${chartH}`}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.accent} stopOpacity={0.28} />
          <stop offset="100%" stopColor={theme.accent} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#${gradId})`} />

      <polyline
        points={polyline}
        fill="none"
        stroke={theme.accent}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.2} fill={theme.accent} />
      ))}

      {data.map((d, i) => {
        const x = padX + (i / (data.length - 1)) * (chartW - padX * 2);
        return (
          <text
            key={i}
            x={x}
            y={chartH - 4}
            textAnchor="middle"
            style={{
              fontFamily: FONT,
              fontSize: 9.5,
              fill: theme.dim,
              fontWeight: 500,
            }}
          >
            {d.day}
          </text>
        );
      })}
    </svg>
  );
}

function trendIndicator(
  trend: ThemeItem["trend"],
  theme: ReturnType<typeof useQHTheme>["theme"],
) {
  switch (trend) {
    case "easing":
      return { symbol: "↓", color: theme.sage, label: "easing" };
    case "new":
      return { symbol: "·", color: theme.accent, label: "new" };
    case "flat":
    default:
      return { symbol: "—", color: theme.muted, label: "flat" };
  }
}

export default function SeekerProgress() {
  const { theme, mode } = useQHTheme();
  const navigate = useNavigate();

  const [moods, setMoods] = useState<MoodPoint[]>(FALLBACK_MOODS);
  const [progress, setProgress] = useState<ProgressData>(FALLBACK_PROGRESS);
  const [loadingMoods, setLoadingMoods] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadMoods() {
      try {
        const res = await fetch("/api/mood/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data) && data.length > 0) {
            setMoods(
              data.slice(-7).map((d: any, i: number) => ({
                day: DAYS[i % 7],
                score: typeof d.score === "number" ? d.score : 3,
              })),
            );
          }
        }
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setLoadingMoods(false);
      }
    }
    loadMoods();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProgress() {
      try {
        const res = await fetch("/api/seeker/progress", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data) {
            setProgress((prev) => ({
              weeksWithMaya: data.weeksWithMaya ?? prev.weeksWithMaya,
              insight: data.insight ?? prev.insight,
              insightHighlight: data.insightHighlight ?? prev.insightHighlight,
              themes: Array.isArray(data.themes) ? data.themes : prev.themes,
            }));
          }
        }
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setLoadingProgress(false);
      }
    }
    loadProgress();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTabNavigate = useCallback(
    (tab: string) => {
      const routes: Record<string, string> = {
        today: "/seeker/home",
        twin: "/seeker/chat",
        journal: "/seeker/journal",
        progress: "/seeker/progress",
        you: "/seeker/you",
      };
      navigate(routes[tab] ?? `/seeker/${tab}`);
    },
    [navigate],
  );

  function renderInsight(text: string, highlight: string) {
    if (!highlight) {
      return text;
    }
    const idx = text.indexOf(highlight);
    if (idx === -1) {
      return text;
    }
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ color: theme.accent, fontStyle: "italic" }}>
          {highlight}
        </span>
        {text.slice(idx + highlight.length)}
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: theme.pageGrad,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <LampGlow top={-100} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "48px 24px 100px",
          overflowY: "auto",
          maxWidth: 440,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* Top label */}
        <span
          style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 600,
            color: theme.muted,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          {progress.weeksWithMaya} WEEKS WITH MAYA
        </span>

        {/* Handwriting */}
        <p
          style={{
            fontFamily: HAND,
            fontSize: 28,
            color: theme.accent,
            margin: "0 0 6px",
          }}
        >
          look how far you've come
        </p>

        {/* Headline */}
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 32,
            fontWeight: 400,
            color: theme.text,
            margin: "0 0 24px",
            lineHeight: 1.15,
          }}
        >
          What you've learned
        </h1>

        {/* Insight card */}
        <div
          style={{
            background: theme.surface,
            borderRadius: 18,
            padding: "22px 22px 24px",
            marginBottom: 16,
            border: `1px solid ${theme.borderSoft}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div style={{ color: theme.accent }}>
              <QHIcon name="sparkle" size={16} />
            </div>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 700,
                color: theme.muted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              SOMETHING TO HOLD ONTO
            </span>
          </div>

          <p
            style={{
              fontFamily: SERIF,
              fontSize: 15.5,
              lineHeight: 1.55,
              color: theme.textSoft,
              margin: "0 0 12px",
            }}
          >
            {loadingProgress ? (
              <span style={{ color: theme.dim }}>Reflecting…</span>
            ) : (
              renderInsight(progress.insight, progress.insightHighlight)
            )}
          </p>

          <p
            style={{
              fontFamily: FONT,
              fontSize: 11,
              color: theme.dim,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Drawn from your check-ins and journal entries.
          </p>
        </div>

        {/* Mood chart card */}
        <div
          style={{
            background: theme.surface,
            borderRadius: 18,
            padding: "20px 22px 18px",
            marginBottom: 16,
            border: `1px solid ${theme.borderSoft}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                color: theme.textSoft,
              }}
            >
              This week
            </span>
            <span
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: 13,
                color: theme.muted,
              }}
            >
              steadier than last
            </span>
          </div>

          {loadingMoods ? (
            <div
              style={{
                height: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 13,
                  color: theme.dim,
                }}
              >
                Loading…
              </span>
            </div>
          ) : (
            <MoodChart data={moods} theme={theme} />
          )}
        </div>

        {/* Themes section */}
        <span
          style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            color: theme.muted,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 14,
            display: "block",
          }}
        >
          WHAT KEEPS COMING UP
        </span>

        {loadingProgress ? (
          <p
            style={{
              fontFamily: FONT,
              fontSize: 13,
              color: theme.dim,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Loading…
          </p>
        ) : (
          progress.themes.map((t, i) => {
            const trend = trendIndicator(t.trend, theme);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom:
                    i < progress.themes.length - 1
                      ? `1px solid ${theme.borderSoft}`
                      : "none",
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: SERIF,
                      fontSize: 15,
                      color: theme.text,
                      margin: "0 0 3px",
                    }}
                  >
                    {t.label}
                  </p>
                  <p
                    style={{
                      fontFamily: FONT,
                      fontSize: 11,
                      color: theme.muted,
                      margin: 0,
                    }}
                  >
                    {t.note}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT,
                      fontSize: 14,
                      fontWeight: 600,
                      color: trend.color,
                    }}
                  >
                    {trend.symbol}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT,
                      fontSize: 10,
                      fontWeight: 500,
                      color: trend.color,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {trend.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <TabBar active="progress" onNavigate={handleTabNavigate} />
    </div>
  );
}
