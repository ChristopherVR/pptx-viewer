import type { PptxElement } from "../../core";
import { isImageLikeElement } from "../../core";
import { getDuotoneFilterId } from "./shape-visual-filters";

// ── Image effects CSS filter ─────────────────────────────────────────────
// Maps parsed PptxImageEffects to CSS filter strings.
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
  // Artistic effects — CSS approximations
  if (effects.artisticEffect) {
    const radius = effects.artisticRadius ?? 5;
    switch (effects.artisticEffect) {
      case "blur":
      case "glassEffect":
        filters.push(`blur(${Math.min(radius, 20)}px)`);
        break;
      case "pencilGrayscale":
      case "pencilSketch":
      case "lineDrawing":
        filters.push("grayscale(100%) contrast(150%)");
        break;
      case "paintStrokes":
      case "watercolorSponge":
        filters.push(`blur(${Math.min(radius, 8)}px) saturate(140%)`);
        break;
      case "filmGrain":
      case "texturizer":
        filters.push("contrast(110%) brightness(105%)");
        break;
      case "cement":
      case "crisscrossEtching":
        filters.push("grayscale(60%) contrast(120%)");
        break;
      case "photocopy":
        filters.push("grayscale(100%) contrast(200%) brightness(120%)");
        break;
      case "glow_edges":
        filters.push("contrast(180%) brightness(110%)");
        break;
      case "cutout":
        filters.push("contrast(300%) brightness(120%)");
        break;
      case "pastelsSmooth":
        filters.push(`blur(${Math.min(radius, 6)}px) saturate(120%)`);
        break;
      case "mosaicBubbles":
        filters.push(`blur(${Math.min(radius, 12)}px)`);
        break;
      case "artisticMarker":
      case "marker":
        filters.push("contrast(130%) saturate(130%)");
        break;
      case "artisticChalkSketch":
      case "chalkSketch":
        filters.push("grayscale(80%) contrast(140%) brightness(110%)");
        break;
      case "artisticPaint":
      case "paint":
        filters.push(
          `blur(${Math.min(radius, 5)}px) saturate(160%) contrast(110%)`,
        );
        break;
      case "artisticPlasticWrap":
      case "plasticWrap":
        filters.push("contrast(150%) brightness(115%) saturate(80%)");
        break;
      case "artisticLightScreen":
      case "lightScreen":
        filters.push("brightness(130%) contrast(80%)");
        break;
      case "artisticGlowDiffused":
      case "glowDiffused":
        filters.push(`blur(${Math.min(radius, 4)}px) brightness(120%)`);
        break;
      case "artisticGlowEdges":
      case "glowEdges":
        filters.push("invert(100%) contrast(200%) brightness(110%)");
        break;
      case "artisticSharpenEdges":
      case "sharpen":
        filters.push("contrast(160%) brightness(105%)");
        break;
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
