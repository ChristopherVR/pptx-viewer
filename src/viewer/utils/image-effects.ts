/**
 * Canvas-based image effects — colour change (chroma keying).
 *
 * Used for the PowerPoint `<a:clrChange>` element which replaces one colour
 * range in an image with another (like green-screen removal).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** RGB triplet (0–255 per channel). */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** Result of `applyColorChange` — the processed data-URL plus dimensions. */
export interface ColorChangeResult {
  dataUrl: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/**
 * Parse a hex colour string (`#RRGGBB` or `RRGGBB`) into an {@link RgbColor}.
 * Returns `null` if the string is not a valid 6-digit hex colour.
 */
export function parseHexToRgb(hex: string): RgbColor | null {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length !== 6) return null;
  const num = parseInt(cleaned, 16);
  if (!Number.isFinite(num)) return null;
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

/**
 * Euclidean distance between two RGB colours.
 * Range: 0 (identical) to ~441.67 (black ↔ white).
 */
export function colorDistance(a: RgbColor, b: RgbColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Maximum possible Euclidean distance in RGB space (√(255²+255²+255²)).
 */
export const MAX_COLOR_DISTANCE = Math.sqrt(255 * 255 * 3); // ≈ 441.67

/**
 * Convert a tolerance percentage (0–100) to an absolute RGB-space distance
 * threshold suitable for {@link replacePixels}.
 *
 * 0 → exact match only; 100 → match everything.
 */
export function toleranceToThreshold(tolerancePct: number): number {
  const clamped = Math.max(0, Math.min(100, tolerancePct));
  return (clamped / 100) * MAX_COLOR_DISTANCE;
}

// ---------------------------------------------------------------------------
// Pixel replacement (pure logic — operates on raw Uint8ClampedArray)
// ---------------------------------------------------------------------------

/**
 * Replace pixels in `data` that are within `threshold` distance of `fromColor`.
 *
 * If `toTransparent` is true the target pixels become fully transparent
 * (alpha = 0) regardless of `toColor`.
 *
 * Mutates `data` in-place for performance.
 */
export function replacePixels(
  data: Uint8ClampedArray,
  fromColor: RgbColor,
  toColor: RgbColor,
  threshold: number,
  toTransparent: boolean,
): void {
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const pixel: RgbColor = { r: data[i], g: data[i + 1], b: data[i + 2] };
    if (colorDistance(pixel, fromColor) <= threshold) {
      if (toTransparent) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        data[i] = toColor.r;
        data[i + 1] = toColor.g;
        data[i + 2] = toColor.b;
        // Preserve original alpha
      }
    }
  }
}

// ---------------------------------------------------------------------------
// High-level API
// ---------------------------------------------------------------------------

/** Default tolerance percentage for colour change matching. */
export const DEFAULT_COLOR_CHANGE_TOLERANCE = 12;

/**
 * Load an image from a data-URL (or any URL), process its pixels to replace
 * `fromColor` with `toColor`, and return a new PNG data-URL.
 *
 * @param imageDataUrl  Source image (data-URL or blob URL).
 * @param fromHex       Hex colour to match (e.g. `#00FF00`).
 * @param toHex         Hex colour to replace with (e.g. `#FF0000`).
 * @param tolerancePct  Match tolerance 0–100 (default {@link DEFAULT_COLOR_CHANGE_TOLERANCE}).
 * @param toTransparent If true, matched pixels become fully transparent.
 * @returns Processed image as a PNG data-URL with dimensions.
 */
export function applyColorChange(
  imageDataUrl: string,
  fromHex: string,
  toHex: string,
  tolerancePct: number = DEFAULT_COLOR_CHANGE_TOLERANCE,
  toTransparent: boolean = false,
): Promise<ColorChangeResult> {
  return new Promise((resolve, reject) => {
    const fromColor = parseHexToRgb(fromHex);
    const toColor = parseHexToRgb(toHex);
    if (!fromColor || !toColor) {
      reject(new Error(`Invalid hex colour: from="${fromHex}" to="${toHex}"`));
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w === 0 || h === 0) {
        reject(new Error("Image has zero dimensions"));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Cannot create 2D canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, w, h);

      const threshold = toleranceToThreshold(tolerancePct);
      replacePixels(
        imageData.data,
        fromColor,
        toColor,
        threshold,
        toTransparent,
      );

      ctx.putImageData(imageData, 0, 0);

      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        width: w,
        height: h,
      });
    };

    img.onerror = () => {
      reject(new Error("Failed to load image for colour change processing"));
    };

    img.src = imageDataUrl;
  });
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Simple LRU-ish cache keyed by a composite string.
 * Prevents re-processing the same image + effect combo on every render.
 */
const colorChangeCache = new Map<string, string>();
const CACHE_MAX = 64;

/** Build a deterministic cache key. */
export function buildCacheKey(
  src: string,
  fromHex: string,
  toHex: string,
  tolerancePct: number,
  toTransparent: boolean,
): string {
  // Use first 64 chars of src to keep key size reasonable
  const srcKey = src.length > 64 ? src.slice(0, 64) : src;
  return `${srcKey}|${fromHex}|${toHex}|${tolerancePct}|${toTransparent}`;
}

/** Get cached result or `undefined`. */
export function getCachedResult(key: string): string | undefined {
  return colorChangeCache.get(key);
}

/** Store a result in the cache. Evicts oldest entry when full. */
export function setCachedResult(key: string, dataUrl: string): void {
  if (colorChangeCache.size >= CACHE_MAX) {
    // Evict first (oldest) entry
    const firstKey = colorChangeCache.keys().next().value;
    if (firstKey !== undefined) {
      colorChangeCache.delete(firstKey);
    }
  }
  colorChangeCache.set(key, dataUrl);
}
