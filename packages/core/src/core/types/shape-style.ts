/**
 * Shape visual styling types: fill, stroke, effects, and connectors.
 *
 * {@link ShapeStyle} is the main type attached to any element that has
 * visible geometry (shapes, connectors, images). It covers:
 * - **Fill**: solid, gradient, pattern, image, and theme fills
 * - **Stroke**: colour, width, dash pattern, line join/cap
 * - **Effects**: shadow, glow, soft-edge, reflection, blur
 * - **Connectors**: arrow-head types and connection points
 * - **3-D**: scene camera and shape extrusion/bevel
 *
 * All spatial values are stored in **pixels** (pre-converted from EMU).
 * Opacity values are normalised to the 0–1 range.
 *
 * @module pptx-types/shape-style
 */

// ==========================================================================
// Shape styling (fill, stroke, effects, connectors)
// ==========================================================================

import type { PptxThemeColorRef } from './color-ref';
import type {
	ConnectorArrowType,
	ConnectorConnectionPoint,
	ShadowEffect,
	StrokeDashType,
	XmlObject,
} from './common';
import type { EffectDagContainer } from './effect-dag';
import type { Pptx3DScene, Pptx3DShape } from './three-d';

export interface PptxCustomDashSegment {
	/** Dash length as a non-negative percentage in thousandths of one percent. */
	dash: number;
	/** Space length as a non-negative percentage in thousandths of one percent. */
	space: number;
}

/**
 * Comprehensive visual style for a shape, connector, or image element.
 *
 * All fields are optional. When absent, the element inherits from theme
 * or layout defaults. The interface models both simple styling (solid fill +
 * basic stroke) and advanced effects (multiple shadow layers, gradient
 * fills, 3-D extrusion).
 *
 * @example
 * ```ts
 * // Simple blue filled shape with a thin black outline:
 * const simple: ShapeStyle = {
 *   fillColor: "#0055AA",
 *   fillMode: "solid",
 *   strokeColor: "#000000",
 *   strokeWidth: 1,
 * };
 *
 * // Gradient fill with a soft shadow:
 * const fancy: ShapeStyle = {
 *   fillMode: "gradient",
 *   fillGradientType: "linear",
 *   fillGradientAngle: 135,
 *   fillGradientStops: [
 *     { color: "#FF6B6B", position: 0 },
 *     { color: "#556270", position: 1 },
 *   ],
 *   shadowColor: "#000000",
 *   shadowBlur: 10,
 *   shadowOffsetX: 4,
 *   shadowOffsetY: 4,
 *   shadowOpacity: 0.3,
 * };
 * // => both satisfy the ShapeStyle interface
 * ```
 */
