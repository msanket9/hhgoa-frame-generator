/**
 * HH Goa visual identity for the generated artifact.
 *
 * The app chrome is deliberately neutral; all of the brand's saturation lives
 * here, inside the thing the user actually posts.
 */

import qrcode from "qrcode-generator";

import { DEVANAGARI, DISPLAY, MONO, font } from "../fonts";
import { THEMES, type Palette } from "./themes";

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
export function rampLinear(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, palette.ramp[0]);
  g.addColorStop(0.45, palette.ramp[1]);
  g.addColorStop(1, palette.ramp[2]);
  return g;
}

/** Conic variant so a ring picks up the full ramp as it goes around. */
export function rampConic(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  cx: number,
  cy: number,
  rotation = -Math.PI / 2,
): CanvasGradient {
  const [a, b, c] = palette.ramp;
  const g = ctx.createConicGradient(rotation, cx, cy);
  g.addColorStop(0, c);
  g.addColorStop(0.25, b);
  g.addColorStop(0.5, a);
  g.addColorStop(0.75, b);
  g.addColorStop(1, c);
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
/** Applies an alpha to a hex colour; passes rgba() through untouched. */
export function withAlpha(colour: string, alpha: number): string {
  if (!colour.startsWith("#")) return colour;
  const hex = colour.slice(1);
  const n =
    hex.length === 3
      ? hex.split("").map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${alpha})`;
}

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
  opts: { rays?: boolean; ringColor?: string; palette?: Palette } = {},
): void {
  const { rays = true, ringColor = THEMES.sunset.ink } = opts;

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
  const palette = opts.palette ?? THEMES.sunset;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = rampLinear(ctx, palette, cx, cy - r, cx, cy + r);
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
  const fill = opts.fill ?? THEMES.sunset.ink;
  const goaFill = opts.goaFill ?? THEMES.sunset.mark;

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
    fill = THEMES.sunset.ink,
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
 * QR code, drawn module by module onto the canvas.
 *
 * Deliberately small. A QR on a social image is close to unscannable in
 * practice — you'd need a second device to scan your own timeline — so it
 * earns its place as ID-card furniture and as a link home when someone
 * screenshots the image, not as the centrepiece.
 *
 * Error correction M plus a real quiet zone, because it gets rendered over a
 * dark card and re-encoded as JPEG for sharing.
 */
export function drawQr(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  opts: { dark?: string; light?: string; pad?: number; radius?: number } = {},
): void {
  const {
    dark = THEMES.sunset.deep,
    light = "#f7f3e8",
    pad = size * 0.09,
    radius = 12,
  } = opts;

  let modules: { count: number; isDark: (r: number, c: number) => boolean };
  try {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    modules = {
      count: qr.getModuleCount(),
      isDark: (r, c) => qr.isDark(r, c),
    };
  } catch {
    return; // never let a QR failure take the whole card down
  }

  ctx.save();

  // Light plate + quiet zone. Without it the code sits directly on the card
  // and scanners lose the finder patterns.
  ctx.fillStyle = light;
  roundRect(ctx, x, y, size, size, radius);
  ctx.fill();

  const inner = size - pad * 2;
  const cell = inner / modules.count;

  // Snap every module to whole-pixel edges, deriving each rect from the *next*
  // module's boundary. Padding the size instead (ceil + a bit) overdraws each
  // module by ~20%, which visually still looks like a QR but merges
  // neighbouring modules and makes it undecodable — which is exactly what
  // happened the first time.
  ctx.fillStyle = dark;
  for (let r = 0; r < modules.count; r++) {
    const y0 = Math.round(y + pad + r * cell);
    const y1 = Math.round(y + pad + (r + 1) * cell);
    for (let c = 0; c < modules.count; c++) {
      if (!modules.isDark(r, c)) continue;
      const x0 = Math.round(x + pad + c * cell);
      const x1 = Math.round(x + pad + (c + 1) * cell);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  ctx.restore();
}

/**
 * Empty-state affordance drawn into the photo window.
 *
 * Watching someone use this, the first thing they tapped was the frame itself —
 * it's the biggest thing on screen and it says "your photo", so of course it
 * reads as the button. A label alone wasn't enough; it needs to look tappable.
 */
export function emptyPrompt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 1,
  palette: Palette = THEMES.sunset,
): void {
  const r = 62 * scale;

  ctx.save();

  ctx.beginPath();
  ctx.arc(cx, cy - 14 * scale, r, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette.ink, 0.1);
  ctx.fill();
  ctx.lineWidth = 3 * scale;
  ctx.setLineDash([10 * scale, 9 * scale]);
  ctx.strokeStyle = "rgba(247, 243, 232, 0.45)";
  ctx.stroke();
  ctx.setLineDash([]);

  // Plus glyph.
  const arm = 22 * scale;
  ctx.strokeStyle = withAlpha(palette.ink, 0.85);
  ctx.lineWidth = 6 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy - 14 * scale);
  ctx.lineTo(cx + arm, cy - 14 * scale);
  ctx.moveTo(cx, cy - 14 * scale - arm);
  ctx.lineTo(cx, cy - 14 * scale + arm);
  ctx.stroke();

  ctx.restore();

  label(ctx, "ADD YOUR PHOTO", cx, cy + 100 * scale, 26 * scale, {
    fill: withAlpha(palette.ink, 0.78),
    weight: 600,
    tracking: 4 * scale,
    align: "center",
  });
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
