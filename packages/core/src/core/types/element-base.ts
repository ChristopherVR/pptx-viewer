/**
 * Base and mixin interfaces for all PPTX slide elements, plus
 * placeholder inheritance types.
 *
 * Every concrete element variant (text, shape, image …) extends
 * {@link PptxElementBase}. Text-bearing elements also mix in
 * {@link PptxTextProperties}, and shapes / connectors / images add
 * {@link PptxShapeProperties}.
 *
 * @module pptx-types/element-base
 */

// ==========================================================================
// Element base & mixin interfaces, placeholder inheritance types
// ==========================================================================

import type { PptxAction } from './actions';
import type { XmlObject, PptxShapeLocks } from './common';
import type { GeometryAdjustmentHandle } from './geometry';
import type { ShapeStyle } from './shape-style';
import type { TextStyle, TextSegment } from './text';

/**
 * Properties shared by **every** element on a slide.
 *
 * Position and size are in pixels (converted from EMU at parse time).
 * Optional properties apply to subsets of elements or may be absent in
 * the original OOXML.
 *
 * @example
 * ```ts
 * const base: PptxElementBase = {
 *   id: "el_001",
 *   x: 100, y: 50,
 *   width: 400, height: 200,
 *   rotation: 15,
 *   opacity: 0.9,
 * };
 * // => satisfies PptxElementBase
 * ```
 */
export interface PptxElementBase {
	id: string;
	/**
	 * The shape's native OOXML id from `p:cNvPr/@id` (an unsigned integer, as a
	 * string), captured on load. Distinct from {@link id}, which is a synthetic
	 * positional identity (`${slidePath}-shape-${index}`) the loader assigns for
	 * selection / undo / template tracking. Animations target shapes by this
	 * native id (`p:spTgt/@spid`), so it is the stable key used to reconcile an
	 * animation to the element it animates across a save/reload round trip.
	 * Absent on SDK-created elements until one is minted at save time.
	 */
	shapeId?: string;
	/** Element name from `cNvPr/@name`. Used for morph transition matching via the `!!` naming convention. */
	name?: string;
	/**
	 * `p:nvSpPr/p:nvPr/p:ph/@type` (lower-cased) when the shape is a placeholder:
	 * `title`, `ctrtitle`, `body`, `subtitle`, `ftr`, `dt`, `sldnum`, ...
	 *
	 * Captured on load so consumers can tell a footer placeholder from a text box
	 * without re-walking `rawXml`. Absent on non-placeholder shapes and on
	 * SDK-created elements.
	 */
	placeholderType?: string;
	/**
	 * `p:nvSpPr/p:nvPr/p:ph/@sz` (lower-cased): `"full"`, `"half"`, or
	 * `"quarter"`. Captured on load for round-trip completeness. Per
	 * ECMA-376 §19.3.1.36 (CT_Placeholder) this size hint is only meaningful
	 * when NO `a:xfrm` exists anywhere in the placeholder's inheritance
	 * chain (slide -> layout -> master); every real-world corpus placeholder
	 * that carries `@sz` already has an explicit `a:xfrm` at the master
	 * level, so no renderer currently derives a size from this field.
	 */
	placeholderSz?: string;
	/**
	 * `p:nvSpPr/p:nvPr/p:ph/@orient` (only `"vert"` is meaningful per
	 * `ST_Direction`). Captured on load for round-trip completeness. In
	 * practice every placeholder observed with `orient="vert"` also carries
	 * an explicit `a:bodyPr/@vert`, which already drives vertical-text
	 * rendering, so this field is not currently read by any renderer.
	 */
	placeholderOrient?: 'vert';
	x: number;
	y: number;
	width: number;
	height: number;
	/**
	 * The exact EMU integer `x` was parsed from (the `a:off/@_x` this
	 * element's own `a:xfrm` carried on load), when the parser could resolve
	 * one. `x` itself is always `Math.round(xEmu / EMU_PER_PX)` at parse
	 * time, but that rounding is lossy: re-deriving EMU from `x` on save
	 * (`Math.round(x * EMU_PER_PX)`) can drift from the original value by up
	 * to half a pixel's worth of EMU on every load/save cycle even when
	 * nothing touched this element. Kept alongside `x` (not instead of it) so
	 * every consumer that only cares about on-screen position is unaffected;
	 * only the save-side xfrm writer (`resolveXfrmEmu` in
	 * `xfrm-emu-resolution.ts`) reads this, and only when `x` still equals
	 * `Math.round(xEmu / EMU_PER_PX)` (i.e. nothing moved this element since
	 * load) does it re-emit `xEmu` verbatim instead of re-quantizing `x`.
	 * `undefined` for an SDK-created element or one whose transform could not
	 * be resolved to a usable `a:off` on load.
	 */
	xEmu?: number;
	/** The exact EMU integer `y` was parsed from (`a:off/@_y`). See {@link xEmu}. */
	yEmu?: number;
	/** The exact EMU integer `width` was parsed from (`a:ext/@_cx`). See {@link xEmu}. */
	widthEmu?: number;
	/** The exact EMU integer `height` was parsed from (`a:ext/@_cy`). See {@link xEmu}. */
	heightEmu?: number;
	rotation?: number;
	/** Skew along the X axis in degrees (parsed from `@_skewX` in 1/60000ths of a degree). */
	skewX?: number;
	/** Skew along the Y axis in degrees (parsed from `@_skewY` in 1/60000ths of a degree). */
	skewY?: number;
	flipHorizontal?: boolean;
	flipVertical?: boolean;
	/** Whether this element is hidden (used by the Elements Panel visibility toggle). */
	hidden?: boolean;
	/** Element-level opacity (0-1). */
	opacity?: number;
	rawXml?: XmlObject;
	/** Shape-level click action (from `a:hlinkClick` on `p:cNvPr`). */
	actionClick?: PptxAction;
	/** Shape-level hover action (from `a:hlinkHover` on `p:cNvPr`). */
	actionHover?: PptxAction;
	/** Shape lock attributes parsed from `p:cNvSpPr/a:spLocks`. */
	locks?: PptxShapeLocks;
	/**
	 * Opaque `<a:ext>` children captured from the shape's `<a:extLst>` whose
	 * URI is not recognised by a typed extractor (hidden fill/line, image
	 * effects, …). Preserved verbatim and re-emitted on save so unknown
	 * vendor extensions survive a round-trip.
	 *
	 * Mirrors the existing `effectDagXml` / `endParaRunProperties` raw-XML
	 * preservation pattern.
	 */
	extLstXml?: XmlObject[];
}

