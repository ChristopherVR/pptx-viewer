/**
 * Low-level colour primitives: hex/rgb conversion, clamping,
 * HSL conversion, and OOXML percent/fraction/angle parsers.
 *
 * These are the foundational colour operations used throughout the PPTX
 * editor. Higher-level colour parsing (from OOXML colour-choice nodes)
 * lives in `./color-utils.ts`; transforms in `./color-transforms.ts`.
 *
 * @module color-primitives
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to the [0, 1] interval.
 *
 * Used extensively when converting OOXML percentage values to normalised
 * fractions for opacity, saturation, luminance, etc.
 *
 * @param value - The number to clamp.
 * @returns The value clamped to [0, 1].
 */
export function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Normalise a hex colour string, ensuring it starts with `#` and
 * contains exactly 6 hex digits. Returns the fallback colour when
 * the input is missing, `"transparent"`, or malformed.
 *
 * @param value - Raw colour string (with or without leading `#`).
 * @param fallback - Colour to return when `value` is invalid. Defaults to `"#111827"` (dark grey).
 * @returns A valid `#RRGGBB` hex colour string.
 */
export function normalizeHexColor(
  value: string | undefined,
  fallback: string = "#111827",
): string {
  if (!value || value === "transparent") {
    return fallback;
  }
  const candidate = value.startsWith("#") ? value : `#${value}`;
  // Validate exactly 6 hex digits after the '#' prefix
  return /^#[0-9A-Fa-f]{6}$/.test(candidate) ? candidate : fallback;
}

/**
 * Parse a `#RRGGBB` (or `RRGGBB`) hex colour into its individual
 * red, green, and blue channels (0-255 each).
 *
 * @param color - Hex colour string.
 * @returns An object with `r`, `g`, `b` channels, or `null` if the string is invalid.
 */
