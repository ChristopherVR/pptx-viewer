/**
 * Image types: effects, crop shapes, and properties shared by image/picture
 * elements.
 *
 * @module pptx-types/image
 */

// ==========================================================================
// Image types: effects, crop shapes, and image properties
// ==========================================================================

import type { XmlObject } from './common';

export * from './effect-dag';

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
/**
 * One `a14:foregroundMark` / `a14:backgroundMark` polyline hint recorded while
 * the user painted over the picture in PowerPoint's "Remove Background" mode.
 * Coordinates are 0..1 fractions of the image.
 */
export interface PptxBackgroundRemovalMark {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/**
 * PowerPoint "Remove Background" state (`a14:backgroundRemoval`).
 *
 * The four edges are the RETAINED rectangle as 0..1 fractions of the image
 * (OOXML stores them as per-100000 relative units), and the mark lists are the
 * segmentation hints the user painted.
 *
 * **This is edit-time metadata, not a render instruction.** PowerPoint bakes the
 * removal into the bitmap referenced by the main `a:blip/@r:embed` and keeps the
 * pristine original in `a14:imgLayer/@r:embed`. Verified against PowerPoint COM:
 * a slide exported with and without this element is byte-identical. A renderer
 * that clips to the retained rectangle would clip an image whose background has
 * already been removed.
 *
 * @example
 * ```ts
 * const removal: PptxBackgroundRemoval = { top: 0.12, bottom: 0.88, left: 0.07, right: 0.93 };
 * // => retains the middle of the image; the marks list stays empty
 * ```
 */
export interface PptxBackgroundRemoval {
	/** Top edge of the retained rectangle (0..1 fraction of the image height). */
	top: number;
	/** Bottom edge of the retained rectangle (0..1 fraction of the image height). */
	bottom: number;
	/** Left edge of the retained rectangle (0..1 fraction of the image width). */
	left: number;
	/** Right edge of the retained rectangle (0..1 fraction of the image width). */
	right: number;
	/** Strokes marking regions the user forced to be foreground. */
	foregroundMarks?: PptxBackgroundRemovalMark[];
	/** Strokes marking regions the user forced to be background. */
	backgroundMarks?: PptxBackgroundRemovalMark[];
	/** Original effect XML, retained for lossless re-emission. */
	rawXml?: XmlObject;
}

export interface PptxImageEffects {
	/** Brightness adjustment (-100 to 100). */
	brightness?: number;
	/** Contrast adjustment (-100 to 100). */
	contrast?: number;
	/** Duotone colour pair. */
	duotone?: {
		color1: string;
		color2: string;
		/** Original effect XML, retained while the resolved colours are unchanged. */
		rawXml?: XmlObject;
	};
	/** Grayscale flag. */
	grayscale?: boolean;
	/** Saturation adjustment (-100 to 100). */
	saturation?: number;
	/** Color wash overlay. */
	colorWash?: { color: string; opacity: number };
	/** Artistic effect name (blur, pencilGrayscale, paintStrokes, etc.). */
	artisticEffect?: string;
	/** Artistic effect radius/amount, normalised to 0..100. */
	artisticRadius?: number;
	/**
	 * Every numeric attribute of the source `a14:artistic*` element, raw and
	 * un-normalised (`trans`, `pencilSize`, `crackSpacing`, …). The attribute set
	 * differs per effect, so this is the lossless companion to the single
	 * {@link PptxImageEffects.artisticRadius} number.
	 */
	artisticParams?: Record<string, number>;
	/**
	 * Name of the artistic effect ALREADY baked into the image data, which a
	 * renderer must not apply a second time. Set from the `a14` blip extension,
	 * which PowerPoint writes alongside a pre-rendered bitmap (see
	 * {@link PptxBackgroundRemoval}), and normally equal to
	 * {@link PptxImageEffects.artisticEffect}.
	 *
	 * It records the NAME rather than a boolean so that picking a different
	 * effect in this library's inspector (which patches `artisticEffect` alone)
	 * still renders: the two names then differ.
	 */
	artisticPrerenderedEffect?: string;
	/**
	 * PowerPoint "Remove Background" state (`a14:backgroundRemoval`). Edit-time
	 * metadata: the removal is already baked into the image data.
	 */
	backgroundRemoval?: PptxBackgroundRemoval;
	/**
	 * `a14:imgLayer/@r:embed` — relationship id of the PRISTINE original image
	 * the baked effects were derived from (PowerPoint stores it as an HD Photo
	 * `.wdp` part, which browsers cannot decode).
	 */
	originalImageRelId?: string;
	/** Alpha modulation fixed: non-negative percentage (100 means unchanged opacity). */
	alphaModFix?: number;
	/** Original alpha modulation fixed node, including foreign attributes. */
	alphaModFixRawXml?: XmlObject;
	/** Bi-level threshold — converts to 1-bit black/white (0-100). */
	biLevel?: number;
	/** Colour change — swap one colour range for another (used for transparency keying). */
	clrChange?: {
		clrFrom: string;
		clrTo: string;
		/** Whether the target colour is fully transparent (alpha = 0). */
		clrToTransparent?: boolean;
		/** Original effect XML, including colour transforms and extensions. */
		rawXml?: XmlObject;
	};
	/** Original grayscale node, including extension or foreign attributes. */
	grayscaleRawXml?: XmlObject;
	/** Original bi-level node, including extension or foreign attributes. */
	biLevelRawXml?: XmlObject;
	/**
	 * Alpha inverse effect (`a:alphaInv`). Inverts the alpha channel; an optional
	 * colour child shifts the inversion baseline.
	 */
	alphaInv?: {
		/** Optional baseline colour (hex). */
		color?: string;
		/** Original effect XML, including colour transforms and foreign attributes. */
		rawXml?: XmlObject;
	};
	/** Alpha ceiling (`a:alphaCeiling`) — clamps any non-zero alpha to fully opaque. Boolean flag. */
	alphaCeiling?: boolean;
	/** Original alpha ceiling node, including foreign attributes. */
	alphaCeilingRawXml?: XmlObject;
	/** Alpha floor (`a:alphaFloor`) — clamps any non-fully-opaque alpha to fully transparent. Boolean flag. */
	alphaFloor?: boolean;
	/** Original alpha floor node, including foreign attributes. */
	alphaFloorRawXml?: XmlObject;
	/**
	 * Alpha modulate (`a:alphaMod`). The schema requires a single `cont` (effect
	 * container) child; we preserve the inner XML opaquely for round-trip.
	 */
	alphaMod?: {
		/** Raw opaque XML for the `a:cont` child to preserve on save. */
		contRawXml?: Record<string, unknown>;
		/** Original effect XML, including foreign attributes. */
		rawXml?: XmlObject;
		/**
		 * Multiplicative alpha percentage (0..100+), read from a nested
		 * `<a:alphaModFix>` inside `contRawXml` when present - the common
		 * real-world shape of `a:alphaMod` (`<a:cont><a:alphaModFix amt="…"/>
		 * </a:cont>`). Derived/read-only: a renderer multiplies the source alpha
		 * by this, distinct from the top-level {@link alphaModFix} sibling
		 * effect. Not written back independently on save; `contRawXml` is what
		 * round-trips.
		 */
		amt?: number;
	};
	/** Alpha replace (`a:alphaRepl`) — replaces alpha with the given fixed-percent value (0..100). */
	alphaRepl?: number;
	/** Original alpha replace node, including foreign attributes. */
	alphaReplRawXml?: XmlObject;
	/** Alpha bi-level (`a:alphaBiLevel`) — threshold (0..100) above which alpha becomes fully opaque. */
	alphaBiLevel?: number;
	/** Original alpha bi-level node, including foreign attributes. */
	alphaBiLevelRawXml?: XmlObject;
	/**
	 * Colour replace (`a:clrRepl`) — replaces all colour information in an image
	 * with the given solid colour. Stores the raw colour child to preserve scheme
	 * colour references and modifiers.
	 */
	clrRepl?: {
		/** Resolved hex colour. */
		color: string;
		/** Raw opaque colour XML for round-trip. */
		rawXml?: Record<string, unknown>;
	};
	/** Luminance modulation (`a:lum`) — bright/contrast as fixed percentages (0..100). */
	lum?: {
		bright?: number;
		contrast?: number;
	};
	/** HSL modulation (`a:hsl`) — hue (0..360 degrees), saturation/luminance (-100..100). */
	hsl?: {
		hue?: number;
		sat?: number;
		lum?: number;
	};
	/** Image-effect tint (`a:tint` inside blip) — hue (0..360), amount (-100..100). */
	tint?: {
		hue?: number;
		amt?: number;
	};
	/**
	 * Fill overlay (`a:fillOverlay`) — overlays a fill on top of the blip.
	 * Stores blend mode and the raw inner fill XML for round-trip.
	 */
	fillOverlay?: {
		blend: 'over' | 'mult' | 'screen' | 'darken' | 'lighten';
		/** Raw opaque fill XML preserved for round-trip. */
		fillRawXml?: Record<string, unknown>;
		/**
		 * Resolved hex colour, when the overlay fill is a plain `a:solidFill`
		 * (the common case for a picture-style colour overlay). `undefined` for
		 * a gradient/pattern/picture overlay fill, which a renderer can't yet
		 * composite from this derived field alone - `fillRawXml` still round-trips
		 * losslessly regardless.
		 */
		resolvedColor?: string;
		/** Resolved opacity (0-1) of the `a:solidFill` overlay colour, when resolved. */
		resolvedOpacity?: number;
	};
	/** Blur (`a:blur`) — radius in EMU and grow flag. */
	blur?: {
		rad?: number;
		grow?: boolean;
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
	| 'none'
	| 'ellipse'
	| 'roundedRect'
	| 'triangle'
	| 'diamond'
	| 'pentagon'
	| 'hexagon'
	| 'star';

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
	/**
	 * Stretch target inset from the left frame edge as a signed fraction
	 * (OOXML `a:stretch/a:fillRect/@l`). Unlike `cropLeft` (which selects a
	 * region of the SOURCE bitmap), a fill-rect selects the region of the
	 * FRAME the whole image is stretched into; negative values push the
	 * image beyond the frame edge, and the overflow is clipped.
	 */
	fillRectLeft?: number;
	/** Stretch target inset from the top frame edge (`a:fillRect/@t`). */
	fillRectTop?: number;
	/** Stretch target inset from the right frame edge (`a:fillRect/@r`). */
	fillRectRight?: number;
	/** Stretch target inset from the bottom frame edge (`a:fillRect/@b`). */
	fillRectBottom?: number;
	/** Image tiling offset X in px. */
	tileOffsetX?: number;
	/** Image tiling offset Y in px. */
	tileOffsetY?: number;
	/** Image tiling scale X as percentage (100 = 100%). */
	tileScaleX?: number;
	/** Image tiling scale Y as percentage (100 = 100%). */
	tileScaleY?: number;
	/** Image tiling flip mode. */
	tileFlip?: 'none' | 'x' | 'y' | 'xy';
	/** Image tiling alignment. */
	tileAlignment?: string;
	/** Image recolour/artistic effect properties. */
	imageEffects?: PptxImageEffects;
	/** Crop-to-shape — CSS clip-path shape name. */
	cropShape?: PptxCropShape;
}

// The run-side (`TextStyle.textEffectDagXml` / `textEffectDagTree`) and
// shape-side (`ShapeStyle.effectDagTree`) effectDag fields used to be attached
// here via `declare module './text'` / `declare module './shape-style'`
// declaration merging. They are now declared inline on the canonical
// interfaces: a relative-path module augmentation does not survive `.d.ts`
// bundling (the emitted `declare module` points at a path that no longer
// exists in the flattened output), which silently dropped the fields from
// every published binding's types.
