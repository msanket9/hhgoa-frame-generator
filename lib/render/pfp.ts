import { DEVANAGARI, DISPLAY, MONO, font } from "../fonts";
import {
  C,
  DEVANAGARI_RANGE,
  EVENT,
  arcText,
  emptyPrompt,
  sunsetConic,
  sunsetGradient,
} from "./brand";
import { drawPhoto } from "./photo";
import type { RenderState } from "./types";

/**
 * Format A — profile frame, 1080 × 1080.
 *
 * Built around one constraint that decides everything: X renders avatars as
 * circles, so anything in the corners is thrown away, and the whole thing has
 * to still read at ~48px in a timeline. That rules out a thin editorial frame
 * (invisible when small) and rules out corner ornament (clipped). What
 * survives is a high-contrast annular band — a seal.
 *
 * The photo underneath is never cropped into a small window or tinted; the
 * brief is explicit that the frame wraps the photo rather than competing
 * with it.
 */

const SIZE = 1080;
const CENTER = SIZE / 2;

const R_OUTER = 540; // inscribed circle — the avatar's visible edge
const R_INNER = 448; // photo window
const R_TEXT = 495; // ring centreline

export function renderPfp(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
): void {
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Corners survive only when the PNG is used somewhere square. Deeper green
  // than the band so that usage looks deliberate rather than like a mistake.
  ctx.fillStyle = C.greenDeep;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawRingBand(ctx);
  drawPhotoWindow(ctx, state);
  drawRingEdges(ctx);
  drawRingText(ctx);
  drawSideBeads(ctx);
}

function drawRingBand(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, R_OUTER, 0, Math.PI * 2);
  ctx.fillStyle = C.green;
  ctx.fill();
  ctx.restore();
}

function drawPhotoWindow(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, R_INNER, 0, Math.PI * 2);
  ctx.clip();

  if (state.bitmap) {
    drawPhoto(
      ctx,
      state.bitmap,
      state.transform,
      CENTER - R_INNER,
      CENTER - R_INNER,
      R_INNER * 2,
      R_INNER * 2,
    );
  } else {
    ctx.fillStyle = C.greenDeep;
    ctx.fillRect(CENTER - R_INNER, CENTER - R_INNER, R_INNER * 2, R_INNER * 2);
    emptyPrompt(ctx, CENTER, CENTER, 1.15);
  }

  ctx.restore();
}

function drawRingEdges(ctx: CanvasRenderingContext2D): void {
  ctx.save();

  // The bright inner edge is what separates photo from frame at small sizes,
  // so it carries the full sunset ramp.
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, R_INNER + 5, 0, Math.PI * 2);
  ctx.lineWidth = 10;
  ctx.strokeStyle = sunsetConic(ctx, CENTER, CENTER);
  ctx.stroke();

  // Outer hairline tightens the silhouette against light backgrounds.
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, R_OUTER - 4, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(247, 243, 232, 0.30)";
  ctx.stroke();

  ctx.restore();
}

function drawRingText(ctx: CanvasRenderingContext2D): void {
  // Latin and Devanagari in one arc: no single face covers both, so the
  // wordmark is drawn with per-character font and colour overrides.
  const latin = font(800, 52, DISPLAY, "Georgia, serif");
  const deva = font(700, 46, DEVANAGARI, "sans-serif");

  arcText(
    ctx,
    `${EVENT.name} ${EVENT.goa}`,
    CENTER,
    CENTER,
    R_TEXT,
    -Math.PI / 2,
    {
      font: latin,
      fill: C.cream,
      letterSpacing: 4,
      outward: true,
      fontFor: (ch) => (DEVANAGARI_RANGE.test(ch) ? deva : undefined),
      fillFor: (ch) => (DEVANAGARI_RANGE.test(ch) ? C.yellow : undefined),
      // Devanagari's optical centre sits above the Latin cap centre.
      offsetFor: (ch) => (DEVANAGARI_RANGE.test(ch) ? 5 : 0),
    },
  );

  arcText(ctx, EVENT.dates, CENTER, CENTER, R_TEXT, Math.PI / 2, {
    font: font(600, 27, MONO, "ui-monospace, monospace"),
    fill: "rgba(247, 243, 232, 0.82)",
    letterSpacing: 5,
    outward: false,
  });
}

/** Beads at 3 and 9 o'clock, separating the two arcs. */
function drawSideBeads(ctx: CanvasRenderingContext2D): void {
  for (const angle of [0, Math.PI]) {
    const x = CENTER + Math.cos(angle) * R_TEXT;
    const y = CENTER + Math.sin(angle) * R_TEXT;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fillStyle = sunsetGradient(ctx, x, y - 13, x, y + 13);
    ctx.fill();
    ctx.restore();
  }
}
