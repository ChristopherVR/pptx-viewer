import {
  XmlObject,
  type PptxImageEffects,
  type MediaBookmark,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeTableStylesAndActions";

/** Timing data extracted from the OOXML timing tree for a single media element. */
export interface MediaTimingData {
  trimStartMs?: number;
  trimEndMs?: number;
  fullScreen?: boolean;
  loop?: boolean;
  posterFramePath?: string;
  volume?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  autoPlay?: boolean;
  playAcrossSlides?: boolean;
  hideWhenNotPlaying?: boolean;
  bookmarks?: MediaBookmark[];
  /** Playback speed multiplier (1 = normal). From p14:media/@spd (percentage * 1000). */
  playbackSpeed?: number;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Extract image recolour/brightness/contrast/artistic effects from blip extensions.
   */
  protected extractImageEffects(
    blip: XmlObject | undefined,
  ): PptxImageEffects | null {
    if (!blip) return null;
    const effects: PptxImageEffects = {};
    let hasAny = false;

    // Brightness and contrast from a:blip @bright / @contrast (hundredths of %)
    const brightRaw = blip["@_bright"] ?? blip["@_brt"];
    if (brightRaw != null) {
      const val = parseInt(String(brightRaw));
      if (Number.isFinite(val)) {
        effects.brightness = val / 1000;
        hasAny = true;
      }
    }
    const contrastRaw = blip["@_contrast"] ?? blip["@_cont"];
    if (contrastRaw != null) {
      const val = parseInt(String(contrastRaw));
      if (Number.isFinite(val)) {
        effects.contrast = val / 1000;
        hasAny = true;
      }
    }

    // Color effects in a:blip child nodes
    if (blip["a:grayscl"]) {
      effects.grayscale = true;
      hasAny = true;
    }

    // Alpha modulation fixed — overall opacity
    const alphaModFix = blip["a:alphaModFix"] as XmlObject | undefined;
    if (alphaModFix) {
      const amt = alphaModFix["@_amt"];
      if (amt !== undefined) {
        // amt is in 1/1000ths of a percent (e.g. 50000 = 50%)
        const pct = parseInt(String(amt)) / 1000;
        if (Number.isFinite(pct)) {
          effects.alphaModFix = pct;
          hasAny = true;
        }
      }
    }

    // Bi-level threshold — 1-bit black/white
    const biLevel = blip["a:biLevel"] as XmlObject | undefined;
    if (biLevel) {
      const thresh = biLevel["@_thresh"];
      if (thresh !== undefined) {
        // thresh is in 1/1000ths of a percent (e.g. 50000 = 50%)
        const pct = parseInt(String(thresh)) / 1000;
        if (Number.isFinite(pct)) {
          effects.biLevel = pct;
          hasAny = true;
        }
      }
    }

    // Colour change — swap one colour for another (commonly used for transparency keying)
    const clrChange = blip["a:clrChange"] as XmlObject | undefined;
    if (clrChange) {
      const clrFrom = clrChange["a:clrFrom"] as XmlObject | undefined;
      const clrTo = clrChange["a:clrTo"] as XmlObject | undefined;
      if (clrFrom && clrTo) {
        const fromColor = this.parseColor(clrFrom) || "#000000";
        const toColor = this.parseColor(clrTo) || "#ffffff";
        // Check if the target colour is fully transparent
        const toAlpha = this.extractColorOpacity(clrTo);
        effects.clrChange = {
          clrFrom: fromColor,
          clrTo: toColor,
          clrToTransparent: toAlpha !== undefined && toAlpha <= 0,
        };
        hasAny = true;
      }
    }

    // Duotone — collect child colour elements across all colour types
    const duotone = blip["a:duotone"] as XmlObject | undefined;
    if (duotone) {
      const duotoneColorNodes: XmlObject[] = [
        ...this.ensureArray(duotone["a:srgbClr"]),
        ...this.ensureArray(duotone["a:schemeClr"]),
        ...this.ensureArray(duotone["a:prstClr"]),
      ];
      if (duotoneColorNodes.length >= 2) {
        effects.duotone = {
          color1: this.parseColor(duotoneColorNodes[0]) || "#000000",
          color2: this.parseColor(duotoneColorNodes[1]) || "#ffffff",
        };
        hasAny = true;
      }
    }

    // Artistic effects from extension list
    const extLst = blip["a:extLst"];
    if (extLst) {
      const exts = this.ensureArray(extLst["a:ext"]);
      for (const ext of exts) {
        const uri = String(ext["@_uri"] || "");
        if (uri === "{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}") {
          const imgEffect = (ext["a14:imgEffect"] || ext["a14:imgLayer"]) as
            | XmlObject
            | undefined;
          if (imgEffect) {
            // Find the actual effect child (e.g. a14:artisticBlur, a14:artisticPencilGrayscale, etc.)
            const keys = Object.keys(imgEffect).filter((k) =>
              k.startsWith("a14:artistic"),
            );
            if (keys.length > 0) {
              const effectName = keys[0].replace("a14:", "");
              effects.artisticEffect = effectName;
              hasAny = true;
              // Try to extract radius/amount
              const effectNode = imgEffect[keys[0]] as XmlObject | undefined;
              if (effectNode) {
                const rad =
                  effectNode["@_radius"] ??
                  effectNode["@_amount"] ??
                  effectNode["@_pressure"];
                if (rad != null) {
                  effects.artisticRadius = parseInt(String(rad)) || 0;
                }
              }
            }
          }
        }
      }
    }

    return hasAny ? effects : null;
  }

  /**
   * Check for artistic image effects (`a14:imgEffect`) on images and report warnings.
   */
  // Artistic effects are fully round-tripped via rawXml — no warnings needed.
  protected inspectArtisticEffects(
    _blip: XmlObject | undefined,
    _slideId?: string,
    _elementId?: string,
  ): void {
    // No-op: full parity achieved.
  }

  /**
   * Check for SVG image references in blip extensions.
   * OOXML stores SVG via `a:blip/a:extLst/a:ext` with `asvg:svgBlip` child.
   */
  protected extractSvgBlipRelId(
    blip: XmlObject | undefined,
  ): string | undefined {
    if (!blip) return undefined;
    const extLst = blip["a:extLst"];
    if (!extLst) return undefined;

    const exts = this.ensureArray(extLst["a:ext"]);
    for (const ext of exts) {
      // SVG extension uses URI {96DAC541-7B7A-43D3-8B79-37D633B846F1}
      const uri = String(ext["@_uri"] || "");
      if (uri === "{96DAC541-7B7A-43D3-8B79-37D633B846F1}") {
        const svgBlip = ext["asvg:svgBlip"] || ext["a16:svgBlip"];
        if (svgBlip) {
          return String(svgBlip["@_r:embed"] || svgBlip["@_r:link"] || "");
        }
      }
    }
    return undefined;
  }

  /**
   * Resolve a relationship ID to a target path.
   * Uses the slideRelsMap (slidePath → Map<rId, target>).
   */
  protected resolveRelationshipTarget(
    sourcePath: string,
    rId: string,
  ): string | undefined {
    return this.mediaDataParser.resolveRelationshipTarget(sourcePath, rId);
  }
}
