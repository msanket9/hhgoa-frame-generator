import { IDENTITY_MATRIX, applyColorMatrix, type ColorMatrix } from "./colormatrix";

/**
 * Produces a colour-graded copy of a bitmap.
 *
 * Runs once per (photo, look) pair rather than per frame — the result is
 * meant to be cached and reused for every subsequent draw while the user
 * drags or zooms, so the per-frame path stays a plain `drawImage` exactly as
 * fast as before this existed. See colormatrix.ts for why this exists at all
 * instead of `ctx.filter`.
 */
export async function gradeBitmap(
  source: ImageBitmap,
  matrix: ColorMatrix,
): Promise<ImageBitmap> {
  if (matrix === IDENTITY_MATRIX) {
    return createImageBitmap(source);
  }

  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return createImageBitmap(source);

  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyColorMatrix(imageData.data, matrix);
  ctx.putImageData(imageData, 0, 0);

  return createImageBitmap(canvas);
}
