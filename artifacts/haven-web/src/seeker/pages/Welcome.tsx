import React, { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQHTheme, FONT, SERIF, HAND } from '../lib/theme';
import QHIcon from '../components/QHIcon';
import QHButton from '../components/QHButton';
import LampGlow from '../components/LampGlow';

const FEATURES = [
  {
    icon: 'moon',
    title: 'Always here',
    desc: '2am, Tuesday lunch, before a meeting.',
  },
  {
    icon: 'heart',
    title: 'Trained by Maya',
    desc: 'A licensed therapist who reviews everything.',
  },
  {
    icon: 'leaf',
    title: 'Yours, privately',
    desc: 'Nothing leaves this app without you saying so.',
  },
] as const;

export default function Welcome() {
  const { theme } = useQHTheme();
  const navigate = useNavigate();
  const uid = useId();

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
          alignItems: 'center',
          padding: '64px 28px 48px',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 48,
          }}
        >
          <svg
            width={24}
            height={28}
            viewBox="0 0 24 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d={`M12 1 L22 7 L22 17 Q22 24 12 27 Q2 24 2 17 L2 7 Z`}
              fill={theme.accent}
              opacity={0.18}
              stroke={theme.accent}
              strokeWidth={1.5}
              id={`${uid}-shield`}
            />
          </svg>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 22,
              fontWeight: 400,
              color: theme.text,
              letterSpacing: '-0.01em',
            }}
          >
            Haven
          </span>
        </div>

        {/* Greeting */}
        <p
          style={{
            fontFamily: HAND,
            fontSize: 28,
            color: theme.accent,
            margin: '0 0 8px',
          }}
        >
          hi, you.
        </p>

        {/* Headline */}
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 34,
            fontWeight: 400,
            color: theme.text,
            margin: '0 0 14px',
            textAlign: 'center',
            lineHeight: 1.15,
          }}
        >
          We're glad you're here.
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 16,
            lineHeight: 1.55,
            color: theme.textSoft,
            textAlign: 'center',
            maxWidth: 340,
            margin: '0 0 40px',
          }}
        >
          Haven is for the slow nights, the hard mornings, and the small
          in-between moments — with a real therapist behind every word.
        </p>

        {/* Feature rows */}
        <div
          style={{
            width: '100%',
            maxWidth: 380,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            marginBottom: 44,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.icon}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: theme.iconChipBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: theme.accent,
                }}
              >
                <QHIcon name={f.icon} size={20} />
              </div>
              <div>
                <p
                  style={{
                    fontFamily: FONT,
                    fontSize: 15,
                    fontWeight: 600,
                    color: theme.text,
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {f.title}
                </p>
                <p
                  style={{
                    fontFamily: FONT,
                    fontSize: 13.5,
                    color: theme.muted,
                    margin: '2px 0 0',
                    lineHeight: 1.4,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ width: '100%', maxWidth: 380 }}>
          <QHButton onClick={() => navigate('/seeker/meet')}>
            Take the first step
          </QHButton>
        </div>

        {/* Pace note */}
        <p
          style={{
            fontFamily: FONT,
            fontSize: 13,
            color: theme.muted,
            margin: '16px 0 0',
            textAlign: 'center',
          }}
        >
          No rush. You can move at your pace.
        </p>
      </div>
    </div>
  );
}
