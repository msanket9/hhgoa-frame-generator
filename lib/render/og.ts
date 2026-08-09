import { DISPLAY, font } from "../fonts";
import { EVENT, label, rampLinear, wordmark } from "./brand";
import { THEMES } from "./themes";
import type { Details } from "./types";

/**
 * 1200 x 630 link-preview variant.
 *
 * X's summary_large_image card centre-crops to roughly 2:1, so posting the
 * 1080x1080 as the OG image would slice the top and bottom off the ring. This
 * composites the finished artifact into a proper 2:1 frame instead, which is
 * the difference between a card that sells the graphic and the "blank or
 * default thumbnail" failure the brief calls out.
 */

const W = 1200;
const H = 630;
const PAD = 56;

export function renderOg(
  ctx: CanvasRenderingContext2D,
  artifact: HTMLCanvasElement,
  details: Details,
): void {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = THEMES.sunset.base;
  ctx.fillRect(0, 0, W, H);

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(255, 255, 255, 0.06)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.20)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Artifact, fitted to the available height and left-aligned.
  const boxH = H - PAD * 2;
  const scale = boxH / artifact.height;
  const drawW = artifact.width * scale;

  const isSquare = artifact.width === artifact.height;

  ctx.save();
  if (isSquare) {
    // The PFP's corners are a slightly different green from this backdrop, so
    // drawing it square leaves a visible tonal box. Clip to the circle the
    // frame is designed around instead.
    ctx.beginPath();
    ctx.arc(PAD + drawW / 2, PAD + boxH / 2, boxH / 2, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.drawImage(artifact, PAD, PAD, drawW, boxH);
  ctx.restore();

  const textX = PAD + drawW + 52;
  const textW = W - textX - PAD;

  wordmark(ctx, textX, 176, 40);

  label(ctx, `${EVENT.dates}`, textX, 220, 20, {
    fill: "rgba(247, 243, 232, 0.6)",
    tracking: 3,
  });

  // Name, shrunk to fit the remaining column rather than clipped.
  const name = (details.name.trim() || "A builder").toUpperCase();
  let size = 62;
  ctx.save();
  ctx.font = font(800, size, DISPLAY, "Georgia, serif");
  while (ctx.measureText(name).width > textW && size > 26) {
    size -= 2;
    ctx.font = font(800, size, DISPLAY, "Georgia, serif");
  }
  ctx.fillStyle = THEMES.sunset.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(name, textX, 340);
  ctx.restore();

  if (details.title.trim()) {
    label(ctx, details.title.trim().toUpperCase(), textX, 388, 22, {
      fill: rampLinear(ctx, THEMES.sunset, textX, 366, textX + textW, 388),
      weight: 600,
      tracking: 3,
    });
  }

  ctx.save();
  ctx.strokeStyle = "rgba(247, 243, 232, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(textX, 440);
  ctx.lineTo(textX + textW, 440);
  ctx.stroke();
  ctx.restore();

  label(ctx, EVENT.tagline, textX, 486, 20, {
    fill: "rgba(247, 243, 232, 0.72)",
    weight: 600,
    tracking: 2.6,
  });

  label(ctx, EVENT.hashtag, textX, 528, 22, {
    fill: THEMES.sunset.mark,
    weight: 600,
    tracking: 2.4,
  });
}

export const OG_SIZE = { width: W, height: H };
