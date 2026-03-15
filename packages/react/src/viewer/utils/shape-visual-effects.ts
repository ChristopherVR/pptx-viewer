import type { PptxElement } from "pptx-viewer-core";
import { isImageLikeElement } from "pptx-viewer-core";
import { getDuotoneFilterId } from "./shape-visual-filters";
import {
  needsSvgArtisticFilter,
  getArtisticFilterId,
} from "./artistic-effects";

// ── Helpers ───────────────────────────────────────────────────────────────

/** Normalize a radius value (0–100) to a 0–1 float for proportional scaling. */
function normalizeRadius01(radius: number): number {
  return Math.max(0, Math.min(1, radius / 100));
}

// ── Image effects CSS filter ─────────────────────────────────────────────
// Maps parsed PptxImageEffects to CSS filter strings.
// For complex artistic effects (film grain, cutout, mosaic, etc.) the filter
// string references an inline SVG `<filter>` definition that must be rendered
// alongside the image via `renderArtisticEffectSvgFilter()`.
export function getImageEffectsFilter(
  element: PptxElement,
  options?: { excludeDuotone?: boolean },
): string | undefined {
  if (!isImageLikeElement(element)) return undefined;
  const effects = element.imageEffects;
  if (!effects) return undefined;

  const filters: string[] = [];

  // Brightness: OOXML hundredths-of-percent → CSS multiplier
  if (typeof effects.brightness === "number" && effects.brightness !== 0) {
    filters.push(`brightness(${Math.max(0, 1 + effects.brightness / 100)})`);
  }
  // Contrast: OOXML hundredths-of-percent → CSS multiplier
  if (typeof effects.contrast === "number" && effects.contrast !== 0) {
    filters.push(`contrast(${Math.max(0, 1 + effects.contrast / 100)})`);
  }
  // Saturation: -100..100 → CSS saturate() multiplier
  if (typeof effects.saturation === "number" && effects.saturation !== 0) {
    filters.push(`saturate(${Math.max(0, 1 + effects.saturation / 100)})`);
  }
  // Grayscale
  if (effects.grayscale) {
    filters.push("grayscale(100%)");
  }
  // Duotone: use inline SVG filter reference (rendered by DuotoneSvgFilter)
  // Skipped when canvas-based DuotoneImage handles it.
  if (effects.duotone && !options?.excludeDuotone) {
    const filterId = getDuotoneFilterId(element.id);
    filters.push(`url(#${filterId})`);
  }
  // Artistic effects
  // For effects that need SVG filters, reference the inline SVG filter via url(#id).
  // For simpler effects, use CSS filter functions directly.
  if (effects.artisticEffect) {
    const radius = effects.artisticRadius ?? 5;

    if (needsSvgArtisticFilter(effects.artisticEffect)) {
      // Complex effect — reference the SVG filter that must be rendered by
      // renderArtisticEffectSvgFilter() alongside the image element.
      const filterId = getArtisticFilterId(element.id);
      filters.push(`url(#${filterId})`);
    } else {
      // Simple effects — CSS-only approximations
      switch (effects.artisticEffect) {
        // ── Blur ─────────────────────────────────────────────────────────
        case "blur":
        case "glassEffect":
          filters.push(`blur(${Math.min(radius, 20)}px)`);
          break;
        case "artisticBlur":
          filters.push(`blur(${Math.min(radius, 20)}px)`);
          break;
        case "artisticGaussianBlur":
          // Gaussian blur uses a wider radius mapping
          filters.push(`blur(${Math.min(Math.round(radius * 1.2), 24)}px)`);
          break;

        // ── Line Drawing ─────────────────────────────────────────────────
        case "lineDrawing":
          filters.push("grayscale(100%) contrast(150%)");
          break;
        case "artisticLineDrawing":
          filters.push("grayscale(100%) contrast(150%)");
          break;

        // ── Paint effects ────────────────────────────────────────────────
        case "paintStrokes":
        case "watercolorSponge":
          filters.push(
            `blur(${Math.min(radius, 8)}px) saturate(140%) brightness(105%)`,
          );
          break;
        case "artisticPaintStrokes":
          filters.push(
            `blur(${Math.min(radius, 8)}px) saturate(140%) brightness(105%)`,
          );
          break;
        case "artisticWatercolorSponge":
          filters.push(
            `blur(${Math.min(radius, 8)}px) saturate(150%) brightness(108%)`,
          );
          break;
        case "artisticPaint":
        case "paint":
          filters.push(
            `blur(${Math.min(radius, 5)}px) saturate(160%) contrast(110%)`,
          );
          break;
        case "artisticPaintBrush":
        case "paintBrush":
          filters.push(
            `blur(${Math.min(radius, 6)}px) saturate(130%)`,
          );
          break;

        // ── Photocopy ────────────────────────────────────────────────────
        case "photocopy":
          filters.push("grayscale(100%) contrast(200%) brightness(120%)");
          break;
        case "artisticPhotocopy":
          filters.push("grayscale(100%) contrast(200%) brightness(120%)");
          break;

        // ── Pastels ──────────────────────────────────────────────────────
        case "pastelsSmooth":
        case "pastels":
          filters.push(
            `blur(${Math.min(radius, 6)}px) saturate(85%) brightness(105%)`,
          );
          break;
        case "artisticPastelsSmooth":
        case "artisticPastels":
          filters.push(
            `blur(${Math.min(radius, 6)}px) saturate(85%) brightness(105%)`,
          );
          break;

        // ── Marker ───────────────────────────────────────────────────────
        case "artisticMarker":
        case "marker":
          filters.push("contrast(130%) saturate(150%)");
          break;

        // ── Plastic Wrap ─────────────────────────────────────────────────
        case "artisticPlasticWrap":
        case "plasticWrap":
          filters.push("contrast(150%) brightness(115%) saturate(80%)");
          break;

        // ── Light Screen ─────────────────────────────────────────────────
        case "artisticLightScreen":
        case "lightScreen":
          filters.push(
            `brightness(${1.2 + normalizeRadius01(radius) * 0.3}) saturate(${Math.max(0.5, 0.8 - normalizeRadius01(radius) * 0.3)})`,
          );
          break;

        // ── Glow Diffused ────────────────────────────────────────────────
        case "artisticGlowDiffused":
        case "glowDiffused":
          filters.push(
            `blur(${Math.min(radius, 6)}px) brightness(${1.15 + normalizeRadius01(radius) * 0.15})`,
          );
          break;

        // ── Sharpen Edges ────────────────────────────────────────────────
        case "artisticSharpenEdges":
        case "sharpen":
          filters.push("contrast(160%) brightness(105%)");
          break;

        // ── Glass ────────────────────────────────────────────────────────
        case "glass":
        case "artisticGlass":
          filters.push(
            `blur(${Math.min(radius, 6)}px) brightness(110%)`,
          );
          break;

        // ── Catch-all for any unrecognized artistic effect ───────────────
        // Apply a generic mild filter so nothing is a complete no-op
        default:
          filters.push("contrast(105%) saturate(105%)");
          break;
      }
    }
  }

  // Bi-level: 1-bit black/white threshold via extreme contrast + brightness
  if (typeof effects.biLevel === "number") {
    const thresh = Math.max(0, Math.min(100, effects.biLevel));
    filters.push(`grayscale(100%) contrast(1000%) brightness(${thresh}%)`);
  }

  return filters.length > 0 ? filters.join(" ") : undefined;
}

/**
 * Extract opacity for an image element from `alphaModFix` effect.
 * Returns a 0-1 value suitable for CSS `opacity`, or undefined if not set.
 */
export function getImageEffectsOpacity(
  element: PptxElement,
): number | undefined {
  if (!isImageLikeElement(element)) return undefined;
  const effects = element.imageEffects;
  if (!effects) return undefined;

  if (typeof effects.alphaModFix === "number") {
    return Math.max(0, Math.min(1, effects.alphaModFix / 100));
  }
  return undefined;
}
