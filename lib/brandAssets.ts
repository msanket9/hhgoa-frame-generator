/**
 * The event's own wordmark artwork, self-hosted rather than hotlinked.
 *
 * Canvas taints on `toBlob`/`toDataURL` the moment it draws a cross-origin
 * image without a permissive CORS header — and this app's entire purpose is
 * exporting the canvas, so a hotlinked logo would quietly break every
 * download the first time hhgoa.com's CORS posture changed. Same idempotent
 * preload-then-cache shape as loadBrandFonts, for the same reason: canvas
 * drawing is synchronous and never re-runs once painted, so the image has to
 * already be decoded before the first draw.
 */

const WORDMARK_SRC = "/brand/hacker-house-wordmark.png";
/** Natural pixel size of the source art — callers scale off this. */
export const WORDMARK_ASPECT = 1148 / 237;

let wordmarkImage: HTMLImageElement | null = null;
let loadPromise: Promise<void> | null = null;

export function loadBrandImages(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  loadPromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      wordmarkImage = img;
      resolve();
    };
    // A missing asset degrades to the text fallback rather than breaking
    // the render outright — same posture as a missing font face.
    img.onerror = () => resolve();
    img.src = WORDMARK_SRC;
  });

  return loadPromise;
}

/** Null until loadBrandImages() has resolved. */
export function getWordmarkImage(): HTMLImageElement | null {
  return wordmarkImage;
}