export interface ShapeStyle {
	fillColor?: string;
	/**
	 * Raw XML colour-choice node preserved from `a:solidFill` for round-trip
	 * serialisation. Captures `a:schemeClr` / `a:sysClr` / `a:prstClr` /
	 * `a:srgbClr` plus colour transforms (`lumMod`, `lumOff`, `tint`,
	 * `shade`, `satMod`, `alpha`, …). On save we re-emit verbatim when the
	 * resolved {@link fillColor} still matches this node, otherwise we fall
	 * back to canonical `<a:srgbClr>`.
	 */
	fillColorXml?: XmlObject;
	/**
	 * Typed theme colour reference for the fill, set when {@link fillColorXml}
	 * is a plain `a:schemeClr` (see `themeColorRefFromColorChoice`). When
	 * present it WINS on save: the writer emits `<a:schemeClr>` from this ref
	 * instead of the resolved {@link fillColor}, so the fill keeps following
	 * the theme palette after a later theme change. `undefined` means the fill
	 * is a plain hex (or a colour kind a ref cannot express).
	 */
	fillColorRef?: PptxThemeColorRef;
	fillGradient?: string;
	/** Original `gradFill` XML retained for unknown-child and extension round-tripping. */
	fillGradientXml?: XmlObject;
	fillMode?: 'solid' | 'gradient' | 'pattern' | 'none' | 'image' | 'theme' | 'group';
	/**
	 * `<p:sp useBgFill="1">`: the shape paints with the SLIDE BACKGROUND's fill
	 * rather than its own or its theme style's.
	 *
	 * PowerPoint's designer emits full-bleed rectangles this way, and they also
	 * carry an `a:fillRef` pointing at `accent1`. Ignoring the attribute painted
	 * those panels in the accent colour, so a black-and-white title slide came out
	 * black-and-blue. The load pipeline copies the resolved slide background onto
	 * the fill fields; the flag stays for round-trip and for renderers that want
	 * to re-resolve against a changed background.
	 */
	useBackgroundFill?: boolean;
	fillPatternPreset?: string;
	fillPatternBackgroundColor?: string;
	/** Original `pattFill` XML retained for unknown-child round-tripping. */
	fillPatternXml?: XmlObject;
	/** Raw XML node for pattern fill foreground colour (preserves color transforms). */
	fillPatternFgClrXml?: XmlObject;
	/** Raw XML node for pattern fill background colour (preserves color transforms). */
	fillPatternBgClrXml?: XmlObject;
	/** Data-URI or URL for image fill (when fillMode === "image"). */
	fillImageUrl?: string;
	/** How the image is sized within the shape: stretch to fill, or tile/repeat. */
	fillImageMode?: 'stretch' | 'tile';
	fillGradientStops?: Array<{
		color: string;
		position: number;
		opacity?: number;
		/** Raw XML colour node preserved for round-trip (e.g. a:schemeClr with transforms). */
		originalColorXml?: XmlObject;
		/**
		 * Typed theme colour reference for this stop, set when
		 * {@link originalColorXml} is a plain `a:schemeClr`. Wins on save, same
		 * as {@link ShapeStyle.fillColorRef}.
		 */
		colorRef?: PptxThemeColorRef;
	}>;
	fillGradientAngle?: number;
	fillGradientType?: 'linear' | 'radial';
	/** Path gradient sub-type from `a:path/@path` (e.g. "circle", "rect", "shape"). */
	fillGradientPathType?: 'circle' | 'rect' | 'shape';
	/** Focal point for path (radial) gradients, derived from `a:fillToRect`.
	 *  Values are 0..1 fractions relative to shape bounds. */
	fillGradientFocalPoint?: { x: number; y: number };
	/** Raw fillToRect LTRB values (0..1 fractions) from `a:fillToRect`.
	 *  Defines the inner rectangle where the gradient reaches its final stop.
	 *  l/t are insets from left/top edges; r/b are insets from right/bottom edges. */
	fillGradientFillToRect?: { l: number; t: number; r: number; b: number };
	/** Raw tileRect LTRB values (0..1 fractions, may be negative) from
	 *  `a:gradFill/a:tileRect`. Defines the rectangle the gradient tile occupies
	 *  before any flip/tiling is applied. */
	fillGradientTileRect?: { l: number; t: number; r: number; b: number };
	/** Gradient tile flip mode (`a:gradFill/@flip`).
	 *  `none` = no tiling flip (default), `x|y|xy` = mirror in the named axis. */
	fillGradientFlip?: 'none' | 'x' | 'y' | 'xy';
	/** Whether the gradient rotates with the shape (`a:gradFill/@rotWithShape`).
	 *  Defaults to true per the schema; preserved for round-trip when the source
	 *  authored the attribute explicitly. */
	fillGradientRotWithShape?: boolean;
	/** Whether the linear gradient is scaled to the shape (`a:lin/@scaled`).
	 *  Defaults to true per the schema; preserved for round-trip. */
	fillGradientScaled?: boolean;
	fillOpacity?: number;
	strokeColor?: string;
	/**
	 * Raw XML colour-choice node preserved from `a:ln/a:solidFill` for
	 * round-trip serialisation. See {@link fillColorXml} for the rationale.
	 */
	strokeColorXml?: XmlObject;
	/**
	 * Typed theme colour reference for the outline, mirroring
	 * {@link fillColorRef}: set when {@link strokeColorXml} is a plain
	 * `a:schemeClr`, and wins on save.
	 */
	strokeColorRef?: PptxThemeColorRef;
	/**
	 * Kind of fill painted on the outline (`a:ln` child). Distinguishes a solid
	 * outline from a gradient/pattern/none outline so save can emit the correct
	 * single line fill instead of collapsing every outline to `a:solidFill`
	 * (which, alongside a preserved `a:gradFill`/`a:pattFill`, produces an
	 * invalid dual-fill `<a:ln>`).
	 */
	strokeFillMode?: 'solid' | 'gradient' | 'pattern' | 'none';
	/** Raw `a:ln/a:gradFill` XML preserved for round-trip when the outline is
	 *  gradient-filled. Re-emitted verbatim as the line's single fill on save. */
	strokeGradientXml?: XmlObject;
	/** Raw `a:ln/a:pattFill` XML preserved for round-trip when the outline is
	 *  pattern-filled. Re-emitted verbatim as the line's single fill on save. */
	strokePatternXml?: XmlObject;
	/**
	 * Structured stops of a gradient outline (`a:ln/a:gradFill/a:gsLst`), in the
	 * same shape as {@link fillGradientStops}.
	 *
	 * The raw XML above round-trips a gradient outline on save, but a renderer
	 * cannot paint from it: it needs resolved colours and positions. Without
	 * these, every binding fell back to {@link strokeColor} - a single averaged
	 * colour - so a two-tone outline painted flat and a fade-to-transparent
	 * outline painted fully opaque.
	 */
	strokeGradientStops?: ShapeStyle['fillGradientStops'];
	/** Gradient outline angle in OOXML degrees (`a:lin/@ang`), 0 = left to right. */
	strokeGradientAngle?: number;
	/** Gradient outline kind: `linear` (`a:lin`) or `radial` (`a:path`). */
	strokeGradientType?: ShapeStyle['fillGradientType'];
	/** Path-gradient shape for a radial outline (`a:path/@path`). */
	strokeGradientPathType?: ShapeStyle['fillGradientPathType'];
	/** Preset name of a pattern outline (`a:ln/a:pattFill/@prst`). */
	strokePatternPreset?: string;
	/** Background colour of a pattern outline (`a:ln/a:pattFill/a:bgClr`). */
	strokePatternBackgroundColor?: string;
	strokeWidth?: number;
	strokeOpacity?: number;
	strokeDash?: StrokeDashType;
	/** Line join style (`a:ln/@join`): round, bevel, or miter. */
	lineJoin?: 'round' | 'bevel' | 'miter';
	/** Miter limit (`a:miter/@lim`) in EMU-percent units (default 800000 = 8.0). Only meaningful when lineJoin is 'miter'. */
	miterLimit?: number;
	/** Line cap style (`a:ln/@cap`): flat, rnd, or sq. */
	lineCap?: 'flat' | 'rnd' | 'sq';
	/** Compound line type (`a:ln/@cmpd`). */
	compoundLine?: 'sng' | 'dbl' | 'thickThin' | 'thinThick' | 'tri';
	/** Pen line alignment (`a:ln/@algn`): `ctr` (centre, default) or `in` (inside). */
	lineAlignment?: 'ctr' | 'in';
	shadowColor?: string;
	/** Preserved source `a:effectLst`, including unknown effects and extensions. */
	effectListXml?: XmlObject;
	/** Original outer-shadow node used for lossless surgical updates. */
	outerShadowXml?: XmlObject;
	/** Resolved source shadow colour used to detect colour edits. */
	outerShadowOriginalColor?: string;
	/** Source shadow opacity used to detect alpha edits. */
	outerShadowOriginalOpacity?: number;
	shadowBlur?: number;
	shadowOffsetX?: number;
	shadowOffsetY?: number;
	shadowOpacity?: number;
	/** Preset shadow name from `a:prstShdw/@prst` (e.g. "shdw1"..."shdw20"). */
	presetShadowName?: string;
	/** Shadow angle in degrees (0-360). Parsed from `@_dir` (60000ths of a degree). */
	shadowAngle?: number;
	/** Shadow distance in pixels. Parsed from `@_dist` (EMUs). */
	shadowDistance?: number;
	/** Whether shadow rotates with shape. Parsed from `@_rotWithShape`. */
	shadowRotateWithShape?: boolean;
	/** Outer-shadow horizontal scaling (`a:outerShdw/@sx`) in 1000ths of a percent (default 100000 = 100%). */
	shadowScaleX?: number;
	/** Outer-shadow vertical scaling (`a:outerShdw/@sy`). */
	shadowScaleY?: number;
	/** Outer-shadow horizontal skew (`a:outerShdw/@kx`) in 60000ths of a degree. */
	shadowSkewX?: number;
	/** Outer-shadow vertical skew (`a:outerShdw/@ky`). */
	shadowSkewY?: number;
	/** Outer-shadow alignment (`a:outerShdw/@algn`). */
	shadowAlignment?: 'tl' | 't' | 'tr' | 'l' | 'ctr' | 'r' | 'bl' | 'b' | 'br';
	/** Inner-shadow rotateWithShape (`a:innerShdw/@rotWithShape`). */
	innerShadowRotateWithShape?: boolean;
	/** Reflection fade direction (`a:reflection/@fadeDir`) in 60000ths of a degree. */
	reflectionFadeDirection?: number;
	/** Reflection horizontal scaling (`a:reflection/@sx`). */
	reflectionScaleX?: number;
	/** Reflection vertical scaling (`a:reflection/@sy`). */
	reflectionScaleY?: number;
	/** Reflection horizontal skew (`a:reflection/@kx`). */
	reflectionSkewX?: number;
	/** Reflection vertical skew (`a:reflection/@ky`). */
	reflectionSkewY?: number;
	/** Reflection alignment (`a:reflection/@algn`). */
	reflectionAlignment?: 'tl' | 't' | 'tr' | 'l' | 'ctr' | 'r' | 'bl' | 'b' | 'br';
	/** Reflection rotateWithShape (`a:reflection/@rotWithShape`). */
	reflectionRotateWithShape?: boolean;
	/** Reflection start position (`a:reflection/@stPos`) as 0-1 fraction. */
	reflectionStartPosition?: number;
	/** Multiple shadow layers (for advanced effects). */
	shadows?: ShadowEffect[];
	glowColor?: string;
	/** Original glow node used for lossless surgical updates. */
	glowXml?: XmlObject;
	/** Resolved source glow colour used to detect colour edits. */
	glowOriginalColor?: string;
	/** Source glow opacity used to detect alpha edits. */
	glowOriginalOpacity?: number;
	glowRadius?: number;
	glowOpacity?: number;
	softEdgeRadius?: number;
	/** Inner shadow colour (`a:innerShdw`). */
	innerShadowColor?: string;
	/** Original inner-shadow node used for lossless surgical updates. */
	innerShadowXml?: XmlObject;
	/** Resolved source inner-shadow colour used to detect colour edits. */
	innerShadowOriginalColor?: string;
	/** Source inner-shadow opacity used to detect alpha edits. */
	innerShadowOriginalOpacity?: number;
	/** Inner shadow opacity (0-1). */
	innerShadowOpacity?: number;
	/** Inner shadow blur radius in px. */
	innerShadowBlur?: number;
	/** Inner shadow horizontal offset in px. */
	innerShadowOffsetX?: number;
	/** Inner shadow vertical offset in px. */
	innerShadowOffsetY?: number;
	/** Original soft-edge node, including vendor attributes and extensions. */
	softEdgeXml?: XmlObject;
	/** Reflection effect — distance from shape bottom in px. */
	reflectionBlurRadius?: number;
	/** Original reflection node, including vendor attributes and extensions. */
	reflectionXml?: XmlObject;
	/** Reflection start opacity (0-1). */
	reflectionStartOpacity?: number;
	/** Reflection end opacity (0-1). */
	reflectionEndOpacity?: number;
	/** Reflection end position (0-1 fraction of shape height). */
	reflectionEndPosition?: number;
	/** Reflection direction in degrees. */
	reflectionDirection?: number;
	/** Reflection rotation in degrees (`a:reflection/@rot` in 60000ths). */
	reflectionRotation?: number;
	/** Reflection distance in px. */
	reflectionDistance?: number;
	/** Standalone blur effect radius in px (`a:effectLst > a:blur`). */
	blurRadius?: number;
	/** Whether the blur effect grows the bounds of the shape (`a:blur/@grow`). */
	blurGrow?: boolean;
	connectorStartArrow?: ConnectorArrowType;
	/** Start arrow width size ('sm' | 'med' | 'lg'). */
	connectorStartArrowWidth?: 'sm' | 'med' | 'lg';
	/** Start arrow length size ('sm' | 'med' | 'lg'). */
	connectorStartArrowLength?: 'sm' | 'med' | 'lg';
	connectorEndArrow?: ConnectorArrowType;
	/** End arrow width size ('sm' | 'med' | 'lg'). */
	connectorEndArrowWidth?: 'sm' | 'med' | 'lg';
	/** End arrow length size ('sm' | 'med' | 'lg'). */
	connectorEndArrowLength?: 'sm' | 'med' | 'lg';
	/** Connection point for the start of a connector. */
	connectorStartConnection?: ConnectorConnectionPoint;
	/** Connection point for the end of a connector. */
	connectorEndConnection?: ConnectorConnectionPoint;
	/** Custom dash pattern, measured relative to line width in thousandths of one percent. */
	customDashSegments?: PptxCustomDashSegment[];
	/** Original `a:ds` payloads retained by index for lossless edits. */
	customDashSegmentXml?: XmlObject[];
	/** Original `a:custDash` payload retained for lossless edits. */
	customDashXml?: XmlObject;
	/** 3D scene/camera settings from `a:scene3d`. */
	scene3d?: Pptx3DScene;
	/** 3D shape extrusion/bevel from `a:sp3d`. */
	shape3d?: Pptx3DShape;
	/** Line-level shadow colour from `a:ln/a:effectLst/a:outerShdw`. */
	lineShadowColor?: string;
	/** Line-level shadow opacity (0-1). */
	lineShadowOpacity?: number;
	/** Line-level shadow blur radius in px. */
	lineShadowBlur?: number;
	/** Line-level shadow horizontal offset in px. */
	lineShadowOffsetX?: number;
	/** Line-level shadow vertical offset in px. */
	lineShadowOffsetY?: number;
	/** Line-level glow colour from `a:ln/a:effectLst/a:glow`. */
	lineGlowColor?: string;
	/** Line-level glow radius in px. */
	lineGlowRadius?: number;
	/** Line-level glow opacity (0-1). */
	lineGlowOpacity?: number;

