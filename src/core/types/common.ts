/**
 * Shared value types used across the entire PPTX editor type system.
 *
 * Contains primitive enums, small interfaces, and the XML object alias
 * that almost every other type file imports.
 *
 * @module pptx-types/common
 */

// ==========================================================================
// Common shared value types used across the PPTX editor type system
// ==========================================================================

/**
 * Underline style tokens from OOXML `a:rPr/@u`.
 *
 * These map directly to the OpenXML `ST_TextUnderlineType` simple type.
 *
 * @example
 * ```ts
 * const style: UnderlineStyle = "wavy";
 * // => "wavy" — one of: sng | dbl | heavy | dotted | dash | wavy | none | ...
 * ```
 */
export type UnderlineStyle =
  | "sng"
  | "dbl"
  | "heavy"
  | "dotted"
  | "dottedHeavy"
  | "dash"
  | "dashHeavy"
  | "dashLong"
  | "dashLongHeavy"
  | "dotDash"
  | "dotDashHeavy"
  | "dotDotDash"
  | "dotDotDashHeavy"
  | "wavy"
  | "wavyHeavy"
  | "wavyDbl"
  | "none";

/**
 * Connector connection point reference — links a connector endpoint to a
 * specific shape on the slide.
 *
 * When both `shapeId` and `connectionSiteIndex` are set, the connector
 * end snaps to that shapes’s connection site and “follows” the shape when
 * it is moved.
 *
 * @example
 * ```ts
 * const start: ConnectorConnectionPoint = {
 *   shapeId: "shape_1",
 *   connectionSiteIndex: 2,
 * };
 * // => { shapeId: "shape_1", connectionSiteIndex: 2 } satisfies ConnectorConnectionPoint
 * ```
 */
export interface ConnectorConnectionPoint {
  /** ID of the shape this connector endpoint is attached to. */
  shapeId?: string;
  /** Connection site index on the target shape (0-based). */
  connectionSiteIndex?: number;
}

/**
 * Arrow head types for connector start/end.
 *
 * Maps to `a:headEnd/@type` and `a:tailEnd/@type` in OOXML.
 *
 * @example
 * ```ts
 * const arrow: ConnectorArrowType = "triangle";
 * // => "triangle" — one of: none | triangle | stealth | diamond | oval | arrow
 * ```
 */
export type ConnectorArrowType =
  | "none"
  | "triangle"
  | "stealth"
  | "diamond"
  | "oval"
  | "arrow";

/**
 * Stroke dash pattern types for lines and shape outlines.
 *
 * Maps to `a:ln/a:prstDash/@val` in OOXML. Use `"custom"` for
 * user-defined dash/space arrays.
 *
 * @example
 * ```ts
 * const dash: StrokeDashType = "dashDot";
 * // => "dashDot" — one of: solid | dot | dash | lgDash | dashDot | custom | ...
 * ```
 */
export type StrokeDashType =
  | "solid"
  | "dot"
  | "dash"
  | "lgDash"
  | "dashDot"
  | "lgDashDot"
  | "lgDashDotDot"
  | "sysDot"
  | "sysDash"
  | "sysDashDot"
  | "sysDashDotDot"
  | "custom";

/**
 * Shadow effect properties for a single shadow layer.
 *
 * Represents parsed values from an `<a:outerShdw>` node. Multiple instances
 * can be stored in {@link ShapeStyle.shadows} for compound shadow effects.
 *
 * @example
 * ```ts
 * const shadow: ShadowEffect = {
 *   color: "#000000",
 *   opacity: 0.4,
 *   blur: 6,
 *   angle: 315,
 *   distance: 4,
 * };
 * // => { color: "#000000", opacity: 0.4, blur: 6, angle: 315, distance: 4 } satisfies ShadowEffect
 * ```
 */
export interface ShadowEffect {
  /** Shadow color as hex string. */
  color: string;
  /** Shadow opacity (0-1). */
  opacity: number;
  /** Blur radius in pixels. */
  blur: number;
  /** Shadow angle in degrees (0-360). */
  angle: number;
  /** Shadow distance in pixels. */
  distance: number;
  /** Whether shadow rotates with shape. */
  rotateWithShape?: boolean;
}

// Type for parsed XML objects from fast-xml-parser
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type XmlObject = Record<string, any>;

/**
 * Discriminant values for the `type` field on {@link PptxElement}.
 *
 * Narrow on this type to access variant-specific properties.
 *
 * @example
 * ```ts
 * function isImage(el: PptxElement): el is ImagePptxElement {
 *   return el.type === "image";
 * }
 * // => type guard narrowing PptxElement to ImagePptxElement
 * ```
 */
export type PptxElementType =
  | "text"
  | "shape"
  | "connector"
  | "image"
  | "picture"
  | "chart"
  | "table"
  | "smartArt"
  | "ole"
  | "media"
  | "group"
  | "ink"
  | "zoom"
  | "unknown";

/**
 * Shape lock attributes from `p:cNvSpPr / a:spLocks`.
 *
 * When a flag is `true` the corresponding user interaction is disabled
 * in the editor (e.g. `noRotation` prevents free rotation of the shape).
 *
 * @example
 * ```ts
 * const locks: PptxShapeLocks = { noMove: true, noResize: true };
 * // => { noMove: true, noResize: true } satisfies PptxShapeLocks
 * ```
 */
export interface PptxShapeLocks {
  noGrouping?: boolean;
  noRotation?: boolean;
  noMove?: boolean;
  noResize?: boolean;
  noTextEdit?: boolean;
  noSelect?: boolean;
  noChangeAspect?: boolean;
  noEditPoints?: boolean;
  noAdjustHandles?: boolean;
  noChangeArrowheads?: boolean;
  noChangeShapeType?: boolean;
}

/**
 * A drawing guide parsed from OOXML extension lists.
 *
 * Slide-level and presentation-level guides are shown as thin coloured
 * lines that help users align elements.
 *
 * @example
 * ```ts
 * const guide: PptxDrawingGuide = {
 *   id: "g1",
 *   orientation: "horz",
 *   positionEmu: 457200,
 *   color: "#FF0000",
 * };
 * // => { id: "g1", orientation: "horz", positionEmu: 457200, color: "#FF0000" } satisfies PptxDrawingGuide
 * ```
 */
export interface PptxDrawingGuide {
  /** Unique identifier (from `@_id` attribute or generated). */
  id: string;
  /** Orientation: horizontal or vertical. */
  orientation: "horz" | "vert";
  /** Position in EMU (converted from pos attribute). */
  positionEmu: number;
  /** Optional guide colour as hex string (e.g. "#FF0000"). */
  color?: string;
}
