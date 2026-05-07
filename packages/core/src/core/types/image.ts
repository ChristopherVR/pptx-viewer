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
 * Blend mode for `a:blend` container nodes inside an `a:effectDag` (CT_BlendEffect).
 *
 * Per ECMA-376 §20.1.8.10, valid values are: `darken`, `lighten`, `mult`,
 * `over`, `screen`.
 */
export type EffectDagBlendMode = 'darken' | 'lighten' | 'mult' | 'over' | 'screen';

/**
 * Container node kind inside an `a:effectDag` (CT_EffectContainer @type).
 *
 * Per ECMA-376 §20.1.8.20, `sib` (sibling) draws each child independently
 * over the same source; `tree` (tree) chains effects so each sees the output
 * of its siblings.
 */
export type EffectDagContainerType = 'sib' | 'tree';

/**
 * Typed model of the directed-acyclic effect graph stored in `a:effectDag`.
 *
 * The four "structural" container/transform nodes are typed; any other inner
 * effect (e.g. `a:outerShdw`, `a:glow`, `a:alphaInv`) is preserved verbatim
 * as a raw XML object via the {@link EffectDagRawLeaf} variant so we never
 * have to recurse into the full effect taxonomy.
 *
 * @example
 * ```ts
 * // <a:effectDag>
 * //   <a:cont type="sib">
 * //     <a:blend blend="mult"><a:cont type="tree" /></a:blend>
 * //   </a:cont>
 * // </a:effectDag>
 * const dag: EffectDagContainer = {
 *   kind: "cont",
 *   type: "sib",
 *   children: [{
 *     kind: "blend",
 *     mode: "mult",
 *     container: { kind: "cont", type: "tree", children: [] },
 *   }],
 * };
 * ```
 */
export type EffectDagNode =
	| EffectDagContainer
	| EffectDagBlend
	| EffectDagXfrm
	| EffectDagRelOff
	| EffectDagRawLeaf;

/** `a:cont` — CT_EffectContainer. Recursive; mirrors the top-level `effectDag`. */
export interface EffectDagContainer {
	kind: 'cont';
	/** `@type` — `sib` or `tree`. */
	type: EffectDagContainerType;
	/** Optional `@name` attribute. */
	name?: string;
	/** Ordered children. */
	children: EffectDagNode[];
}

/** `a:blend` — CT_BlendEffect. Always wraps a single `a:cont` child. */
export interface EffectDagBlend {
	kind: 'blend';
	/** `@blend` attribute. */
	mode: EffectDagBlendMode;
	/** Required child `a:cont` container. */
	container: EffectDagContainer;
}

/** `a:xfrmEffect` — CT_TransformEffect. Affine transform with no children. */
export interface EffectDagXfrm {
	kind: 'xfrmEffect';
	/** Horizontal scale, percentage * 1000 (e.g. 100000 = 100%). */
	sx?: number;
	/** Vertical scale, percentage * 1000. */
	sy?: number;
	/** Horizontal skew, degrees * 60000. */
	kx?: number;
	/** Vertical skew, degrees * 60000. */
	ky?: number;
	/** Horizontal translation in EMU. */
	tx?: number;
	/** Vertical translation in EMU. */
	ty?: number;
}

/** `a:relOff` — CT_RelativeOffsetEffect. Relative offset in 1000ths of a percent. */
export interface EffectDagRelOff {
	kind: 'relOff';
	/** Horizontal offset, percentage * 1000. */
	tx?: number;
	/** Vertical offset, percentage * 1000. */
	ty?: number;
}

/**
 * Catch-all leaf preserving any non-container effect (e.g. `a:outerShdw`,
 * `a:glow`, `a:alphaInv`) as raw XML. Re-emitted verbatim on save.
 */
export interface EffectDagRawLeaf {
	kind: 'raw';
	/** Local element name without the `a:` prefix (e.g. `outerShdw`, `glow`). */
	tag: string;
	/** Raw XML object captured at load — preserved verbatim on save. */
	xml: Record<string, unknown>;
}

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
	/**
	 * Alpha inverse effect (`a:alphaInv`). Inverts the alpha channel; an optional
	 * colour child shifts the inversion baseline.
	 */
	alphaInv?: {
		/** Optional baseline colour (hex). */
		color?: string;
	};
	/** Alpha ceiling (`a:alphaCeiling`) — clamps any non-zero alpha to fully opaque. Boolean flag. */
	alphaCeiling?: boolean;
	/** Alpha floor (`a:alphaFloor`) — clamps any non-fully-opaque alpha to fully transparent. Boolean flag. */
	alphaFloor?: boolean;
	/**
	 * Alpha modulate (`a:alphaMod`). The schema requires a single `cont` (effect
	 * container) child; we preserve the inner XML opaquely for round-trip.
	 */
	alphaMod?: {
		/** Raw opaque XML for the `a:cont` child to preserve on save. */
		contRawXml?: Record<string, unknown>;
	};
	/** Alpha replace (`a:alphaRepl`) — replaces alpha with the given fixed-percent value (0..100). */
	alphaRepl?: number;
	/** Alpha bi-level (`a:alphaBiLevel`) — threshold (0..100) above which alpha becomes fully opaque. */
	alphaBiLevel?: number;
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

// ==========================================================================
// Declaration merging — attach run-side effectDag fields to TextStyle
// ==========================================================================
// ECMA-376 §21.1.2.3.6 lists `a:effectDag` as a valid child of
// `CT_TextCharacterProperties` (the `<a:rPr>` element). Round-tripping it
// requires storing both the raw XML (for unknown leaf effects) and the
// typed tree of structural container nodes. We attach these via TypeScript
// declaration merging so the canonical TextStyle definition in `text.ts`
// stays untouched while the new fields remain co-located with the
// effectDag types they reference.

declare module './text' {
	interface TextStyle {
		/**
		 * Raw `a:effectDag` XML node from `a:rPr`, preserved verbatim for
		 * round-trip serialisation. Mirrors the shape-level
		 * {@link import('./shape-style').ShapeStyle.effectDagXml} field.
		 */
		textEffectDagXml?: import('./common').XmlObject;
		/**
		 * Typed effect graph parsed from `textEffectDagXml`. The four structural
		 * container nodes (`a:cont`, `a:blend`, `a:xfrmEffect`, `a:relOff`) are
		 * fully typed; any other leaf effect is captured as
		 * {@link EffectDagRawLeaf} so we never have to recurse into the full
		 * effect taxonomy.
		 */
		textEffectDagTree?: EffectDagContainer;
	}
}

declare module './shape-style' {
	interface ShapeStyle {
		/**
		 * Typed effect graph parsed from {@link ShapeStyle.effectDagXml}. The four
		 * structural container nodes (`a:cont`, `a:blend`, `a:xfrmEffect`,
		 * `a:relOff`) are fully typed; any other leaf effect (e.g. `a:outerShdw`,
		 * `a:glow`, `a:alphaInv`) is captured as {@link EffectDagRawLeaf} so we
		 * never have to recurse into the full effect taxonomy.
		 */
		effectDagTree?: EffectDagContainer;
	}
}
