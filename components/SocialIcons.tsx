/**
 * Minimal, hand-drawn glyphs for the share row — evocative of each platform's
 * mark without tracing its actual logo artwork, in the same plain-SVG,
 * currentColor style as the rest of the site's icon-scale work.
 */

export function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M3.5 3.5 L16.5 16.5 M16.5 3.5 L3.5 16.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      {/* Bubble sits slightly above (10,10) so the tail's weight below it
          balances the icon's optical center — the other three glyphs are
          all centered on the viewBox exactly, this one has to fake it. */}
      <circle
        cx="10"
        cy="9.2"
        r="6.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M6.9 14.6 L5.1 17.3 L8.7 15.3 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Handset: a rounded bar rotated to a diagonal, centered on the same
          point as the bubble by construction rather than eyeballed. */}
      <rect
        x="8.8"
        y="5.9"
        width="2.4"
        height="6.6"
        rx="1.2"
        fill="currentColor"
        transform="rotate(45 10 9.2)"
      />
    </svg>
  );
}

export function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M11.6 17 V10.6 H13.7 L14 8.1 H11.6 V6.5 C11.6 5.8 11.8 5.3 12.8 5.3 H14.1 V3.1 C13.6 3 13 3 12.3 3 C10.6 3 9.5 4 9.5 6.2 V8.1 H7.5 V10.6 H9.5 V17 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <rect
        x="3.2"
        y="3.2"
        width="13.6"
        height="13.6"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="13.6" cy="6.4" r="1" fill="currentColor" />
    </svg>
  );
}
