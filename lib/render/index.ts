import { loadBrandImages } from "../brandAssets";
import { loadBrandFonts } from "../fonts";
import { renderCard } from "./card";
import { renderPfp } from "./pfp";
import { FORMATS, type FormatId, type RenderState } from "./types";

export * from "./types";
export { drawPhoto, clampTransform, offsetBounds } from "./photo";

/**
 * Draws a format into a canvas at its true output resolution.
 *
 * Preview and export call this same function against the same canvas, so
 * what's on screen is byte-identical to what downloads — there's no second
 * "export renderer" that can drift out of sync with the preview.
 */
export function renderTo(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: FormatId,
  state: RenderState,
): void {
  const spec = FORMATS[format];

  if (canvas.width !== spec.width) canvas.width = spec.width;
  if (canvas.height !== spec.height) canvas.height = spec.height;

  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) return;

  ctx.save();
  if (format === "pfp") renderPfp(ctx, state);
  else renderCard(ctx, state);
  ctx.restore();
}

/**
 * Fonts and the wordmark logo must resolve before the first draw or the
 * canvas bakes in a fallback permanently — canvas drawing, unlike DOM
 * content, never re-flows once painted.
 */
export async function renderToAsync(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: FormatId,
  state: RenderState,
): Promise<void> {
  await Promise.all([loadBrandFonts(), loadBrandImages()]);
  renderTo(canvas, format, state);
}
