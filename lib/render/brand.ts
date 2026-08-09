/**
 * HH Goa visual identity for the generated artifact.
 *
 * The app chrome is deliberately neutral; all of the brand's saturation lives
 * here, inside the thing the user actually posts.
 */

import { DEVANAGARI, DISPLAY, MONO, font } from "../fonts";

export const C = {
  green: "#0b4b2c",
  greenDeep: "#073620",
  cream: "#f7f3e8",
  yellow: "#ffd400",
  pink: "#ff1f6b",
  orange: "#e8622c",
  gold: "#f9a825",
  ink: "#10241a",
  white: "#ffffff",
} as const;

export const EVENT = {
  name: "HACKER HOUSE",
  goa: "गोवा",
  dates: "OCT 28–31 · 2026",
  place: "GOA, INDIA",
  tagline: "LESS NOISE. MORE SIGNAL.",
  hashtag: "#FrameInGoa",
  studio: "2:47 PM STUDIO",
  coords: "15.2993° N · 74.1240° E",
} as const;

/**
 * The Goa sunset, as a reusable ramp. Pink at the top through orange to gold —
 * the sequence the sky actually runs at Arambol, and the through-line that
 * makes the ring, the sun disc and the card accents read as one system.
 */
export function sunsetGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, C.pink);
  g.addColorStop(0.45, C.orange);
  g.addColorStop(1, C.gold);
  return g;
}

/** Conic variant so a ring picks up the full ramp as it goes around. */
export function sunsetConic(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rotation = -Math.PI / 2,
): CanvasGradient {
  const g = ctx.createConicGradient(rotation, cx, cy);
  g.addColorStop(0, C.gold);
  g.addColorStop(0.25, C.orange);
  g.addColorStop(0.5, C.pink);
  g.addColorStop(0.75, C.orange);
  g.addColorStop(1, C.gold);
  return g;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Draws text letter-by-letter along a circular arc.
 *
 * Canvas has no text-on-path, so each glyph is placed at its own rotation.
 * Advance is measured per character and the pen is moved by half the current
 * glyph plus half the next, which keeps the spacing optically even instead of
 * bunching on wide letters.
 */
export const DEVANAGARI_RANGE = /[ऀ-ॿ]/;

/**
 * Splits text for arc layout, keeping Devanagari runs whole.
 *
 * Arc text has to place glyphs one at a time to rotate them, but Devanagari is
 * a complex script — matras and conjuncts shape against their base consonant,
 * so drawing गोवा code point by code point scatters the vowel marks into
 * separate floating glyphs. Latin has no such coupling and splits fine.
 */
export function arcTokens(text: string): string[] {
  const out: string[] = [];
  let run = "";
  for (const ch of text) {
    if (DEVANAGARI_RANGE.test(ch)) {
      run += ch;
    } else {
      if (run) {
        out.push(run);
        run = "";
      }
      out.push(ch);
    }
  }
  if (run) out.push(run);
  return out;
}

export function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  centerAngle: number,
  opts: {
    font: string;
    fill: string | CanvasGradient;
    letterSpacing?: number;
    /** true = glyph tops point outward (top arc); false = inward (bottom). */
    outward?: boolean;
    /**
     * Per-character overrides. Needed because the lockup mixes Latin and
     * Devanagari, and no single face covers both — the Latin display font has
     * no Devanagari glyphs and vice versa.
     */
    fontFor?: (ch: string) => string | undefined;
    fillFor?: (ch: string) => string | undefined;
    /** Per-character vertical nudge, for baseline mismatches between scripts. */
    offsetFor?: (ch: string) => number;
  },
): void {
  const { letterSpacing = 0, outward = true } = opts;
  // Tokens, not code points — see arcTokens.
  const chars = arcTokens(text);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontOf = (ch: string) => opts.fontFor?.(ch) ?? opts.font;

  const widths = chars.map((ch) => {
    ctx.font = fontOf(ch);
    return ctx.measureText(ch).width + letterSpacing;
  });
  const totalAngle = widths.reduce((a, b) => a + b, 0) / radius;

  // Bottom-arc text runs the opposite way around the circle so it reads
  // left-to-right to a viewer rather than upside down.
  const dir = outward ? 1 : -1;
  let angle = centerAngle - (dir * totalAngle) / 2;

  chars.forEach((ch, i) => {
    const step = widths[i] / radius;
    angle += (dir * step) / 2;

    ctx.save();
    ctx.font = fontOf(ch);
    ctx.fillStyle = opts.fillFor?.(ch) ?? opts.fill;
    ctx.translate(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.rotate(angle + (outward ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(ch, 0, opts.offsetFor?.(ch) ?? 0);
    ctx.restore();

    angle += (dir * step) / 2;
  });

  ctx.restore();
}

/** Measures arc text without drawing, for layout decisions. */
export function measureArcAngle(
  ctx: CanvasRenderingContext2D,
  text: string,
  radius: number,
  fontStr: string,
  letterSpacing = 0,
): number {
  ctx.save();
  ctx.font = fontStr;
  const w = [...text].reduce(
    (a, ch) => a + ctx.measureText(ch).width + letterSpacing,
    0,
  );
  ctx.restore();
  return w / radius;
}

/**
 * The sun disc — our one ownable ornament.
 *
 * A solid sunset-gradient circle that sits *on* the ring like a bead on a
 * necklace, breaking it rather than decorating it. References both the Goa
 * sunset and the "2:47 PM" in the studio's name.
 */
export function sunDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  opts: { rays?: boolean; ringColor?: string } = {},
): void {
  const { rays = true, ringColor = C.cream } = opts;

  if (rays) {
    ctx.save();
    ctx.strokeStyle = ringColor;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, r * 0.11);
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 1.42, cy + Math.sin(a) * r * 1.42);
      ctx.lineTo(cx + Math.cos(a) * r * 1.78, cy + Math.sin(a) * r * 1.78);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = sunsetGradient(ctx, cx, cy - r, cx, cy + r);
  ctx.fill();
  ctx.restore();
}

/**
 * "HACKER HOUSE गोवा" lockup, drawn left-aligned from (x, y) on the text
 * baseline. Returns total width so callers can center it.
 */
export function wordmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opts: { fill?: string | CanvasGradient; goaFill?: string } = {},
): number {
  const fill = opts.fill ?? C.cream;
  const goaFill = opts.goaFill ?? C.yellow;

  const mainFont = font(800, size, DISPLAY, "Georgia, serif");
  const goaFont = font(700, size * 0.92, DEVANAGARI, "sans-serif");
  const gap = size * 0.28;

  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.font = mainFont;
  const mainW = ctx.measureText(EVENT.name).width;
  ctx.fillStyle = fill;
  ctx.fillText(EVENT.name, x, y);

  ctx.font = goaFont;
  const goaW = ctx.measureText(EVENT.goa).width;
  ctx.fillStyle = goaFill;
  // Devanagari sits optically high against Latin caps; nudge it down.
  ctx.fillText(EVENT.goa, x + mainW + gap, y + size * 0.04);

  ctx.restore();
  return mainW + gap + goaW;
}

