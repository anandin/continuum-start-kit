import React from "react";
import { useQHTheme } from "../lib/theme";

interface MayaAvatarProps {
  size?: number;
  ring?: string;
}

export default function MayaAvatar({ size = 48, ring }: MayaAvatarProps) {
  const { mode } = useQHTheme();

  const isNight = mode === "night";
  const skin = isNight ? "#DBBFA8" : "#C8A68E";
  const hair = isNight ? "#3B2F42" : "#2A2034";
  const cloth = isNight ? "#E8A89C" : "#C8786B";
  const bgFill = isNight ? "#272338" : "#F4EFE3";
  const lipColor = isNight ? "#D48B7D" : "#B86A5E";

  const id = `maya-${size}`;
  const r = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx={r} cy={r} r={r} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        {/* Background */}
        <rect width={size} height={size} fill={bgFill} />

        {/* Hair back */}
        <ellipse cx={r} cy={r * 0.72} rx={r * 0.62} ry={r * 0.58} fill={hair} />

        {/* Face */}
        <ellipse cx={r} cy={r * 0.88} rx={r * 0.42} ry={r * 0.48} fill={skin} />

        {/* Hair front sweep */}
        <path
          d={`M${r * 0.52} ${r * 0.42} Q${r} ${r * 0.28} ${r * 1.42} ${r * 0.48} Q${r * 1.2} ${r * 0.3} ${r * 0.8} ${r * 0.32} Z`}
          fill={hair}
        />

        {/* Eyes */}
        <circle cx={r * 0.82} cy={r * 0.84} r={r * 0.045} fill={hair} />
        <circle cx={r * 1.18} cy={r * 0.84} r={r * 0.045} fill={hair} />

        {/* Mouth */}
        <path
          d={`M${r * 0.9} ${r * 1.04} Q${r} ${r * 1.12} ${r * 1.1} ${r * 1.04}`}
          stroke={lipColor}
          strokeWidth={r * 0.035}
          strokeLinecap="round"
          fill="none"
        />

        {/* Shoulders / clothing */}
        <ellipse
          cx={r}
          cy={size * 1.08}
          rx={r * 0.72}
          ry={r * 0.46}
          fill={cloth}
        />
      </g>

      {/* Ring */}
      {ring && (
        <circle
          cx={r}
          cy={r}
          r={r - 1.5}
          stroke={ring}
          strokeWidth={2.5}
          fill="none"
        />
      )}
    </svg>
  );
}
