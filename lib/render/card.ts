import { DISPLAY, MONO, font } from "../fonts";
import {
  EVENT,
  cornerSeal,
  drawQr,
  emptyPrompt,
  label,
  measureLabel,
  rampLinear,
  roundRect,
  scrim,
  sunDisc,
  withAlpha,
  wordmark,
} from "./brand";
import { drawPhoto } from "./photo";
import { THEMES, type Palette } from "./themes";
import type { RenderState } from "./types";

/**
 * Format B — builder ID, 1080 × 1350.
 *
 * 4:5 because that's the tallest ratio X shows uncropped in-feed; a 1:1 card
 * wastes vertical space and a taller one gets clipped.
 *
 * Two faces. The QR started life squeezed next to the name on the front and
 * looked exactly like what it was — an afterthought wedged into a full layout.
 * Real passes put the code on the back, so it lives there with room to
 * breathe, and the front stays about the person.
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
  const P = THEMES[state.theme];

  drawBackground(ctx, P);

  if (state.side === "back") {
    drawBack(ctx, state, P);
  } else {
    drawHeader(ctx, P);
    drawPhotoPanel(ctx, state, P);
    drawIdentity(ctx, state, P);
  }

  drawFooter(ctx, state, P);
}

function drawBackground(ctx: CanvasRenderingContext2D, P: Palette): void {
  ctx.fillStyle = P.base;
  ctx.fillRect(0, 0, W, H);

  // Faint vertical lift so a flat fill doesn't band on phone screens.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(255, 255, 255, 0.05)");
  g.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.16)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawHeader(ctx: CanvasRenderingContext2D, P: Palette): void {
  wordmark(ctx, M, 132, 54, { fill: P.ink, goaFill: P.mark });

  label(ctx, `${EVENT.dates} · ${EVENT.place}`, M, 180, 24, {
    fill: P.inkSoft,
    tracking: 3.4,
  });

  sunDisc(ctx, W - M - 34, 118, 30, {
    ringColor: withAlpha(P.ink, 0.5),
    palette: P,
  });

  ctx.save();
  ctx.strokeStyle = P.line;
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
  P: Palette,
): void {
  ctx.save();
  roundRect(ctx, M, PHOTO_Y, INNER, PHOTO_H, 28);
  ctx.clip();

  if (state.bitmap) {
    drawPhoto(
      ctx,
      state.bitmap,
      state.transform,
      M,
      PHOTO_Y,
      INNER,
      PHOTO_H,
    );
  } else {
    ctx.fillStyle = P.deep;
    ctx.fillRect(M, PHOTO_Y, INNER, PHOTO_H);
    emptyPrompt(ctx, W / 2, PHOTO_Y + PHOTO_H / 2, 1.15, P);
  }

  // Scrim carries the overlaid label across any photo — bright sky, white
  // shirt, blown-out window, all of which turn up in real uploads.
  scrim(ctx, M, PHOTO_Y + PHOTO_H - 190, INNER, 190, 0.72);
  ctx.restore();

  drawCornerTicks(ctx, M, PHOTO_Y, INNER, PHOTO_H);
  cornerSeal(ctx, M + INNER - 130, PHOTO_Y + 130, 108, P);

  label(ctx, "VERIFIED BUILDER", M + 34, PHOTO_Y + PHOTO_H - 44, 22, {
    fill: P.mark,
    weight: 600,
    tracking: 4.5,
  });

  ctx.save();
  ctx.strokeStyle = withAlpha(P.ink, 0.26);
  ctx.lineWidth = 2;
  roundRect(ctx, M, PHOTO_Y, INNER, PHOTO_H, 28);
  ctx.stroke();
  ctx.restore();
}

/** Corner registration marks — what makes it read as a credential. */
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
  P: Palette,
): void {
  const { name, title, role, stack } = state.details;

  const displayName = (name.trim() || "YOUR NAME").toUpperCase();

  // Shrink to fit rather than truncating — a clipped name on your own ID card
  // reads as broken, and long names are common.
  let size = 82;
  ctx.save();
  ctx.font = font(800, size, DISPLAY, "Georgia, serif");
  while (ctx.measureText(displayName).width > INNER && size > 34) {
    size -= 2;
    ctx.font = font(800, size, DISPLAY, "Georgia, serif");
  }
  ctx.fillStyle = P.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(displayName, M, 1104);
  ctx.restore();

  if (title.trim()) {
    const t = title.trim().toUpperCase();
    const w = measureLabel(ctx, t, 28, 600, 4);
    label(ctx, t, M, 1152, 28, {
      fill: rampLinear(ctx, P, M, 1130, M + w, 1152),
      weight: 600,
      tracking: 4,
    });
  }

  const credentials = [role.trim(), stack.trim()].filter(Boolean).join("  ·  ");
  if (credentials) {
    label(ctx, credentials.toUpperCase(), M, 1200, 23, {
      fill: P.inkSoft,
      tracking: 3,
    });
  }
}

