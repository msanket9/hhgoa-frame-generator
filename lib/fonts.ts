/**
 * Canvas text silently falls back to a default face if the font isn't loaded
 * at draw time — and unlike DOM text, it never re-renders once the font
 * arrives. So every draw has to be gated behind this.
 */

export const DISPLAY = "HHDisplay";
export const MONO = "HHMono";
export const DEVANAGARI = "HHDevanagari";

type FaceSpec = {
  family: string;
  url: string;
  descriptors: FontFaceDescriptors;
};

const FACES: FaceSpec[] = [
  {
    family: DISPLAY,
    url: "/fonts/playfair-display.woff2",
    descriptors: { weight: "700 900", style: "normal" },
  },
  {
    family: MONO,
    url: "/fonts/plex-mono-400.woff2",
    descriptors: { weight: "400", style: "normal" },
  },
  {
    family: MONO,
    url: "/fonts/plex-mono-600.woff2",
    descriptors: { weight: "600", style: "normal" },
  },
  {
    family: DEVANAGARI,
    // Subset to the four codepoints in गोवा (U+917, U+935, U+93E, U+94B) —
    // the only Devanagari this app ever draws. 115KB -> 1KB.
    url: "/fonts/baloo2-goa.woff2",
    descriptors: { weight: "700 800", style: "normal" },
  },
];

let loadPromise: Promise<void> | null = null;

/**
 * Idempotent. Safe to await before every render — after the first call it
 * resolves immediately.
 */
export function loadBrandFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  loadPromise ??= (async () => {
    await Promise.all(
      FACES.map(async (spec) => {
        try {
          const face = new FontFace(
            spec.family,
            `url(${spec.url}) format("woff2")`,
            spec.descriptors,
          );
          await face.load();
          document.fonts.add(face);
        } catch {
          // A missing face degrades to a system fallback rather than
          // breaking the render outright.
        }
      }),
    );
    // Covers any faces the page itself is still resolving.
    await document.fonts.ready;
  })();

  return loadPromise;
}

/** Builds a canvas `font` shorthand string. */
export function font(
  weight: number,
  size: number,
  family: string,
  fallback = "sans-serif",
): string {
  return `${weight} ${size}px "${family}", ${fallback}`;
}
