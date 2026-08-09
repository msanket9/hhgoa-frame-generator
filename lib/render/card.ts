import { DISPLAY, font } from "../fonts";
import {
  C,
  EVENT,
  emptyPrompt,
  label,
  measureLabel,
  roundRect,
  scrim,
  sunDisc,
  sunsetGradient,
  wordmark,
} from "./brand";
import { drawPhoto } from "./photo";
import type { RenderState } from "./types";

/**
 * Format B — builder ID, 1080 × 1350.
 *
 * 4:5 because that's the tallest ratio X shows uncropped in-feed; a 1:1 card
 * wastes vertical space and a taller one gets clipped.
 *
 * Laid out as a badge: identity block on a photo, credentials below, event
 * furniture top and bottom. Everything sits on a strict 72px margin so the
 * fields read as a record rather than a poster.
 */

const W = 1080;
const H = 1350;
const M = 72; // margin
const INNER = W - M * 2; // 936

const PHOTO_Y = 236;
const PHOTO_H = 780;

export function renderCard(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
): void {
  ctx.clearRect(0, 0, W, H);

  drawBackground(ctx);
  drawHeader(ctx);
  drawPhotoPanel(ctx, state);
  drawIdentity(ctx, state);
  drawFooter(ctx, state);
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = C.green;
  ctx.fillRect(0, 0, W, H);

  // Faint vertical lift so the flat green doesn't band on phone screens.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(255, 255, 255, 0.05)");
  g.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.16)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawHeader(ctx: CanvasRenderingContext2D): void {
  wordmark(ctx, M, 132, 54);

  label(ctx, `${EVENT.dates} · ${EVENT.place}`, M, 180, 24, {
    fill: "rgba(247, 243, 232, 0.62)",
    tracking: 3.4,
  });

  sunDisc(ctx, W - M - 34, 118, 30, { ringColor: "rgba(247,243,232,0.5)" });

  ctx.save();
  ctx.strokeStyle = "rgba(247, 243, 232, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, 208);
  ctx.lineTo(W - M, 208);
  ctx.stroke();
  ctx.restore();
}

function drawPhotoPanel(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
): void {
  ctx.save();
  roundRect(ctx, M, PHOTO_Y, INNER, PHOTO_H, 28);
  ctx.clip();

  if (state.bitmap) {
    drawPhoto(ctx, state.bitmap, state.transform, M, PHOTO_Y, INNER, PHOTO_H);
  } else {
    ctx.fillStyle = C.greenDeep;
    ctx.fillRect(M, PHOTO_Y, INNER, PHOTO_H);
    emptyPrompt(ctx, W / 2, PHOTO_Y + PHOTO_H / 2, 1.15);
  }

  // Scrim carries the overlaid label across any photo — bright sky, white
  // shirt, blown-out window, all of which turn up in real uploads.
  scrim(ctx, M, PHOTO_Y + PHOTO_H - 190, INNER, 190, 0.72);
  ctx.restore();

  // Corner registration marks — the detail that makes it read as a credential.
  drawCornerTicks(ctx, M, PHOTO_Y, INNER, PHOTO_H);

  label(ctx, "VERIFIED BUILDER", M + 34, PHOTO_Y + PHOTO_H - 44, 22, {
    fill: C.yellow,
    weight: 600,
    tracking: 4.5,
  });

  ctx.save();
  ctx.strokeStyle = "rgba(247, 243, 232, 0.26)";
  ctx.lineWidth = 2;
  roundRect(ctx, M, PHOTO_Y, INNER, PHOTO_H, 28);
  ctx.stroke();
  ctx.restore();
}

function drawCornerTicks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const len = 26;
  const inset = 22;
  ctx.save();
  ctx.strokeStyle = "rgba(247, 243, 232, 0.55)";
  ctx.lineWidth = 3;
  ctx.lineCap = "square";

  const corners: [number, number, number, number][] = [
    [x + inset, y + inset, 1, 1],
    [x + w - inset, y + inset, -1, 1],
    [x + inset, y + h - inset, 1, -1],
    [x + w - inset, y + h - inset, -1, -1],
  ];

  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawIdentity(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
): void {
  const { name, title, role, stack } = state.details;

  const displayName = (name.trim() || "YOUR NAME").toUpperCase();

  // Shrink to fit rather than truncating — a clipped name on your own ID card
  // reads as broken, and long names are common.
  let size = 82;
  ctx.save();
  ctx.font = font(800, size, DISPLAY, "Georgia, serif");
  while (ctx.measureText(displayName).width > INNER && size > 40) {
    size -= 2;
    ctx.font = font(800, size, DISPLAY, "Georgia, serif");
  }
  ctx.fillStyle = C.cream;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(displayName, M, 1104);
  ctx.restore();

  if (title.trim()) {
    const t = title.trim().toUpperCase();
    const w = measureLabel(ctx, t, 28, 600, 4);
    label(ctx, t, M, 1152, 28, {
      fill: sunsetGradient(ctx, M, 1130, M + w, 1152),
      weight: 600,
      tracking: 4,
    });
  }

  const credentials = [role.trim(), stack.trim()].filter(Boolean).join("  ·  ");
  if (credentials) {
    label(ctx, credentials.toUpperCase(), M, 1200, 23, {
      fill: "rgba(247, 243, 232, 0.66)",
      tracking: 3,
    });
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const y = 1246;
  const h = H - y;

  ctx.save();
  ctx.fillStyle = sunsetGradient(ctx, 0, y, W, H);
  ctx.fillRect(0, y, W, h);

  const baseline = y + h / 2 + 8;

  label(ctx, EVENT.hashtag, M, baseline, 26, {
    fill: C.greenDeep,
    weight: 600,
    tracking: 2.5,
  });

  const handle = state.details.handle.trim().replace(/^@/, "");
  const right = handle ? `@${handle}` : EVENT.studio;
  label(ctx, right, W - M, baseline, 24, {
    fill: "rgba(16, 36, 26, 0.72)",
    weight: 600,
    tracking: 2.5,
    align: "right",
  });

  ctx.restore();
}
