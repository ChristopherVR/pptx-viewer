/**
 * Canvas-based duotone image effect.
 *
 * Implements the PowerPoint `<a:duotone>` element: converts each pixel to
 * grayscale luminance, then linearly maps luminance 0→color1 (shadows) and
 * luminance 255→color2 (highlights).
 */

import type { RgbColor, ColorChangeResult } from "./image-effects";
import { parseHexToRgb } from "./image-effects";

// ---------------------------------------------------------------------------
// Pixel mapping (pure logic — operates on raw Uint8ClampedArray)
// ---------------------------------------------------------------------------

/**
 * Map every pixel in `data` through a duotone gradient.
 *
 * Algorithm:
 * 1. Compute luminance using BT.601 weights: `L = 0.2126·R + 0.7152·G + 0.0722·B`
 * 2. Normalise L to 0–1 range (`t = L / 255`)
 * 3. Interpolate each channel: `out = shadow * (1 - t) + highlight * t`
 *
 * Mutates `data` in-place for performance. Alpha is preserved.
 */
export function mapDuotonePixels(
  data: Uint8ClampedArray,
  shadow: RgbColor,
  highlight: RgbColor,
): void {
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    // BT.601 luminance
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const t = lum / 255;
    const oneMinusT = 1 - t;

    data[i] = Math.round(shadow.r * oneMinusT + highlight.r * t);
    data[i + 1] = Math.round(shadow.g * oneMinusT + highlight.g * t);
    data[i + 2] = Math.round(shadow.b * oneMinusT + highlight.b * t);
    // data[i + 3] — alpha preserved
  }
}

// ---------------------------------------------------------------------------
// High-level API
// ---------------------------------------------------------------------------

/**
 * Load an image from a data-URL, apply a duotone colour mapping, and return
 * a new PNG data-URL.
 *
 * @param imageDataUrl   Source image (data-URL or blob URL).
 * @param shadowHex      Hex colour for shadows / dark tones (e.g. `#000080`).
 * @param highlightHex   Hex colour for highlights / light tones (e.g. `#FFD700`).
 * @returns Processed image as a PNG data-URL with dimensions.
 */
export function applyDuotone(
  imageDataUrl: string,
  shadowHex: string,
  highlightHex: string,
): Promise<ColorChangeResult> {
  return new Promise((resolve, reject) => {
    const shadow = parseHexToRgb(shadowHex);
    const highlight = parseHexToRgb(highlightHex);
    if (!shadow || !highlight) {
      reject(
        new Error(
          `Invalid hex colour: shadow="${shadowHex}" highlight="${highlightHex}"`,
        ),
      );
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

      mapDuotonePixels(imageData.data, shadow, highlight);

      ctx.putImageData(imageData, 0, 0);

      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        width: w,
        height: h,
      });
    };

    img.onerror = () => {
      reject(new Error("Failed to load image for duotone processing"));
    };

    img.src = imageDataUrl;
  });
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const duotoneCache = new Map<string, string>();
const DUOTONE_CACHE_MAX = 64;

/** Build a deterministic cache key for duotone. */
export function buildDuotoneCacheKey(
  src: string,
  shadowHex: string,
  highlightHex: string,
): string {
  const srcKey = src.length > 64 ? src.slice(0, 64) : src;
  return `dt|${srcKey}|${shadowHex}|${highlightHex}`;
}

/** Get cached duotone result or `undefined`. */
export function getDuotoneCachedResult(key: string): string | undefined {
  return duotoneCache.get(key);
}

/** Store a duotone result in the cache. Evicts oldest entry when full. */
export function setDuotoneCachedResult(key: string, dataUrl: string): void {
  if (duotoneCache.size >= DUOTONE_CACHE_MAX) {
    const firstKey = duotoneCache.keys().next().value;
    if (firstKey !== undefined) {
      duotoneCache.delete(firstKey);
    }
  }
  duotoneCache.set(key, dataUrl);
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** A named duotone colour preset (shadow + highlight). */
export interface DuotonePreset {
  /** i18n label key. */
  labelKey: string;
  /** Shadow (dark) colour hex. */
  shadow: string;
  /** Highlight (light) colour hex. */
  highlight: string;
}

/** Built-in duotone presets matching common PowerPoint options. */
export const DUOTONE_PRESETS: DuotonePreset[] = [
  {
    labelKey: "pptx.image.duotonePresetNavyGold",
    shadow: "#000080",
    highlight: "#FFD700",
  },
  {
    labelKey: "pptx.image.duotonePresetTealWhite",
    shadow: "#004D4D",
    highlight: "#FFFFFF",
  },
  {
    labelKey: "pptx.image.duotonePresetPurplePink",
    shadow: "#2D004B",
    highlight: "#FF69B4",
  },
  {
    labelKey: "pptx.image.duotonePresetBlueOrange",
    shadow: "#001F4D",
    highlight: "#FF8C00",
  },
  {
    labelKey: "pptx.image.duotonePresetGreenYellow",
    shadow: "#003300",
    highlight: "#CCFF00",
  },
  {
    labelKey: "pptx.image.duotonePresetRedCream",
    shadow: "#4D0000",
    highlight: "#FFFDD0",
  },
  {
    labelKey: "pptx.image.duotonePresetBlackWhite",
    shadow: "#000000",
    highlight: "#FFFFFF",
  },
  {
    labelKey: "pptx.image.duotonePresetSepiaWarm",
    shadow: "#3B2614",
    highlight: "#F5DEB3",
  },
];