export function hexToRgbChannels(
  color: string,
): { r: number; g: number; b: number } | null {
  const normalized = color.replace("#", "");
  // Must be exactly 6 hex digits
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

/**
 * Convert a hex colour to an `rgba()` CSS colour string with the
 * given opacity. If `opacity` is `undefined`, the original hex
 * string is returned unchanged.
 *
 * @param color - A `#RRGGBB` hex colour string.
 * @param opacity - Opacity value in [0, 1], or `undefined` for full opacity.
 * @returns A CSS colour string (either the original hex or an `rgba(...)` string).
 */
export function colorWithOpacity(
  color: string,
  opacity: number | undefined,
): string {
  if (opacity === undefined) return color;
  const rgb = hexToRgbChannels(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampUnitInterval(opacity)})`;
}

// ---------------------------------------------------------------------------
// Drawing‑percent helper (OpenXML uses 100 000 = 100 %)
// ---------------------------------------------------------------------------

/**
 * Parse an OOXML percentage value and return it as a normalised
 * fraction in [0, 1]. OOXML encodes percentages as integer
 * thousandths (e.g. `100000` = 100%, `50000` = 50%).
 *
 * The result is clamped to [0, 1] — use {@link parseDrawingFraction}
 * when unclamped values are needed (e.g. `lumMod` > 100%).
 *
 * @param value - Raw attribute value from XML (string or number).
 * @returns Normalised fraction in [0, 1], or `undefined` if unparseable.
 */
export function parseDrawingPercent(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  // Divide by 100 000 to convert OOXML thousandths to a 0-1 fraction
  return clampUnitInterval(parsed / 100000);
}

// ---------------------------------------------------------------------------
// Hex helper
// ---------------------------------------------------------------------------

/**
 * Convert a numeric colour channel value (0-255) to a two-character
 * uppercase hex string. Values outside [0, 255] are clamped.
 *
 * @param value - Colour channel value.
 * @returns Two-character uppercase hex string (e.g. `"0A"`, `"FF"`).
 */
export function toHex(value: number): string {
  return Math.min(255, Math.max(0, Math.round(value)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// RGB ↔ HSL conversion utilities
// ---------------------------------------------------------------------------

/**
 * Represents a colour in the HSL (Hue, Saturation, Lightness) colour space.
 */
export interface HslColor {
  /** Hue in degrees [0, 360). */
  h: number;
  /** Saturation [0, 1]. */
  s: number;
  /** Lightness [0, 1]. */
  l: number;
}

/**
 * Convert an RGB colour (each channel 0-255) to HSL.
 *
 * Uses the standard algorithm:
 *  1. Normalise RGB channels to [0, 1].
 *  2. Find min/max channels and their delta.
 *  3. Lightness = average of min and max.
 *  4. Saturation depends on lightness and delta.
 *  5. Hue is derived from which channel is dominant.
 *
 * @param r - Red channel (0-255).
 * @param g - Green channel (0-255).
 * @param b - Blue channel (0-255).
 * @returns HSL colour with h in [0, 360), s and l in [0, 1].
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor {
  // Normalise channels to [0, 1]
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;

  const cMax = Math.max(rN, gN, bN);
  const cMin = Math.min(rN, gN, bN);
  const delta = cMax - cMin;

  // Lightness is the midpoint of the min and max channels
  const l = (cMax + cMin) / 2;

  // Saturation depends on delta and lightness
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
  }

  // Hue is determined by which channel is the maximum
  let h = 0;
  if (delta !== 0) {
    if (cMax === rN) {
      h = 60 * (((gN - bN) / delta) % 6);
    } else if (cMax === gN) {
      h = 60 * ((bN - rN) / delta + 2);
    } else {
      h = 60 * ((rN - gN) / delta + 4);
    }
  }
  // Ensure hue is in [0, 360)
  if (h < 0) h += 360;

  return { h, s: clampUnitInterval(s), l: clampUnitInterval(l) };
}

/**
 * Convert an HSL colour back to RGB (each channel 0-255).
 *
 * Uses the standard HSL-to-RGB algorithm with chroma, secondary
 * component, and match value. The hue determines which 60-degree
 * sector of the colour wheel the colour falls in.
 *
 * @param h - Hue in degrees (will be normalised to [0, 360)).
 * @param s - Saturation in [0, 1].
 * @param l - Lightness in [0, 1].
 * @returns An object with `r`, `g`, `b` channels (0-255 each).
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const sC = clampUnitInterval(s);
  const lC = clampUnitInterval(l);
  // Normalise hue to [0, 360) handling negative values
  const hN = ((h % 360) + 360) % 360;

  // Chroma: the "colourfulness" component
  const c = (1 - Math.abs(2 * lC - 1)) * sC;
  // Secondary component based on hue sector
  const x = c * (1 - Math.abs(((hN / 60) % 2) - 1));
  // Match value to shift from chroma space to RGB
  const m = lC - c / 2;

  // Select the RGB prime values based on the 60-degree hue sector
  let rP = 0;
  let gP = 0;
  let bP = 0;

  if (hN < 60) {
    rP = c;
    gP = x;
    bP = 0;
  } else if (hN < 120) {
    rP = x;
    gP = c;
    bP = 0;
  } else if (hN < 180) {
    rP = 0;
    gP = c;
    bP = x;
  } else if (hN < 240) {
    rP = 0;
    gP = x;
    bP = c;
  } else if (hN < 300) {
    rP = x;
    gP = 0;
    bP = c;
  } else {
    rP = c;
    gP = 0;
    bP = x;
  }

  return {
    r: Math.round((rP + m) * 255),
    g: Math.round((gP + m) * 255),
    b: Math.round((bP + m) * 255),
  };
}

// ---------------------------------------------------------------------------
// Additional OOXML value parsers
// ---------------------------------------------------------------------------

/**
 * Parse an OOXML percentage value as a fraction (val / 100 000).
 * Unlike {@link parseDrawingPercent}, this does **not** clamp to [0, 1],
 * allowing mod values above 100 % and negative offset values.
 *
 * This is needed for colour transforms like `lumMod` (which can exceed
 * 100%) and `satOff` / `lumOff` (which can be negative).
 *
 * @param value - Raw attribute value from XML.
 * @returns Unclamped fraction, or `undefined` if unparseable.
 */
export function parseDrawingFraction(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  // Divide by 100 000 to convert OOXML thousandths to a decimal fraction
  return parsed / 100000;
}

/**
 * Parse an OOXML angle value given in 60 000ths of a degree and return
 * the result in degrees (e.g. `5400000` becomes `90`).
 *
 * OOXML stores angles as positive integers in 60 000ths of a degree
 * to avoid floating-point issues in the XML representation.
 *
 * @param value - Raw attribute value from XML.
 * @returns Angle in degrees, or `undefined` if unparseable.
 */
export function parseDrawingHueDegrees(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  return parsed / 60000;
}
