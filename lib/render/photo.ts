import type { Transform } from "./types";

/**
 * Draws the photo to cover a rect, honouring the user's scale/offset.
 *
 * Cover-fit first means an off-centre portrait and a wide landscape both start
 * from a sane framing, which is the whole point of not making people crop
 * before they upload.
 */
/**
 * Draws `bitmap` as given — colour grading, if any, has already been baked
 * into it upstream (see lib/render/grade.ts) rather than applied here via
 * `ctx.filter`, which WebKit has never implemented on any platform.
 */
export function drawPhoto(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  transform: Transform,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const cover = Math.max(w / bitmap.width, h / bitmap.height);
  const scale = cover * transform.scale;

  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;

  // Offsets are fractions of the window, so framing survives a resolution change.
  const cx = x + w / 2 + transform.offsetX * w;
  const cy = y + h / 2 + transform.offsetY * h;

  ctx.drawImage(bitmap, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
}

/**
 * Largest offset that still keeps the photo covering the window.
 *
 * Used to clamp both slider and drag input — without it you can pan the image
 * off the edge and expose background, which always looks like a bug.
 */
export function offsetBounds(
  bitmap: ImageBitmap,
  transform: Transform,
  w: number,
  h: number,
): { maxX: number; maxY: number } {
  const cover = Math.max(w / bitmap.width, h / bitmap.height);
  const scale = cover * transform.scale;
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;

  return {
    maxX: Math.max(0, (drawW - w) / 2 / w),
    maxY: Math.max(0, (drawH - h) / 2 / h),
  };
}

export function clampTransform(
  bitmap: ImageBitmap,
  transform: Transform,
  w: number,
  h: number,
): Transform {
  const { maxX, maxY } = offsetBounds(bitmap, transform, w, h);
  return {
    scale: transform.scale,
    offsetX: Math.max(-maxX, Math.min(maxX, transform.offsetX)),
    offsetY: Math.max(-maxY, Math.min(maxY, transform.offsetY)),
  };
}
