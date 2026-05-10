import React from 'react';
import { useQHTheme } from '../lib/theme';

interface LampGlowProps {
  top?: number;
  x?: string;
  size?: number;
  color?: string;
}

export default function LampGlow({
  top = -80,
  x = '50%',
  size = 420,
  color,
}: LampGlowProps) {
  const { theme } = useQHTheme();
  const fill = color ?? theme.glowRGBA;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top,
        left: x,
        transform: 'translateX(-50%)',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${fill} 0%, transparent 70%)`,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