	// ── Effect DAG properties (from `a:effectDag`) ──

	/** Raw `a:effectDag` XML node preserved for round-trip serialisation. */
	effectDagXml?: XmlObject;
	/**
	 * Typed effect graph parsed from {@link ShapeStyle.effectDagXml}. The four
	 * structural container nodes (`a:cont`, `a:blend`, `a:xfrmEffect`,
	 * `a:relOff`) are fully typed; any other leaf effect (e.g. `a:outerShdw`,
	 * `a:glow`, `a:alphaInv`) is captured as
	 * {@link import('./effect-dag').EffectDagRawLeaf} so we never have to
	 * recurse into the full effect taxonomy.
	 */
	effectDagTree?: EffectDagContainer;
	/** Grayscale flag from effectDag `a:grayscl`. */
	dagGrayscale?: boolean;
	/** Bi-level threshold (0-100) from effectDag `a:biLevel`. */
	dagBiLevel?: number;
	/** Brightness adjustment (-100 to 100) from effectDag `a:lum/@bright`. */
	dagLumBrightness?: number;
	/** Contrast adjustment (-100 to 100) from effectDag `a:lum/@contrast`. */
	dagLumContrast?: number;
	/** Hue rotation in degrees (0-360) from effectDag `a:hsl/@hue`. */
	dagHslHue?: number;
	/** Saturation adjustment from effectDag `a:hsl/@sat`. */
	dagHslSaturation?: number;
	/** Luminance adjustment from effectDag `a:hsl/@lum`. */
	dagHslLuminance?: number;
	/** Alpha modulation fixed (0-100) from effectDag `a:alphaModFix`. */
	dagAlphaModFix?: number;
	/** Tint hue in degrees from effectDag `a:tint/@hue`. */
	dagTintHue?: number;
	/** Tint amount (0-100) from effectDag `a:tint/@amt`. */
	dagTintAmount?: number;
	/** Duotone colour pair from effectDag `a:duotone`. */
	dagDuotone?: { color1: string; color2: string };
	/** Fill overlay blend mode from effectDag `a:fillOverlay/@blend`. */
	dagFillOverlayBlend?: 'over' | 'mult' | 'screen' | 'darken' | 'lighten';
	/**
	 * Fill overlay tint colour (hex `#RRGGBB`) from effectDag `a:fillOverlay`'s
	 * `a:solidFill`/`a:gradFill`. Painted as a blended overlay layer over the
	 * element; the blend mode comes from {@link dagFillOverlayBlend}.
	 */
	dagFillOverlayColor?: string;
	/** Fill overlay tint opacity (0-1), from the overlay fill colour's alpha. */
	dagFillOverlayOpacity?: number;

