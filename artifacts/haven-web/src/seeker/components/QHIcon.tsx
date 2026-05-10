import React from "react";

const PATHS: Record<string, string> = {
  home: "M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z M9 21V14h6v7",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z",
  chart: "M18 20V10 M12 20V4 M6 20v-6",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  plus: "M12 5v14 M5 12h14",
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  mic: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  leaf: "M17 8C8 10 5.9 16.17 3.82 21.34 M17 8A5 5 0 0 1 22 3c-1 4-3.22 6.38-5 8z M5.24 16c.83-1.48 2.16-2.74 3.76-3.5",
  heart:
    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z",
  arrow: "M5 12h14 M12 5l7 7-7 7",
  check: "M20 6L9 17l-5-5",
  play: "M5 3l14 9-14 9V3z",
  pause: "M6 4h4v16H6z M14 4h4v16h-4z",
  close: "M18 6L6 18 M6 6l12 12",
  sparkle:
    "M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z",
  pencil: "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  phone:
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  calendar:
    "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18",
  waveform: "M2 12h2 M6 8v8 M10 5v14 M14 8v8 M18 10v4 M22 12h0",
  target:
    "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0z M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0z M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0z",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",
  chevR: "M9 18l6-6-6-6",
  chevD: "M6 9l6 6 6-6",
  quote:
    "M3 21c3-3 5-6 5-10 0 0-1-1-3-1s-3 2-3 4c0 2.5 2 4 4 3 M17 21c3-3 5-6 5-10 0 0-1-1-3-1s-3 2-3 4c0 2.5 2 4 4 3",
};

interface QHIconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export default function QHIcon({
  name,
  size = 22,
  className,
  strokeWidth = 1.7,
}: QHIconProps) {
  const d = PATHS[name];
  if (!d) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {d.split(" M").map((seg, i) => (
        <path key={i} d={i === 0 ? seg : `M${seg}`} />
      ))}
    </svg>
  );
}
