/**
 * Image types: effects, crop shapes, and properties shared by image/picture
 * elements.
 *
 * @module pptx-types/image
 */

// ==========================================================================
// Image types: effects, crop shapes, and image properties
// ==========================================================================

/**
 * Image recolour/adjustment properties parsed from blip extensions.
 *
 * These effects are stored in the OpenXML `<a:blip>` extension list
 * and applied non-destructively to the original image data.
 *
 * @example
 * ```ts
 * const fx: PptxImageEffects = {
 *   brightness: 20,
 *   contrast: -10,
 *   grayscale: true,
 * };
 * // => { brightness: 20, contrast: -10, grayscale: true } satisfies PptxImageEffects
 * ```
 */
export interface PptxImageEffects {
  /** Brightness adjustment (-100 to 100). */
  brightness?: number;
  /** Contrast adjustment (-100 to 100). */
  contrast?: number;
  /** Duotone colour pair. */
  duotone?: { color1: string; color2: string };
  /** Grayscale flag. */
  grayscale?: boolean;
  /** Saturation adjustment (-100 to 100). */
  saturation?: number;
  /** Color wash overlay. */
  colorWash?: { color: string; opacity: number };
  /** Artistic effect name (blur, pencilGrayscale, paintStrokes, etc.). */
  artisticEffect?: string;
  /** Artistic effect radius/amount. */
  artisticRadius?: number;
  /** Alpha modulation fixed — overall opacity (0-100, where 100 = fully opaque). */
  alphaModFix?: number;
  /** Bi-level threshold — converts to 1-bit black/white (0-100). */
  biLevel?: number;
  /** Colour change — swap one colour range for another (used for transparency keying). */
  clrChange?: {
    clrFrom: string;
    clrTo: string;
    /** Whether the target colour is fully transparent (alpha = 0). */
    clrToTransparent?: boolean;
  };
}

/**
 * Shape names used for crop-to-shape (CSS `clip-path` equivalent).
 *
 * @example
 * ```ts
 * const shape: PptxCropShape = "ellipse";
 * // => "ellipse" — one of: none | ellipse | roundedRect | triangle | diamond | pentagon | hexagon | star
 * ```
 */
export type PptxCropShape =
  | "none"
  | "ellipse"
  | "roundedRect"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star";

/**
 * Image content mixin — present on image and picture elements.
 *
 * Contains the decoded image data (base64 data URL or archive path),
 * alt text, crop insets, tiling settings, and image effects.
 *
 * @example
 * ```ts
 * const props: PptxImageProperties = {
 *   imagePath: "ppt/media/image1.png",
 *   altText: "Company logo",
 *   cropLeft: 0.05,
 *   cropRight: 0.05,
 * };
 * // => { imagePath: "ppt/media/image1.png", altText: "Company logo", cropLeft: 0.05, cropRight: 0.05 }
 * ```
 */
export interface PptxImageProperties {
  /** Base64 data-URL for the decoded image. */
  imageData?: string;
  /** Path within the PPTX ZIP archive. */
  imagePath?: string;
  /** Base64 data-URL for an SVG variant (from blip extension asvg:svgBlip). Preferred over raster when available. */
  svgData?: string;
  /** Path to the SVG file within the PPTX ZIP archive. */
  svgPath?: string;
  /** Alt text / description from `p:cNvPr/@descr`. */
  altText?: string;
  /** Crop from left edge as 0..1 fraction (OOXML `a:srcRect/@l`). */
  cropLeft?: number;
  /** Crop from top edge as 0..1 fraction (OOXML `a:srcRect/@t`). */
  cropTop?: number;
  /** Crop from right edge as 0..1 fraction (OOXML `a:srcRect/@r`). */
  cropRight?: number;
  /** Crop from bottom edge as 0..1 fraction (OOXML `a:srcRect/@b`). */
  cropBottom?: number;
  /** Image tiling offset X in px. */
  tileOffsetX?: number;
  /** Image tiling offset Y in px. */
  tileOffsetY?: number;
  /** Image tiling scale X as percentage (100 = 100%). */
  tileScaleX?: number;
  /** Image tiling scale Y as percentage (100 = 100%). */
  tileScaleY?: number;
  /** Image tiling flip mode. */
  tileFlip?: "none" | "x" | "y" | "xy";
  /** Image tiling alignment. */
  tileAlignment?: string;
  /** Image recolour/artistic effect properties. */
  imageEffects?: PptxImageEffects;
  /** Crop-to-shape — CSS clip-path shape name. */
  cropShape?: PptxCropShape;
}