	// ── Direct effectLst fillOverlay (CT_EffectList §20.1.8.24) ───────────
	// `a:fillOverlay` is a legal direct sibling of the other effectLst
	// primitives (blur/glow/shadow/etc.), distinct from the effectDag form
	// above (different XML location, so kept in separate fields to avoid
	// the two colliding when both happen to be present).

	/** Fill overlay blend mode from a direct `a:effectLst/a:fillOverlay/@blend`. */
	shapeFillOverlayBlend?: 'over' | 'mult' | 'screen' | 'darken' | 'lighten';
	/**
	 * Fill overlay tint colour (hex `#RRGGBB`) from a direct
	 * `a:effectLst/a:fillOverlay`'s `a:solidFill`/`a:gradFill`.
	 */
	shapeFillOverlayColor?: string;
	/** Fill overlay tint opacity (0-1), from the overlay fill colour's alpha. */
	shapeFillOverlayOpacity?: number;
	/** Original source `a:fillOverlay` node, preserved for lossless surgical updates. */
	fillOverlayXml?: XmlObject;
	/** Resolved source fill-overlay colour used to detect colour edits. */
	shapeFillOverlayOriginalColor?: string;
	/** Source fill-overlay opacity used to detect alpha edits. */
	shapeFillOverlayOriginalOpacity?: number;

