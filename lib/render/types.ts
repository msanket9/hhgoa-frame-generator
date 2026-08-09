import type { LookId } from "./looks";
import type { ThemeId } from "./themes";

export type FormatId = "pfp" | "card";

export type FormatSpec = {
  id: FormatId;
  label: string;
  sublabel: string;
  width: number;
  height: number;
};

export const FORMATS: Record<FormatId, FormatSpec> = {
  pfp: {
    id: "pfp",
    label: "Profile frame",
    sublabel: "1080 × 1080",
    width: 1080,
    height: 1080,
  },
  card: {
    id: "card",
    label: "Builder ID",
    sublabel: "1080 × 1350",
    width: 1080,
    height: 1350,
  },
};

/**
 * Photo placement.
 *
 * `scale` is a multiplier on top of cover-fit, so 1 always means "exactly
 * filling the window" regardless of the source aspect ratio. Offsets are a
 * fraction of the window size, which keeps the transform resolution
 * independent — the same values produce the same framing whether we're
 * drawing the 1080px export or a 320px preview.
 */
export type Transform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const IDENTITY: Transform = { scale: 1, offsetX: 0, offsetY: 0 };

export const MIN_SCALE = 1;
export const MAX_SCALE = 3;

export type Details = {
  name: string;
  role: string;
  stack: string;
  handle: string;
  title: string;
  /**
   * Where this pass's QR points. Allocated before render, not after upload —
   * the code has to be baked into the image itself, so the id it encodes must
   * exist before the image is made.
   */
  shareUrl: string;
};

/** Which face of the builder ID is showing. The profile frame has one side. */
export type CardSide = "front" | "back";

export type RenderState = {
  bitmap: ImageBitmap | null;
  transform: Transform;
  details: Details;
  theme: ThemeId;
  look: LookId;
  side: CardSide;
};
