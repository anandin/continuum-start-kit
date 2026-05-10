import React, { useState, useEffect, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQHTheme, FONT, SERIF, HAND } from '../lib/theme';
import MayaAvatar from '../components/MayaAvatar';
import QHIcon from '../components/QHIcon';
import QHButton from '../components/QHButton';
import LampGlow from '../components/LampGlow';
import TabBar from '../components/TabBar';

interface JournalEntry {
  id: string;
  content: string;
  shared: boolean;
  createdAt: string;
}

type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getPartOfDay(): PartOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function isNightish(part: PartOfDay): boolean {
  return part === 'evening' || part === 'night';
}

function formatDateLabel(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).toUpperCase();
  } catch {
    return '';
  }
}

function previewText(content: string, max = 90): string {
  const trimmed = content.replace(/\n/g, ' ').trim();
  return trimmed.length > max ? trimmed.slice(0, max) + '…' : trimmed;
}

const PROMPTS = [
  'What did your body know before your mind caught up?',
  "What are you carrying that isn\u2019t yours?",
  'Where did you feel the safest today?',
  'What would rest look like if no one was watching?',
];

const MORNING_PROMPTS = [
  'What does this morning need from you?',
  'What are you willing to let go of today?',
  'If today were gentle, what would it look like?',
  'What permission do you want to give yourself?',
];

export default function SeekerJournal() {
  const { theme, mode } = useQHTheme();
  const navigate = useNavigate();

  const partOfDay = getPartOfDay();
  const night = isNightish(partOfDay);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeDot, setActiveDot] = useState(0);

  const prompts = night ? PROMPTS : MORNING_PROMPTS;
  const currentPrompt = prompts[activeDot % prompts.length];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/journal/entries/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setEntries(Array.isArray(data) ? data : []);
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/journal/entries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, shared: false }),
      });
      if (res.ok) {
        const saved = await res.json();
        setEntries((prev) => [saved, ...prev]);
        setDraft('');
        setComposerOpen(false);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [draft, saving]);

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
        {/* Top row */}
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
            JOURNAL · {loading ? '…' : `${entries.length} entries`}
          </span>
          <button
            onClick={() => setComposerOpen(true)}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: theme.iconChipBg,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.accent,
            }}
            aria-label="New entry"
          >
            <QHIcon name="plus" size={18} />
          </button>
        </div>

        {/* Handwriting + headline */}
        <p
          style={{
            fontFamily: HAND,
            fontSize: 28,
            color: theme.accent,
            margin: '0 0 6px',
          }}
        >
          {night ? "tonight's prompt" : "this morning's prompt"}
        </p>

        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 32,
            fontWeight: 400,
            color: theme.text,
            margin: '0 0 24px',
            lineHeight: 1.15,
          }}
        >
          Three sentences is enough.
        </h1>

        {/* Prompt card */}
        <div
          style={{
            background: theme.cardGrad,
            borderRadius: 22,
            padding: '22px 22px 24px',
            marginBottom: 24,
            border: `1px solid ${theme.border}`,
          }}
        >
          {/* Pagination dots */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 6,
              marginBottom: 16,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setActiveDot(i)}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: i === activeDot ? theme.accent : theme.dim,
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.2s',
                }}
                aria-label={`Prompt ${i + 1}`}
              />
            ))}
          </div>

          {/* Maya suggests */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <MayaAvatar size={24} />
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
              MAYA SUGGESTS
            </span>
          </div>

          {/* Prompt text */}
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 20,
              lineHeight: 1.45,
              color: theme.text,
              margin: '0 0 16px',
            }}
          >
            {currentPrompt}
          </p>

          {/* Privacy note */}
          <p
            style={{
              fontFamily: FONT,
              fontSize: 12,
              color: theme.muted,
              margin: '0 0 20px',
              lineHeight: 1.5,
            }}
          >
            No one will see this unless you share it. Even a sentence counts.
          </p>

          {/* Begin writing button */}
          {!composerOpen && (
            <QHButton variant="primary" onClick={() => setComposerOpen(true)}>
              <QHIcon name="pencil" size={16} />
              Begin writing
            </QHButton>
          )}

          {/* Composer */}
          {composerOpen && (
            <div style={{ marginTop: 4 }}>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Start writing here…"
                style={{
                  width: '100%',
                  minHeight: 120,
                  background: theme.surface,
                  border: `1px solid ${theme.borderSoft}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  fontFamily: SERIF,
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: theme.text,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <QHButton
                  variant="primary"
                  onClick={handleSave}
                  disabled={!draft.trim() || saving}
                  style={{ flex: 1, opacity: !draft.trim() || saving ? 0.5 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save entry'}
                </QHButton>
                <QHButton
                  variant="ghost"
                  onClick={() => setComposerOpen(false)}
                  style={{ flex: 0, width: 'auto', padding: '0 20px' }}
                >
                  Cancel
                </QHButton>
              </div>
            </div>
          )}
        </div>

        {/* Recent entries */}
        <span
          style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            color: theme.muted,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 14,
            display: 'block',
          }}
        >
          RECENT
        </span>

        {loading && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: 13,
              color: theme.muted,
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            Loading…
          </p>
        )}

        {!loading && entries.length === 0 && (
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 14,
              color: theme.dim,
              textAlign: 'center',
              marginTop: 20,
              lineHeight: 1.5,
            }}
          >
            No entries yet. Your first words are waiting.
          </p>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: `1px solid ${theme.borderSoft}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 10,
                  fontWeight: 600,
                  color: theme.dim,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {formatDateLabel(entry.createdAt)}
              </span>
              {entry.shared && (
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 9,
                    fontWeight: 700,
                    color: theme.accent,
                    background: theme.pillActiveBg,
                    borderRadius: 8,
                    padding: '2px 8px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  SHARED
                </span>
              )}
            </div>
            <p
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontSize: 14.5,
                lineHeight: 1.5,
                color: theme.textSoft,
                margin: 0,
              }}
            >
              "{previewText(entry.content)}"
            </p>
          </div>
        ))}
      </div>

      <TabBar active="journal" onNavigate={handleTabNavigate} />
    </div>
  );
}
