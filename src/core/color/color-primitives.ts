/**
 * Low-level colour primitives: hex/rgb conversion, clamping,
 * HSL conversion, and OOXML percent/fraction/angle parsers.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizeHexColor(
  value: string | undefined,
  fallback: string = "#111827",
): string {
  if (!value || value === "transparent") {
    return fallback;
  }
  const candidate = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9A-Fa-f]{6}$/.test(candidate) ? candidate : fallback;
}

export function hexToRgbChannels(
  color: string,
): { r: number; g: number; b: number } | null {
  const normalized = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

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

export function parseDrawingPercent(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  return clampUnitInterval(parsed / 100000);
}

// ---------------------------------------------------------------------------
// Hex helper
// ---------------------------------------------------------------------------

export function toHex(value: number): string {
  return Math.min(255, Math.max(0, Math.round(value)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// RGB ↔ HSL conversion utilities
// ---------------------------------------------------------------------------

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
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;

  const cMax = Math.max(rN, gN, bN);
  const cMin = Math.min(rN, gN, bN);
  const delta = cMax - cMin;

  const l = (cMax + cMin) / 2;

  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
  }

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
  if (h < 0) h += 360;

  return { h, s: clampUnitInterval(s), l: clampUnitInterval(l) };
}

/**
 * Convert an HSL colour back to RGB (each channel 0-255).
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const sC = clampUnitInterval(s);
  const lC = clampUnitInterval(l);
  const hN = ((h % 360) + 360) % 360;

  const c = (1 - Math.abs(2 * lC - 1)) * sC;
  const x = c * (1 - Math.abs(((hN / 60) % 2) - 1));
  const m = lC - c / 2;

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
 */
export function parseDrawingFraction(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  return parsed / 100000;
}

/**
 * Parse an OOXML angle value given in 60 000ths of a degree and return
 * the result in degrees.  (e.g. 5 400 000 → 90°)
 */
export function parseDrawingHueDegrees(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  return parsed / 60000;
}
