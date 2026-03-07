import type {
  PptxTheme,
  PptxThemeFontScheme,
  PptxThemeColorScheme,
} from "pptx-viewer-core";
import { THEME_COLOR_SCHEME_KEYS } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Theme font resolution
// ---------------------------------------------------------------------------

/**
 * Resolve OOXML theme font tokens (`+mj-lt`, `+mn-lt`, etc.) to actual
 * font family names using the theme's font scheme.
 *
 * Returns the input unchanged when it is not a theme font token.
 */
export function resolveThemeFont(
  fontFamily: string | undefined,
  fontScheme: PptxThemeFontScheme | undefined,
): string | undefined {
  if (!fontFamily || !fontScheme) return fontFamily;

  const normalized = fontFamily.trim();
  if (!normalized.startsWith("+")) return fontFamily;

  const token = normalized.slice(1).toLowerCase();

  switch (token) {
    case "mj-lt":
      return fontScheme.majorFont?.latin ?? fontFamily;
    case "mj-ea":
      return fontScheme.majorFont?.eastAsia ?? fontFamily;
    case "mj-cs":
      return fontScheme.majorFont?.complexScript ?? fontFamily;
    case "mn-lt":
      return fontScheme.minorFont?.latin ?? fontFamily;
    case "mn-ea":
      return fontScheme.minorFont?.eastAsia ?? fontFamily;
    case "mn-cs":
      return fontScheme.minorFont?.complexScript ?? fontFamily;
    default:
      return fontFamily;
  }
}

// ---------------------------------------------------------------------------
// Theme colour tint / shade helpers
// ---------------------------------------------------------------------------

/**
 * Parse a hex colour string (`#RRGGBB` or `RRGGBB`) into RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/**
 * Convert RGB components back to a `#RRGGBB` string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number): number =>
    Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    clamp(r).toString(16).padStart(2, "0").toUpperCase() +
    clamp(g).toString(16).padStart(2, "0").toUpperCase() +
    clamp(b).toString(16).padStart(2, "0").toUpperCase()
  );
}

/**
 * Compute a tinted (lighter) version of a colour.
 * `tintFactor` is 0-1 where 1 = white and 0 = original.
 *
 * Formula: `result = channel + (255 - channel) * tintFactor`
 */
export function tintColor(hex: string, tintFactor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * tintFactor,
    g + (255 - g) * tintFactor,
    b + (255 - b) * tintFactor,
  );
}

/**
 * Compute a shaded (darker) version of a colour.
 * `shadeFactor` is 0-1 where 1 = black and 0 = original.
 *
 * Formula: `result = channel * (1 - shadeFactor)`
 */
export function shadeColor(hex: string, shadeFactor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r * (1 - shadeFactor),
    g * (1 - shadeFactor),
    b * (1 - shadeFactor),
  );
}

/** Tint/shade row definition for the PowerPoint-style theme colour grid. */
export interface ThemeColorTintRow {
  /** Row label for accessibility / tooltips. */
  label: string;
  /** Transform function: base hex → variant hex. */
  transform: (hex: string) => string;
}

/**
 * The 6 rows of the PowerPoint theme colour picker:
 * Row 0: base colour
 * Row 1: 80% tint (lighter)
 * Row 2: 60% tint
 * Row 3: 40% tint
 * Row 4: 25% shade (darker)
 * Row 5: 50% shade (darkest)
 */
export const THEME_COLOR_TINT_ROWS: ReadonlyArray<ThemeColorTintRow> = [
  { label: "Base", transform: (c) => c },
  { label: "Lighter 80%", transform: (c) => tintColor(c, 0.8) },
  { label: "Lighter 60%", transform: (c) => tintColor(c, 0.6) },
  { label: "Lighter 40%", transform: (c) => tintColor(c, 0.4) },
  { label: "Darker 25%", transform: (c) => shadeColor(c, 0.25) },
  { label: "Darker 50%", transform: (c) => shadeColor(c, 0.5) },
];

/** Display labels for the 12 base theme colour scheme keys. */
export const THEME_COLOR_LABELS: Record<keyof PptxThemeColorScheme, string> = {
  dk1: "Dark 1",
  lt1: "Light 1",
  dk2: "Dark 2",
  lt2: "Light 2",
  accent1: "Accent 1",
  accent2: "Accent 2",
  accent3: "Accent 3",
  accent4: "Accent 4",
  accent5: "Accent 5",
  accent6: "Accent 6",
  hlink: "Hyperlink",
  folHlink: "Followed Hyperlink",
};

/**
 * Build the full 12×6 grid of theme colours from a colour scheme.
 * Returns an array of rows, each row is an array of `{ hex, schemeKey, label }`.
 */
export function buildThemeColorGrid(colorScheme: PptxThemeColorScheme): Array<
  Array<{
    hex: string;
    schemeKey: keyof PptxThemeColorScheme;
    rowLabel: string;
    colLabel: string;
  }>
> {
  return THEME_COLOR_TINT_ROWS.map((row) =>
    THEME_COLOR_SCHEME_KEYS.map((key) => ({
      hex: row.transform(colorScheme[key]),
      schemeKey: key,
      rowLabel: row.label,
      colLabel: THEME_COLOR_LABELS[key],
    })),
  );
}

/**
 * Extract theme colour base hex values as a flat array (for backward-compat
 * swatch rendering when no theme object is available).
 */
export function themeColorSchemeToSwatches(
  theme: PptxTheme | undefined,
): string[] {
  const colorScheme = theme?.colorScheme;
  if (!colorScheme) return [];
  return THEME_COLOR_SCHEME_KEYS.map((key) => colorScheme[key]);
}