/**
 * Text content mixin — present on text boxes and shapes.
 *
 * Shapes can contain text overlaid on the shape geometry, so both
 * `TextPptxElement` and `ShapePptxElement` extend this interface.
 *
 * @example
 * ```ts
 * const props: PptxTextProperties = {
 *   text: "Hello World",
 *   textStyle: { fontSize: 24, bold: true, color: "#333333" },
 * };
 * // => satisfies PptxTextProperties
 * ```
 */
export interface PptxTextProperties {
	text?: string;
	textStyle?: TextStyle;
	/** Rich text segments with individual styling. */
	textSegments?: TextSegment[];
	/** Per-paragraph indentation (marginLeft, indent) for multi-level bullet support. */
	paragraphIndents?: Array<{ marginLeft?: number; indent?: number }>;
	/** Placeholder prompt text inherited from layout/master (e.g. "Click to add title"). Shown as a greyed-out hint when the shape has no user-entered text. */
	promptText?: string;
	/**
	 * The string {@link text} was INHERITED from, when this is a header / footer /
	 * date / slide-number placeholder whose own body the file leaves empty.
	 *
	 * PowerPoint keeps the footer string on the slide master and writes each
	 * slide's copy of the `ftr` placeholder empty, so the empty body means
	 * "render the master's footer here". Rendering needs the resolved string, but
	 * SAVING it into the slide would pin that slide to today's master text and
	 * silently detach it from the Header & Footer dialog. The save writer
	 * therefore leaves the authored empty body alone while `text` still equals
	 * this value, and writes a genuine per-slide override once it does not.
	 */
	inheritedPlaceholderText?: string;
	/** Linked text box chain ID from `a:bodyPr > a:linkedTxbx/@id` or `a:txbx > a:linkedTxbx/@id`. Text overflows from one linked frame to the next. */
	linkedTxbxId?: number;
	/** Sequence number within a linked text box chain (0-based). */
	linkedTxbxSeq?: number;
}

/**
 * Shape styling & geometry mixin — present on shapes, connectors, and images.
 *
 * @example
 * ```ts
 * const props: PptxShapeProperties = {
 *   shapeType: "roundRect",
 *   shapeStyle: { fillColor: "#0055AA", strokeWidth: 2 },
 *   shapeAdjustments: { adj: 16667 },
 * };
 * // => satisfies PptxShapeProperties
 * ```
 */
export interface PptxShapeProperties {
	shapeStyle?: ShapeStyle;
	/** Preset geometry name, e.g. "rect", "ellipse", "roundRect". */
	shapeType?: string;
	/** Geometry adjustment values, e.g. `{ adj: 16667 }`. */
	shapeAdjustments?: Record<string, number>;
	/** Adjustment handles for interactive shape modification (yellow diamond handles). */
	adjustmentHandles?: GeometryAdjustmentHandle[];
}

// ==========================================================================
// Placeholder inheritance types
// ==========================================================================

/**
 * Text styling for a single indent level (0–8) inside a placeholder’s
 * `a:lstStyle`.
 *
 * Used during placeholder inheritance to fill in defaults for font,
 * bullet, and spacing properties the slide element does not override.
 *
 * @example
 * ```ts
 * const level0: PlaceholderTextLevelStyle = {
 *   fontSize: 32,
 *   bold: true,
 *   bulletChar: "•",
 * };
 * // => satisfies PlaceholderTextLevelStyle
 * ```
 */
