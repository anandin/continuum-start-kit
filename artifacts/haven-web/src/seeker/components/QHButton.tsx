import React, { type ButtonHTMLAttributes } from 'react';
import { useQHTheme, FONT } from '../lib/theme';

type Variant = 'primary' | 'ghost';

interface QHButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export default function QHButton({
  variant = 'primary',
  style,
  children,
  ...rest
}: QHButtonProps) {
  const { theme } = useQHTheme();

  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 52,
    borderRadius: 26,
    fontSize: 16,
    fontWeight: 600,
    fontFamily: FONT,
    cursor: 'pointer',
    transition: 'opacity 0.18s, transform 0.18s',
    border: 'none',
  };

  const variants: Record<Variant, React.CSSProperties> = {
    primary: {
      background: theme.accent,
      color: theme.accentInk,
      boxShadow: theme.btnShadow,
    },
    ghost: {
      background: 'transparent',
      color: theme.accent,
      border: `1.5px solid ${theme.border}`,
      boxShadow: 'none',
    },
  };

  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}
