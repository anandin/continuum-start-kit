import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQHTheme, FONT, SERIF, HAND } from '../lib/theme';
import MayaAvatar from '../components/MayaAvatar';
import QHIcon from '../components/QHIcon';
import QHButton from '../components/QHButton';
import TabBar from '../components/TabBar';

interface ChatMessage {
  id: string;
  role: 'twin' | 'user';
  content: string;
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

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function SeekerChat() {
  const { theme, mode } = useQHTheme();
  const navigate = useNavigate();
  const partOfDay = getPartOfDay();
  const night = isNightish(partOfDay);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatTitle = night ? 'Quiet hours with Maya' : 'Morning with Maya';
  const statusText = night
    ? "Maya signed off at 9 · I'm here with you"
    : "Maya's with clients · I'm here while you wake up";

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // On mount: load engagements → session → messages
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const engRes = await fetch('/api/engagements', { credentials: 'include' });
        if (!engRes.ok) throw new Error('Failed to load engagements');
        const engagements = await engRes.json();
        const active = Array.isArray(engagements)
          ? engagements.find((e: any) => e.status === 'active') ?? engagements[0]
          : null;
        if (!active) throw new Error('No active engagement');

        const sesRes = await fetch(`/api/engagements/${active.id}/sessions`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!sesRes.ok) throw new Error('Failed to create session');
        const session = await sesRes.json();
        if (cancelled) return;
        setSessionId(session.id);

        const msgRes = await fetch(`/api/sessions/${session.id}/messages`, {
          credentials: 'include',
        });
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          if (!cancelled) setMessages(Array.isArray(msgs) ? msgs : []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Something went wrong');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !sessionId || sending) return;

    const tempId = `temp-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (!res.ok) throw new Error('Send failed');
      const data = await res.json();
      const botMsg: ChatMessage = {
        id: data.id ?? `bot-${Date.now()}`,
        role: 'twin',
        content: data.reply ?? data.content ?? data.message ?? '',
        createdAt: data.createdAt ?? new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'twin',
          content: "I'm having trouble connecting right now. Let's try again in a moment.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sessionId, sending]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
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

  // Wind-down card data
  const windDownIcon = night ? 'moon' : 'leaf';
  const windDownSteps = [
    { num: 1, label: 'Box breath', time: '2 min' },
    { num: 2, label: 'Body scan', time: '6 min' },
    { num: 3, label: 'Tomorrow note', time: '1 min' },
  ];

  return (
    <div
      style={{
        height: '100dvh',
        background: theme.chatGrad,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 20px',
          borderBottom: `1px solid ${theme.borderSoft}`,
          background: theme.statusDark
            ? 'rgba(21,19,29,0.6)'
            : 'rgba(239,233,220,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <MayaAvatar size={32} ring={theme.accent} />
        <div style={{ flex: 1, marginLeft: 12 }}>
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 16,
              color: theme.text,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {chatTitle}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: theme.sage,
                boxShadow: `0 0 4px ${theme.sage}`,
              }}
            />
            <span
              style={{
                fontFamily: FONT,
                fontSize: 11,
                color: theme.muted,
              }}
            >
              {statusText}
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate('/seeker/home')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: theme.muted,
          }}
          aria-label="Close chat"
        >
          <QHIcon name="close" size={20} />
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 20px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {loading && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: 13,
              color: theme.muted,
              textAlign: 'center',
              marginTop: 40,
            }}
          >
            Loading…
          </p>
        )}

        {error && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: 13,
              color: theme.accent,
              textAlign: 'center',
              marginTop: 40,
            }}
          >
            {error}
          </p>
        )}

        {!loading && !error && messages.length === 0 && (
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 15,
              color: theme.muted,
              textAlign: 'center',
              marginTop: 60,
              lineHeight: 1.5,
            }}
          >
            This is a safe space.{'\n'}Say whatever's on your mind.
          </p>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  fontFamily: isUser ? FONT : SERIF,
                  fontSize: isUser ? 14.5 : 15.5,
                  lineHeight: 1.55,
                  color: theme.text,
                  background: isUser ? theme.surface : 'transparent',
                  borderRadius: isUser ? 18 : 0,
                  padding: isUser ? '12px 16px' : '2px 0',
                  border: isUser ? `1px solid ${theme.borderSoft}` : 'none',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 10,
                  color: theme.dim,
                  marginTop: 4,
                  paddingLeft: isUser ? 0 : 2,
                  paddingRight: isUser ? 2 : 0,
                }}
              >
                {formatTime(msg.createdAt)}
              </span>
            </div>
          );

        })}

        {/* Wind-down card (shown after a few messages) */}
        {messages.length >= 3 && (
          <div
            style={{
              background: theme.cardGrad,
              borderRadius: 18,
              padding: '20px 22px 22px',
              border: `1px solid ${theme.border}`,
              margin: '8px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ color: theme.accent }}>
                <QHIcon name={windDownIcon} size={16} />
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
                A soft wind-down · 9 min
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              {windDownSteps.map((step) => (
                <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: theme.iconChipBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: 600,
                      color: theme.accent,
                      flexShrink: 0,
                    }}
                  >
                    {step.num}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        fontFamily: FONT,
                        fontSize: 14,
                        fontWeight: 500,
                        color: theme.textSoft,
                      }}
                    >
                      {step.label}
                    </span>
                    <span
                      style={{
                        fontFamily: FONT,
                        fontSize: 12,
                        color: theme.dim,
                        marginLeft: 8,
                      }}
                    >
                      {step.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <QHButton variant="primary">
              <QHIcon name="play" size={16} />
              Begin · in Maya's voice
            </QHButton>
          </div>
        )}

        {/* Sending indicator */}
        {sending && (
          <div
            style={{
              alignSelf: 'flex-start',
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 14,
              color: theme.dim,
              padding: '4px 0',
            }}
          >
            Maya is thinking…
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        style={{
          padding: '12px 16px 20px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          background: theme.statusDark
            ? 'rgba(21,19,29,0.8)'
            : 'rgba(239,233,220,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: theme.surface,
            borderRadius: 28,
            padding: '8px 10px 8px 16px',
            border: `1px solid ${theme.borderSoft}`,
            boxShadow: theme.composerShadow,
          }}
        >
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              color: theme.muted,
              flexShrink: 0,
            }}
            aria-label="Voice input"
          >
            <QHIcon name="mic" size={20} />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type, or hold to speak…"
            disabled={!sessionId || loading}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: FONT,
              fontSize: 14.5,
              color: theme.text,
              padding: '6px 0',
            }}
          />

          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              color: theme.dim,
              flexShrink: 0,
            }}
            aria-label="Waveform"
          >
            <QHIcon name="waveform" size={20} />
          </button>

          {input.trim() && (
            <button
              onClick={sendMessage}
              disabled={sending}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: theme.accent,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.accentInk,
                flexShrink: 0,
                transition: 'opacity 0.18s',
                opacity: sending ? 0.5 : 1,
              }}
              aria-label="Send message"
            >
              <QHIcon name="send" size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