/**
 * The reverse of the pass: the code, large enough to actually scan, plus the
 * few details a real credential carries on its back.
 */
function drawBack(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  P: Palette,
): void {
  const { name, title, shareUrl } = state.details;

  wordmark(ctx, M, 132, 54, { fill: P.ink, goaFill: P.mark });
  label(ctx, "BUILDER PASS · REVERSE", M, 180, 24, {
    fill: P.inkSoft,
    tracking: 3.4,
  });

  ctx.save();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, 208);
  ctx.lineTo(W - M, 208);
  ctx.stroke();
  ctx.restore();

  const qrSize = 520;
  const qrX = (W - qrSize) / 2;
  const qrY = 300;

  if (shareUrl) {
    drawQr(ctx, shareUrl, qrX, qrY, qrSize, { dark: P.deep, radius: 24 });
  } else {
    ctx.save();
    ctx.fillStyle = withAlpha(P.ink, 0.08);
    roundRect(ctx, qrX, qrY, qrSize, qrSize, 24);
    ctx.fill();
    ctx.restore();
    label(ctx, "CODE APPEARS ON SHARE", W / 2, qrY + qrSize / 2, 24, {
      fill: withAlpha(P.ink, 0.5),
      weight: 600,
      tracking: 3,
      align: "center",
    });
  }

  label(ctx, "SCAN TO SEE THE PASS", W / 2, qrY + qrSize + 62, 24, {
    fill: P.inkSoft,
    weight: 600,
    tracking: 4,
    align: "center",
  });

  const displayName = (name.trim() || "YOUR NAME").toUpperCase();
  ctx.save();
  let size = 62;
  ctx.font = font(800, size, DISPLAY, "Georgia, serif");
  while (ctx.measureText(displayName).width > INNER && size > 30) {
    size -= 2;
    ctx.font = font(800, size, DISPLAY, "Georgia, serif");
  }
  ctx.fillStyle = P.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(displayName, W / 2, qrY + qrSize + 150);
  ctx.restore();

  if (title.trim()) {
    label(ctx, title.trim().toUpperCase(), W / 2, qrY + qrSize + 196, 26, {
      fill: P.mark,
      weight: 600,
      tracking: 4,
      align: "center",
    });
  }

  ctx.save();
  ctx.font = font(400, 22, MONO, "ui-monospace, monospace");
  ctx.fillStyle = withAlpha(P.ink, 0.4);
  ctx.textAlign = "center";
  ctx.fillText(EVENT.coords, W / 2, 1196);
  ctx.restore();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  P: Palette,
): void {
  const y = 1246;
  const h = H - y;

  ctx.save();
  ctx.fillStyle = rampLinear(ctx, P, 0, y, W, H);
  ctx.fillRect(0, y, W, h);

  const baseline = y + h / 2 + 8;

  label(ctx, EVENT.hashtag, M, baseline, 26, {
    fill: P.onRamp,
    weight: 600,
    tracking: 2.5,
  });

  const handle = state.details.handle.trim().replace(/^@/, "");
  const right = handle ? `@${handle}` : EVENT.studio;
  label(ctx, right, W - M, baseline, 24, {
    fill: P.onRampSoft,
    weight: 600,
    tracking: 2.5,
    align: "right",
  });

  ctx.restore();
}
