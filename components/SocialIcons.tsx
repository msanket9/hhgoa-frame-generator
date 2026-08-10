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
      <path
        d="M4 17 L4.9 13.4 A6.5 6.5 0 1 1 7.4 15.6 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M7.7 7.8 C7.5 7.2 7.2 7.2 7 7.2 C6.7 7.2 6.4 7.4 6.2 7.7 C6 8 5.9 8.4 6.1 9 C6.4 9.9 7.1 10.9 7.9 11.6 C8.7 12.3 9.7 12.8 10.6 12.9 C11.1 13 11.5 12.8 11.8 12.5 C12 12.3 12.1 12 12 11.8 C11.9 11.5 11.3 11.1 11 11 C10.8 10.9 10.6 10.9 10.4 11.1 C10.3 11.2 10.1 11.4 10 11.5 C9.9 11.6 9.7 11.6 9.5 11.5 C9 11.3 8.5 10.9 8.1 10.5 C7.7 10.1 7.4 9.6 7.2 9.1 C7.1 8.9 7.1 8.7 7.2 8.6 C7.3 8.5 7.5 8.3 7.6 8.2 C7.7 8 7.8 7.9 7.7 7.8 Z"
        fill="currentColor"
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
