import { DISPLAY, font } from "../fonts";
import { EVENT, label, wordmark } from "./brand";
import { THEMES } from "./themes";

/**
 * 1200 x 630 preview for the tool's own URL.
 *
 * Without this, sharing the site itself gets a blank thumbnail — the same
 * failure the brief calls out, just one level up. Rendered from the live
 * artwork rather than mocked up, so it can't drift from what the tool makes.
 */

const W = 1200;
const H = 630;
const PAD = 56;

export function renderPromo(
  ctx: CanvasRenderingContext2D,
  artifact: HTMLCanvasElement,
): void {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = THEMES.sunset.base;
  ctx.fillRect(0, 0, W, H);

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(255, 255, 255, 0.06)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const boxH = H - PAD * 2;
  const drawW = artifact.width * (boxH / artifact.height);

  ctx.save();
  ctx.beginPath();
  ctx.arc(PAD + drawW / 2, PAD + boxH / 2, boxH / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(artifact, PAD, PAD, drawW, boxH);
  ctx.restore();

  const x = PAD + drawW + 52;
  const colW = W - x - PAD;

  wordmark(ctx, x, 168, 40);
  label(ctx, `${EVENT.dates} · ${EVENT.place}`, x, 212, 19, {
    fill: "rgba(247, 243, 232, 0.6)",
    tracking: 2.8,
  });

  ctx.save();
  ctx.font = font(800, 58, DISPLAY, "Georgia, serif");
  ctx.fillStyle = THEMES.sunset.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("LESS NOISE.", x, 332);
  ctx.fillText("MORE SIGNAL.", x, 396);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(247, 243, 232, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 448);
  ctx.lineTo(x + colW, 448);
  ctx.stroke();
  ctx.restore();

  label(ctx, "DROP A PHOTO. GET YOUR FRAME.", x, 494, 19, {
    fill: "rgba(247, 243, 232, 0.75)",
    weight: 600,
    tracking: 2.4,
  });

  label(ctx, EVENT.hashtag, x, 534, 21, {
    fill: THEMES.sunset.mark,
    weight: 600,
    tracking: 2.2,
  });
}

export const PROMO_SIZE = { width: W, height: H };