	// ── Style references (CT_ShapeStyle §20.1.2.2.36) ─────────────────────
	// These mirror the `<p:style>` element on a shape. They preserve the
	// theme matrix indices so PowerPoint's Recolor / Reset / Quick Style
	// behaviour continues to work after a save round-trip. The override
	// colour XML inside each ref is preserved verbatim for re-emission.

	/** `<a:lnRef @idx>` — 1-based index into the theme's lnStyleLst. */
	lnRefIdx?: number;
	/** Raw XML colour child of `<a:lnRef>` (e.g. `<a:schemeClr>` with transforms). */
	lnRefColorXml?: XmlObject;
	/** `<a:fillRef @idx>` — 1-based index into fillStyleLst (1-3) or bgFillStyleLst (1001-1003). */
	fillRefIdx?: number;
	/** Raw XML colour child of `<a:fillRef>`. */
	fillRefColorXml?: XmlObject;
	/** `<a:effectRef @idx>` — 1-based index into the theme's effectStyleLst. */
	effectRefIdx?: number;
	/** Raw XML colour child of `<a:effectRef>`. */
	effectRefColorXml?: XmlObject;
	/** `<a:fontRef @idx>` — typically `major`, `minor`, or `none`. */
	fontRefIdx?: string;
	/** Raw XML colour child of `<a:fontRef>`. */
	fontRefColorXml?: XmlObject;

	/**
	 * The fill `<a:fillRef>` resolved to, recorded ONLY when the shape's own
	 * `spPr` authored no fill at all, so the reference is what paints it.
	 *
	 * Its absence therefore means "the fill is the shape's own", and its
	 * presence plus an unchanged flat fill means "still purely inherited": see
	 * `authored-shape-style.ts`, the shape-scope twin of `TextStyle`'s
	 * `inheritedRunStyle`.
	 */
	inheritedFillStyle?: ShapeStyle;
	/**
	 * The outline `<a:lnRef>` resolved to, recorded before `spPr/a:ln` was
	 * layered on top. A property that still equals this baseline was never
	 * authored on the shape and must not be written back as if it were.
	 */
	inheritedLineStyle?: ShapeStyle;
	/**
	 * The shadow/glow/reflection/soft-edge/3D properties `<a:effectRef>`
	 * resolved from the theme's `effectStyleLst`, recorded ONLY for the
	 * properties the shape had not already authored itself. A shape whose
	 * effects still match this baseline was never given its own effects and
	 * must not have them written back as a literal `spPr/a:effectLst`; see
	 * `authored-shape-style.ts`'s `effectIsPurelyStyleMatrix`.
	 */
	inheritedEffectStyle?: ShapeStyle;
}