export function measureWordmark(
  ctx: CanvasRenderingContext2D,
  size: number,
): number {
  ctx.save();
  ctx.font = font(800, size, DISPLAY, "Georgia, serif");
  const mainW = ctx.measureText(EVENT.name).width;
  ctx.font = font(700, size * 0.92, DEVANAGARI, "sans-serif");
  const goaW = ctx.measureText(EVENT.goa).width;
  ctx.restore();
  return mainW + size * 0.28 + goaW;
}

/** Mono label with positive tracking, the detail voice throughout. */
export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  opts: {
    fill?: string | CanvasGradient;
    weight?: number;
    tracking?: number;
    align?: CanvasTextAlign;
  } = {},
): number {
  const {
    fill = C.cream,
    weight = 400,
    tracking = size * 0.14,
    align = "left",
  } = opts;

  ctx.save();
  ctx.font = font(weight, size, MONO, "ui-monospace, monospace");
  ctx.fillStyle = fill;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const chars = [...text];
  const total =
    chars.reduce((a, ch) => a + ctx.measureText(ch).width + tracking, 0) -
    tracking;

  let penX = x;
  if (align === "center") penX = x - total / 2;
  else if (align === "right") penX = x - total;

  for (const ch of chars) {
    ctx.fillText(ch, penX, y);
    penX += ctx.measureText(ch).width + tracking;
  }

  ctx.restore();
  return total;
}

export function measureLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  weight = 400,
  tracking = size * 0.14,
): number {
  ctx.save();
  ctx.font = font(weight, size, MONO, "ui-monospace, monospace");
  const total =
    [...text].reduce((a, ch) => a + ctx.measureText(ch).width + tracking, 0) -
    tracking;
  ctx.restore();
  return total;
}

/**
 * Soft dark scrim behind text sitting over photography.
 *
 * Required, not decorative: the brief promises real photos, and without this
 * the lockup vanishes against a bright sky or a white shirt.
 */
export function scrim(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opacity = 0.6,
  from: "bottom" | "top" = "bottom",
): void {
  const g =
    from === "bottom"
      ? ctx.createLinearGradient(0, y + h, 0, y)
      : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(4, 20, 12, ${opacity})`);
  g.addColorStop(0.55, `rgba(4, 20, 12, ${opacity * 0.45})`);
  g.addColorStop(1, "rgba(4, 20, 12, 0)");
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
