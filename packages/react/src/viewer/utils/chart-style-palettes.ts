/**
 * Chart style palette mapping.
 *
 * Office chart styles 1–48 (c:style/@val) define color palettes derived from
 * the theme's accent colors with tint/shade variations.  This module provides
 * a `getChartStylePalette` function that returns a concrete color array given a
 * style index, so rendered charts honour the intended palette instead of
 * falling back to a hardcoded default.
 *
 * The mapping groups are:
 *   1–8   — Colorful sequential (accent1→accent6 with cycling)
 *   9–16  — Monochromatic tint/shade ramps based on a single accent
 *  17–24  — Colorful multi-accent variations (brighter/muted)
 *  25–32  — Dark-toned variations
 *  33–40  — Medium-toned variations
 *  41–48  — Light-toned variations
 *
 * @module chart-style-palettes
 */

// ── Default accent colours (Office "Office" theme) ────────────────────
// These are the default accent1-accent6 colours when no theme data is
// available.  They correspond to the standard Office 2013+ theme.

const ACCENT1 = "#4472C4"; // Blue
const ACCENT2 = "#ED7D31"; // Orange
const ACCENT3 = "#A5A5A5"; // Grey
const ACCENT4 = "#FFC000"; // Gold
const ACCENT5 = "#5B9BD5"; // Light Blue
const ACCENT6 = "#70AD47"; // Green

const ACCENTS = [ACCENT1, ACCENT2, ACCENT3, ACCENT4, ACCENT5, ACCENT6];

// ── Colour manipulation helpers ─────────────────────────────────────

/** Parse a hex colour string (#RRGGBB) into [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Convert [r, g, b] back to #RRGGBB. */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    clamp(r).toString(16).padStart(2, "0") +
    clamp(g).toString(16).padStart(2, "0") +
    clamp(b).toString(16).padStart(2, "0")
  );
}

/**
 * Apply a tint (lighten towards white) to a colour.
 * `amount` in [0, 1] where 0 = no change, 1 = white.
 */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

/**
 * Apply a shade (darken towards black) to a colour.
 * `amount` in [0, 1] where 0 = no change, 1 = black.
 */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

// ── Palette generation strategies ─────────────────────────────────────

/** Full accent cycle: accent1-6 repeated. */
function colorfulSequential(offset: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    out.push(ACCENTS[(i + offset) % ACCENTS.length]);
  }
  return out;
}

/** Monochromatic ramp: variations of a single accent colour. */
function monochromaticRamp(base: string): string[] {
  return [
    shade(base, 0.5),
    shade(base, 0.35),
    shade(base, 0.15),
    base,
    tint(base, 0.2),
    tint(base, 0.4),
    tint(base, 0.6),
    tint(base, 0.8),
  ];
}

/** Colorful variant with higher saturation / brightness offsets. */
function colorfulVariant(offset: number, tintAmount: number): string[] {
  return ACCENTS.map((c, i) => {
    const idx = (i + offset) % ACCENTS.length;
    return tintAmount > 0
      ? tint(ACCENTS[idx], tintAmount)
      : shade(ACCENTS[idx], -tintAmount);
  }).concat([
    tint(ACCENTS[offset % ACCENTS.length], 0.4),
    shade(ACCENTS[(offset + 1) % ACCENTS.length], 0.2),
  ]);
}

/** Dark palette: shaded versions of accents. */
function darkPalette(offset: number, shadeAmount: number): string[] {
  return colorfulSequential(offset).map((c) => shade(c, shadeAmount));
}

/** Medium palette: slightly tinted accents. */
function mediumPalette(offset: number, tintAmount: number): string[] {
  return colorfulSequential(offset).map((c) => tint(c, tintAmount));
}

/** Light palette: strongly tinted accents. */
function lightPalette(offset: number, tintAmount: number): string[] {
  return colorfulSequential(offset).map((c) => tint(c, tintAmount));
}

// ── Style index → palette mapping ─────────────────────────────────────

/**
 * Build the palette for a given chart style index (1–48).
 * Returns an 8-colour array.
 */
function buildPalette(styleId: number): string[] {
  // Clamp to valid range
  const id = Math.max(1, Math.min(48, styleId));

  // Styles 1–8: Colorful sequential with rotated offsets
  if (id <= 8) {
    return colorfulSequential(id - 1);
  }

  // Styles 9–16: Monochromatic ramps
  if (id <= 16) {
    // Each uses a different accent as the base
    const accentIdx = (id - 9) % ACCENTS.length;
    return monochromaticRamp(ACCENTS[accentIdx]);
  }

  // Styles 17–24: Colorful variations (brighter / muted)
  if (id <= 24) {
    const sub = id - 17;
    const tintAmt = sub < 4 ? sub * 0.1 : -(sub - 4) * 0.1;
    return colorfulVariant(sub, tintAmt);
  }

  // Styles 25–32: Dark palettes
  if (id <= 32) {
    const sub = id - 25;
    return darkPalette(sub, 0.25 + (sub % 4) * 0.1);
  }

  // Styles 33–40: Medium palettes
  if (id <= 40) {
    const sub = id - 33;
    return mediumPalette(sub, 0.15 + (sub % 4) * 0.08);
  }

  // Styles 41–48: Light palettes
  const sub = id - 41;
  return lightPalette(sub, 0.4 + (sub % 4) * 0.1);
}

// ── Palette cache ─────────────────────────────────────────────────────

const paletteCache = new Map<number, string[]>();

/**
 * Get the colour palette for a chart style index.
 *
 * @param styleId  The `c:style/@val` value (1–48). When `undefined` or
 *                 out-of-range the default palette is returned.
 * @returns An 8-colour array of hex colour strings.
 */
export function getChartStylePalette(styleId?: number): string[] {
  if (styleId === undefined || styleId < 1 || styleId > 48) {
    return DEFAULT_CHART_PALETTE;
  }

  let palette = paletteCache.get(styleId);
  if (!palette) {
    palette = buildPalette(styleId);
    paletteCache.set(styleId, palette);
  }
  return palette;
}

/**
 * The default fallback palette used when no chart style is specified.
 * This is the existing hardcoded palette from the codebase.
 */
export const DEFAULT_CHART_PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
];