export interface PlaceholderTextLevelStyle {
	fontFamily?: string;
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	color?: string;
	/**
	 * The `a:defRPr/a:solidFill` node this level's {@link color} came from.
	 *
	 * Master and layout text styles are parsed and cached before any slide is,
	 * so a scheme alias such as `tx1` was resolved through the map that was
	 * active then. A slide carrying `p:clrMapOvr` routes the same alias
	 * somewhere else, so the alias has to be resolved again against the slide
	 * that is inheriting it; {@link color} is only the reading taken at parse
	 * time. Absent when the level declares no colour, or declares a literal one.
	 */
	colorChoiceXml?: XmlObject;
	bulletChar?: string;
	bulletAutoNumType?: string;
	bulletFontFamily?: string;
	bulletSizePercent?: number;
	/** Bullet colour from `a:buClr` as hex string. */
	bulletColor?: string;
	/**
	 * The colour-choice node inside `a:buClr` this level's {@link bulletColor}
	 * resolved from (`a:schemeClr` / `a:sysClr` / `a:prstClr` / `a:srgbClr`,
	 * transforms included), mirroring `BulletInfo.colorXml`. Re-emitted
	 * verbatim on save so a themed bullet is not downgraded to a literal
	 * `a:srgbClr`. Absent when the level declares no bullet colour.
	 */
	bulletColorXml?: XmlObject;
	/** Bullet size in points from `a:buSzPts`. */
	bulletSizePts?: number;
	/** True when `a:buNone` is present at this level. */
	bulletNone?: boolean;
	marginLeft?: number; // indent in px (from `@_marL` EMU)
	/** Paragraph right margin in px (from `@_marR` EMU). */
	marginRight?: number;
	indent?: number; // first-line indent in px (from `@_indent` EMU)
	/**
	 * Paragraph alignment as a `TextStyle['align']` token (`left`, `center`,
	 * `right`, `justify`, `justLow`, `dist`, `thaiDist`), never the raw OOXML
	 * `@algn` value.
	 */
	alignment?: string;
	/** Right-to-left paragraph direction (`@rtl`). */
	rtl?: boolean;
	/** Tab stops from `a:tabLst/a:tab` (positions in px). */
	tabStops?: TextStyle['tabStops'];
	lineSpacing?: number;
	lineSpacingExactPt?: number;
	spaceBefore?: number;
	spaceAfter?: number;
	/** Default tab interval in CSS pixels (`a:lvlXpPr/@defTabSz`). */
	defaultTabSize?: number;
	/** Whether East Asian line-breaking rules are enabled. */
	eaLineBreak?: boolean;
	/** Whether Latin line-breaking rules are enabled. */
	latinLineBreak?: boolean;
	/** Font vertical alignment within the text line. */
	fontAlignment?: string;
	/** Whether end punctuation may hang outside the text frame. */
	hangingPunctuation?: boolean;
}

/**
 * Pre-parsed placeholder defaults extracted from a layout or master shape
 * that carries a `<p:ph>` element.
 *
 * Used to fill in inherited text styles, bullet definitions, font sizes,
 * and body properties that the slide shape does not explicitly override.
 *
 * @example
 * ```ts
 * const defaults: PlaceholderDefaults = {
 *   type: "title",
 *   levelStyles: {
 *     0: { fontSize: 36, bold: true, alignment: "left" },
 *   },
 * };
 * // => satisfies PlaceholderDefaults
 * ```
 */
export interface PlaceholderDefaults {
	/** Placeholder type: 'title', 'body', 'ctrTitle', 'subTitle', 'dt', 'ftr', 'sldNum', etc. */
	type: string;
	/** Placeholder index (when present). */
	idx?: number;
	bodyInsetLeft?: number;
	bodyInsetTop?: number;
	bodyInsetRight?: number;
	bodyInsetBottom?: number;
	textAnchor?: string;
	autoFit?: boolean;
	/** Explicit autofit mode from OOXML body properties. See {@link TextStyle.autoFitMode}. */
	autoFitMode?: 'shrink' | 'normal' | 'none';
	/** Font scale percentage for normAutofit (e.g. 0.9 = 90%). Only meaningful when autoFit is true. */
	autoFitFontScale?: number;
	/** Line spacing reduction for normAutofit (e.g. 0.2 = reduce by 20%). Only meaningful when autoFit is true. */
	autoFitLineSpacingReduction?: number;
	textWrap?: string;
	/** Level-specific text styles keyed 0-8. */
	levelStyles?: Record<number, PlaceholderTextLevelStyle>;
	/** Prompt text extracted from the layout/master placeholder (e.g. "Click to add title"). */
	promptText?: string;
}
