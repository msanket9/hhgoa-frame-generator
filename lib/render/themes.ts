/**
 * Colour themes for the artifact.
 *
 * All three run the same sunset ramp so they read as one family — what changes
 * is the surface underneath it. Sand exists for a specific reason: most of X is
 * on dark mode, and a light frame is the one that stops the scroll there.
 */

export type ThemeId = "sunset" | "midnight" | "sand";

export type Palette = {
  /** Ring band / card background. */
  base: string;
  /** Darker well behind the photo. */
  deep: string;
  /** Primary text on `base`. */
  ink: string;
  /** Muted text on `base`. */
  inkSoft: string;
  /** Hairline / divider on `base`. */
  line: string;
  /** गोवा and other highlight marks. */
  mark: string;
  /** The sunset ramp: three stops, pink through gold. */
  ramp: [string, string, string];
  /** Text sitting on top of the ramp (footer band). */
  onRamp: string;
  /** Same, softened. */
  onRampSoft: string;
};

export const THEMES: Record<ThemeId, Palette> = {
  sunset: {
    base: "#0b4b2c",
    deep: "#073620",
    ink: "#f7f3e8",
    inkSoft: "rgba(247, 243, 232, 0.66)",
    line: "rgba(247, 243, 232, 0.18)",
    mark: "#ffd400",
    ramp: ["#ff1f6b", "#e8622c", "#f9a825"],
    onRamp: "#073620",
    onRampSoft: "rgba(7, 54, 32, 0.72)",
  },
  midnight: {
    base: "#14161c",
    deep: "#0a0b0f",
    ink: "#f4f3f0",
    inkSoft: "rgba(244, 243, 240, 0.62)",
    line: "rgba(244, 243, 240, 0.16)",
    mark: "#ffd400",
    ramp: ["#ff2d7a", "#f0662c", "#ffb028"],
    onRamp: "#0a0b0f",
    onRampSoft: "rgba(10, 11, 15, 0.72)",
  },
  sand: {
    base: "#f0e6d2",
    deep: "#e2d5ba",
    ink: "#0b4b2c",
    inkSoft: "rgba(11, 75, 44, 0.62)",
    line: "rgba(11, 75, 44, 0.20)",
    mark: "#e0175c",
    ramp: ["#ff1f6b", "#e8622c", "#f9a825"],
    onRamp: "#fdf9f0",
    onRampSoft: "rgba(253, 249, 240, 0.82)",
  },
};

export const THEME_LABELS: Record<ThemeId, string> = {
  sunset: "Sunset",
  midnight: "Midnight",
  sand: "Sand",
};

/** Swatch shown in the picker — the ramp reads better than a single colour. */
export const THEME_SWATCH: Record<ThemeId, string> = {
  sunset: "#0b4b2c",
  midnight: "#14161c",
  sand: "#f0e6d2",
};
