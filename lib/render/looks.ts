/**
 * Photo looks — grades applied to the uploaded photo only, never to the frame.
 *
 * Expressed as canvas `filter` strings rather than per-pixel work: the filter
 * runs on the GPU during drawImage, so changing look stays inside the same
 * sub-20ms render budget as dragging the photo. Per-pixel grading would put a
 * visible hitch on every slider tick.
 */

export type LookId = "as-shot" | "goa-sun" | "noir" | "dusk";

export type Look = {
  id: LookId;
  label: string;
  /** Canvas 2D filter chain. Empty means untouched. */
  filter: string;
};

export const LOOKS: Record<LookId, Look> = {
  "as-shot": {
    id: "as-shot",
    label: "As shot",
    filter: "none",
  },
  "goa-sun": {
    id: "goa-sun",
    label: "Goa sun",
    // Warm, lifted, a little hazy — late afternoon on the coast.
    filter: "saturate(1.25) contrast(1.05) brightness(1.06) sepia(0.18)",
  },
  noir: {
    id: "noir",
    label: "Noir",
    filter: "grayscale(1) contrast(1.22) brightness(1.02)",
  },
  dusk: {
    id: "dusk",
    label: "Dusk",
    // Cooled and deepened, the blue half-hour after the sun drops.
    filter: "saturate(1.1) contrast(1.12) brightness(0.94) hue-rotate(-12deg)",
  },
};

export const LOOK_ORDER: LookId[] = ["as-shot", "goa-sun", "noir", "dusk"];
