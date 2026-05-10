import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQHTheme, FONT, SERIF, HAND, type ThemeMode } from '../lib/theme';
import { useAuth } from '../../contexts/AuthContext';
import MayaAvatar from '../components/MayaAvatar';
import QHIcon from '../components/QHIcon';
import QHButton from '../components/QHButton';
import LampGlow from '../components/LampGlow';
import TabBar from '../components/TabBar';

type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getPartOfDay(): PartOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function getDayLabel(): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const day = days[new Date().getDay()];
  const part = getPartOfDay().toUpperCase();
  return `${day} ${part}`;
}

function isNightish(part: PartOfDay): boolean {
  return part === 'evening' || part === 'night';
}

const MOODS = [
  { label: 'rough', score: 1 },
  { label: 'low', score: 2 },
  { label: 'meh', score: 3 },
  { label: 'okay', score: 4 },
  { label: 'good', score: 5 },
  { label: 'lifted', score: 5 },
] as const;

export default function Home() {
  const { theme, mode } = useQHTheme();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodSaving, setMoodSaving] = useState(false);

  const partOfDay = getPartOfDay();
  const night = isNightish(partOfDay);
  const firstName = (profile as any)?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'you';

  const greeting = night ? `hey ${firstName},` : `good morning, ${firstName}`;
  const subtitle = night
    ? "Take a breath. There's no rush tonight."
    : 'No need to be ready yet. We can ease in.';

  const handleMoodSelect = useCallback(
    async (label: string, score: number) => {
      setSelectedMood(label);
      setMoodSaving(true);
      try {
        await fetch('/api/mood/today', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score }),
        });
      } catch {
        // silently fail — mood is non-critical
      } finally {
        setMoodSaving(false);
      }
    },
    [],
  );

  const handleTabNavigate = useCallback(
    (tab: string) => {
      const routes: Record<string, string> = {
        today: '/seeker/home',
        twin: '/seeker/chat',
        journal: '/seeker/journal',
        progress: '/seeker/progress',
        you: '/seeker/you',
      };
      navigate(routes[tab] ?? `/seeker/${tab}`);
    },
    [navigate],
  );

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: theme.pageGrad,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <LampGlow top={-100} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 24px 100px',
          overflowY: 'auto',
          maxWidth: 440,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {/* Top row: date + avatar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              color: theme.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {getDayLabel()}
          </span>
          <button
            onClick={() => navigate('/seeker/you')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 0,
            }}
            aria-label="Profile"
          >
            <MayaAvatar size={32} />
          </button>
        </div>

        {/* Greeting */}
        <p
          style={{
            fontFamily: HAND,
            fontSize: 28,
            color: theme.accent,
            margin: '0 0 6px',
          }}
        >
          {greeting}
        </p>

        {/* Headline */}
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 32,
            fontWeight: 400,
            color: theme.text,
            margin: '0 0 8px',
            lineHeight: 1.15,
          }}
        >
          how are you, really?
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 15,
            lineHeight: 1.5,
            color: theme.muted,
            margin: '0 0 32px',
          }}
        >
          {subtitle}
        </p>

        {/* Mood check-in card */}
        <div
          style={{
            background: theme.surface,
            borderRadius: 18,
            padding: '20px 20px 22px',
            marginBottom: 16,
            border: `1px solid ${theme.borderSoft}`,
          }}
        >
          <p
            style={{
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 500,
              color: theme.textSoft,
              margin: '0 0 14px',
            }}
          >
            How's right now?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MOODS.map((m) => {
              const active = selectedMood === m.label;
              return (
                <button
                  key={m.label}
                  onClick={() => handleMoodSelect(m.label, m.score)}
                  disabled={moodSaving}
                  style={{
                    fontFamily: FONT,
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? theme.accent : theme.muted,
                    background: active ? theme.pillActiveBg : 'transparent',
                    border: `1.5px solid ${active ? theme.accent : theme.borderSoft}`,
                    borderRadius: 20,
                    padding: '7px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                    opacity: moodSaving && !active ? 0.5 : 1,
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Continuity card */}
        <div
          style={{
            background: theme.surface,
            borderRadius: 18,
            padding: '20px 22px',
            marginBottom: 16,
            border: `1px solid ${theme.borderSoft}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: theme.accent,
              }}
            />
            <span
              style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 700,
                color: theme.muted,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Something you said Tuesday
            </span>
          </div>
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 15.5,
              lineHeight: 1.55,
              color: theme.textSoft,
              margin: '0 0 14px',
            }}
          >
            "I think I keep waiting for permission to rest — like I haven't earned it yet."
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['self-worth', 'rest', 'permission'].map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 500,
                  color: theme.accent,
                  background: theme.pillActiveBg,
                  borderRadius: 12,
                  padding: '4px 12px',
                  letterSpacing: '0.02em',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Maya's note card */}
        <div
          style={{
            background: theme.cardGrad,
            borderRadius: 18,
            padding: '22px 22px 24px',
            marginBottom: 16,
            border: `1px solid ${theme.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ color: theme.accent }}>
              <QHIcon name="sparkle" size={16} />
            </div>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 700,
                color: theme.muted,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              A little note from Maya
            </span>
          </div>
          <p
            style={{
              fontFamily: SERIF,
              fontSize: 15.5,
              lineHeight: 1.55,
              color: theme.textSoft,
              margin: '0 0 20px',
            }}
          >
            Last time we talked about rest and permission — there's something gentle
            I'd love to explore with you when you're ready.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <QHButton
              variant="primary"
              onClick={() => navigate('/seeker/chat')}
              style={{ flex: 1 }}
            >
              Yes, let's
            </QHButton>
            <QHButton variant="ghost" style={{ flex: 1 }}>
              Maybe later
            </QHButton>
          </div>
        </div>
      </div>

      <TabBar active="today" onNavigate={handleTabNavigate} />
    </div>
  );
}
