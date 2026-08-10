/**
 * Hand-coded vector illustration for the site chrome — palms, a beach hut,
 * waves, a postmark. Deliberately silhouette/geometric rather than attempting
 * detailed or character art: that's a quality bar (the kind of thing a
 * commissioned illustrator or an image model produces) this file isn't
 * trying to match. Every shape here is plain SVG, so it's crisp at any size
 * and costs nothing to load.
 */

import { useId } from "react";

export function PalmTree({
  className,
  color = "var(--green)",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 160"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M58 160 C 54 120, 50 90, 62 56"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <g fill={color}>
        <path d="M62 56 C 40 44, 18 46, 4 32 C 24 30, 46 34, 62 48 Z" />
        <path d="M62 56 C 46 32, 44 10, 56 -4 C 62 16, 62 38, 66 52 Z" />
        <path d="M62 56 C 78 30, 100 22, 118 8 C 106 28, 86 40, 66 50 Z" />
        <path d="M62 56 C 84 48, 106 52, 120 40 C 106 56, 84 60, 64 60 Z" />
        <path d="M62 56 C 50 40, 32 34, 20 18 C 38 22, 54 32, 64 48 Z" />
      </g>
    </svg>
  );
}

export function BeachHut({
  className,
  wall = "var(--pink)",
  roof = "var(--green)",
}: {
  className?: string;
  wall?: string;
  roof?: string;
}) {
  return (
    <svg
      viewBox="0 0 140 120"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path d="M8 60 L70 12 L132 60 L120 60 L120 108 L20 108 L20 60 Z" fill={roof} />
      <rect x="30" y="60" width="80" height="48" fill={wall} />
      <rect x="58" y="76" width="24" height="32" fill="var(--paper)" />
      <path d="M0 60 L70 8 L140 60" stroke={roof} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="30" y="60" width="80" height="8" fill="var(--paper)" opacity="0.5" />
    </svg>
  );
}

export function Waves({
  className,
  color = "var(--green)",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 28"
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 14 Q 12.5 4, 25 14 T 50 14 T 75 14 T 100 14 T 125 14 T 150 14 T 175 14 T 200 14"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M0 21 Q 12.5 13, 25 21 T 50 21 T 75 21 T 100 21 T 125 21 T 150 21 T 175 21 T 200 21"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

/**
 * Circular postmark badge with text set on the arc via SVG `<textPath>` —
 * the same "seal" idea as the exported frame's ring, ported to the site UI.
 */
export function Postmark({
  label = "FRAME IN GOA",
  sub = "OCT 28–31 2026",
  className,
  size = 96,
}: {
  label?: string;
  sub?: string;
  className?: string;
  size?: number;
}) {
  // Two independent instances on one page would otherwise share the id and
  // break the second textPath reference, so it can't be a fixed string.
  const id = useId();
  // Fixed-width text on a fixed-radius circle clips once the copy runs long
  // (e.g. "ADDRESS UNKNOWN"), so size down rather than let it overflow.
  const subFontSize = sub.length > 14 ? 4.8 : sub.length > 10 ? 5.6 : 6.5;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <path id={id} d="M 10,50 A 40,40 0 1 1 90,50" />
      </defs>
      <circle cx="50" cy="50" r="46" fill="var(--paper)" stroke="var(--pink)" strokeWidth="2" strokeDasharray="4 3" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--green)" strokeWidth="1.5" />
      <text fill="var(--green)" fontSize="8.2" fontWeight={700} letterSpacing="1.5">
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
      <text
        x="50"
        y="58"
        fill="var(--pink)"
        fontSize={subFontSize}
        fontWeight={700}
        textAnchor="middle"
        letterSpacing="0.5"
      >
        {sub}
      </text>
      <path d="M32 66 L50 74 L68 66" stroke="var(--gold)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Sunburst — the same motif the exported card uses, ported to plain SVG. */
export function Sunburst({ className, size = 40 }: { className?: string; size?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => (i * 360) / 8);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sunburst-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pink)" />
          <stop offset="45%" stopColor="var(--orange)" />
          <stop offset="100%" stopColor="var(--gold)" />
        </linearGradient>
      </defs>
      {rays.map((deg) => (
        <line
          key={deg}
          x1={50 + 30 * Math.sin((deg * Math.PI) / 180)}
          y1={50 - 30 * Math.cos((deg * Math.PI) / 180)}
          x2={50 + 42 * Math.sin((deg * Math.PI) / 180)}
          y2={50 - 42 * Math.cos((deg * Math.PI) / 180)}
          stroke="var(--paper)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ))}
      <circle cx="50" cy="50" r="24" fill="url(#sunburst-grad)" />
    </svg>
  );
}

/** Envelope glyph for the primary CTA — the "mail" motif from the brief. */
export function EnvelopeIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 18" width={size} height={size * 0.75} className={className} aria-hidden="true">
      <rect x="1" y="1" width="22" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 2.5 L12 10 L22 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
