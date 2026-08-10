/**
 * Photo looks — colour grades applied to the uploaded photo only, never to
 * the frame.
 *
 * Built as `ColorMatrix` compositions (see colormatrix.ts), not
 * `CanvasRenderingContext2D.filter` strings. The canvas `filter` property is
 * unimplemented in WebKit on every platform — not partial support, never
 * shipped — which silently no-ops every look on every iPhone. The matrix
 * approach is a manual port of the same CSS Filter Effects formulas, applied
 * once per (photo, look) via `gradeBitmap` and cached, so it costs nothing
 * on the per-frame drag/zoom path.
 */

import {
  IDENTITY_MATRIX,
  brightness,
  chain,
  contrast,
  grayscale,
  hueRotate,
  saturate,
  sepia,
  type ColorMatrix,
} from "./colormatrix";

export type LookId = "as-shot" | "goa-sun" | "noir" | "dusk";

export type Look = {
  id: LookId;
  label: string;
  matrix: ColorMatrix;
};

export const LOOKS: Record<LookId, Look> = {
  "as-shot": {
    id: "as-shot",
    label: "As shot",
    matrix: IDENTITY_MATRIX,
  },
  "goa-sun": {
    id: "goa-sun",
    label: "Goa sun",
    // Warm, lifted, a little hazy — late afternoon on the coast.
    matrix: chain(saturate(1.25), contrast(1.05), brightness(1.06), sepia(0.18)),
  },
  noir: {
    id: "noir",
    label: "Noir",
    matrix: chain(grayscale(1), contrast(1.22), brightness(1.02)),
  },
  dusk: {
    id: "dusk",
    label: "Dusk",
    // Cooled and deepened, the blue half-hour after the sun drops.
    matrix: chain(saturate(1.1), contrast(1.12), brightness(0.94), hueRotate(-12)),
  },
};

export const LOOK_ORDER: LookId[] = ["as-shot", "goa-sun", "noir", "dusk"];
