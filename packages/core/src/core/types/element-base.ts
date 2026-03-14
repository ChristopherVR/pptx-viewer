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

import type { XmlObject, PptxShapeLocks } from "./common";
import type { PptxAction } from "./actions";
import type { TextStyle, TextSegment } from "./text";
import type { ShapeStyle } from "./shape-style";
import type { GeometryAdjustmentHandle } from "./geometry";

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
  x: number;
  y: number;
  width: number;
  height: number;
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
  bulletChar?: string;
  bulletAutoNumType?: string;
  bulletFontFamily?: string;
  bulletSizePercent?: number;
  /** Bullet colour from `a:buClr` as hex string. */
  bulletColor?: string;
  /** Bullet size in points from `a:buSzPts`. */
  bulletSizePts?: number;
  /** True when `a:buNone` is present at this level. */
  bulletNone?: boolean;
  marginLeft?: number; // indent in px (from `@_marL` EMU)
  indent?: number; // first-line indent in px (from `@_indent` EMU)
  alignment?: string;
  lineSpacing?: number;
  lineSpacingExactPt?: number;
  spaceBefore?: number;
  spaceAfter?: number;
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
  autoFitMode?: "shrink" | "normal" | "none";
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
