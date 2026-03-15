/**
 * SmartArt types: layout categories, layout presets, colour schemes,
 * data-model nodes/connections, drawing shapes, chrome, and the composite
 * `PptxSmartArtData`.
 *
 * @module pptx-types/smart-art
 */

// ==========================================================================
// SmartArt types
// ==========================================================================

/**
 * Resolved SmartArt layout category.
 *
 * @example
 * ```ts
 * const cat: SmartArtLayoutType = "hierarchy";
 * // => "hierarchy" — one of: "list" | "process" | "cycle" | "hierarchy" | "relationship" | …
 * ```
 */
export type SmartArtLayoutType =
  | "list"
  | "process"
  | "cycle"
  | "hierarchy"
  | "relationship"
  | "matrix"
  | "pyramid"
  | "funnel"
  | "gear"
  | "target"
  | "timeline"
  | "venn"
  | "chevron"
  | "bending"
  | "unknown";

/**
 * Named SmartArt layout presets for creation (subset of PowerPoint layouts).
 *
 * @example
 * ```ts
 * const layout: SmartArtLayout = "hierarchy";
 * // => "hierarchy" — one of: "basicBlockList" | "alternatingHexagons" | "hierarchy" | …
 * ```
 */
export type SmartArtLayout =
  | "basicBlockList"
  | "alternatingHexagons"
  | "basicChevronProcess"
  | "basicCycle"
  | "basicPie"
  | "basicRadial"
  | "basicVenn"
  | "continuousBlockProcess"
  | "convergingRadial"
  | "hierarchy"
  | "horizontalBulletList"
  | "linearVenn"
  | "segmentedProcess"
  | "stackedList"
  | "tableList"
  | "trapezoidList"
  | "upwardArrow"
  | "basicFunnel"
  | "basicTarget"
  | "interlockingGears"
  | "basicTimeline"
  | "basicMatrix"
  | "basicPyramid"
  | "invertedPyramid"
  | "bendingProcess"
  | "stepDownProcess"
  | "alternatingFlow"
  | "descendingProcess"
  | "pictureAccentList"
  | "verticalBlockList"
  | "groupedList"
  | "pyramidList"
  | "horizontalPictureList"
  | "accentProcess"
  | "verticalChevronList";

/**
 * SmartArt colour scheme presets.
 *
 * @example
 * ```ts
 * const scheme: SmartArtColorScheme = "colorful1";
 * // => "colorful1" — one of: "colorful1" | "colorful2" | "colorful3" | "monochromatic1" | "monochromatic2"
 * ```
 */
export type SmartArtColorScheme =
  | "colorful1"
  | "colorful2"
  | "colorful3"
  | "monochromatic1"
  | "monochromatic2";

/**
 * SmartArt visual style intensity.
 *
 * @example
 * ```ts
 * const style: SmartArtStyle = "moderate";
 * // => "moderate" — one of: "flat" | "moderate" | "intense"
 * ```
 */
export type SmartArtStyle = "flat" | "moderate" | "intense";

/**
 * A single node in the SmartArt data model.
 *
 * @example
 * ```ts
 * const node: PptxSmartArtNode = {
 *   id: "1",
 *   text: "CEO",
 *   children: [
 *     { id: "2", text: "VP Marketing", parentId: "1" },
 *     { id: "3", text: "VP Engineering", parentId: "1" },
 *   ],
 * };
 * // => satisfies PptxSmartArtNode
 * ```
 */
export interface PptxSmartArtNode {
  id: string;
  text: string;
  parentId?: string;
  children?: PptxSmartArtNode[];
  /** Node type from `@_type` attribute (e.g. "doc", "node", "asst", "pres"). */
  nodeType?: string;
}

/**
 * A connection between two SmartArt data-model nodes.
 *
 * @example
 * ```ts
 * const conn: PptxSmartArtConnection = {
 *   sourceId: "1",
 *   destId: "2",
 *   type: "parOf",
 * };
 * // => satisfies PptxSmartArtConnection
 * ```
 */
export interface PptxSmartArtConnection {
  /** Model ID of the source node. */
  sourceId: string;
  /** Model ID of the destination node. */
  destId: string;
  /** Connection type (e.g. "parOf", "presOf", "sibTrans"). */
  type?: string;
  /** Source index for ordering sibling connections. */
  srcOrd?: number;
  /** Destination index for ordering. */
  destOrd?: number;
}

/**
 * A pre-computed shape from `ppt/diagrams/drawing*.xml`.
 *
 * @example
 * ```ts
 * const shape: PptxSmartArtDrawingShape = {
 *   id: "s1",
 *   shapeType: "roundRect",
 *   x: 100, y: 50, width: 200, height: 80,
 *   fillColor: "#4F81BD",
 *   text: "CEO",
 * };
 * // => satisfies PptxSmartArtDrawingShape
 * ```
 */
export interface PptxSmartArtDrawingShape {
  /** Shape ID within the drawing. */
  id: string;
  /** Preset geometry type (e.g. "roundRect", "ellipse"). */
  shapeType?: string;
  /** Position and size in EMU-based pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in degrees. */
  rotation?: number;
  /** Skew along the X axis in degrees. */
  skewX?: number;
  /** Skew along the Y axis in degrees. */
  skewY?: number;
  /** Solid fill colour (hex). */
  fillColor?: string;
  /** Stroke colour (hex). */
  strokeColor?: string;
  /** Stroke width in points. */
  strokeWidth?: number;
  /** Text content of the shape. */
  text?: string;
  /** Font size in points. */
  fontSize?: number;
  /** Font colour (hex). */
  fontColor?: string;
}

/**
 * Background / outline extracted from `dgm:bg` and `dgm:whole`.
 *
 * @example
 * ```ts
 * const chrome: PptxSmartArtChrome = {
 *   backgroundColor: "#F0F0F0",
 *   outlineColor: "#333333",
 *   outlineWidth: 1,
 * };
 * // => satisfies PptxSmartArtChrome
 * ```
 */
export interface PptxSmartArtChrome {
  /** Background fill colour (hex). */
  backgroundColor?: string;
  /** Outline stroke colour (hex). */
  outlineColor?: string;
  /** Outline stroke width in points. */
  outlineWidth?: number;
}

/**
 * Colour transform entry from `ppt/diagrams/colors*.xml`.
 *
 * @example
 * ```ts
 * const transform: PptxSmartArtColorTransform = {
 *   name: "Colorful - Accent Colors",
 *   fillColors: ["#4F81BD", "#C0504D", "#9BBB59"],
 *   lineColors: ["#385D8A", "#8C3836", "#71893F"],
 * };
 * // => satisfies PptxSmartArtColorTransform
 * ```
 */
export interface PptxSmartArtColorTransform {
  /** Colour scheme name / title. */
  name?: string;
  /** Ordered list of fill colours (hex) for each node. */
  fillColors: string[];
  /** Ordered list of line colours (hex). */
  lineColors: string[];
}

/**
 * Style entry from `ppt/diagrams/quickStyles*.xml`.
 *
 * @example
 * ```ts
 * const qs: PptxSmartArtQuickStyle = {
 *   name: "Moderate Effect",
 *   effectIntensity: "moderate",
 * };
 * // => satisfies PptxSmartArtQuickStyle
 * ```
 */
export interface PptxSmartArtQuickStyle {
  /** Style name / title. */
  name?: string;
  /** Effect intensity identifier (e.g. "subtle", "moderate", "intense"). */
  effectIntensity?: string;
}

/**
 * Complete parsed SmartArt data for a {@link SmartArtPptxElement}.
 *
 * @example
 * ```ts
 * const data: PptxSmartArtData = {
 *   resolvedLayoutType: "hierarchy",
 *   layout: "hierarchy",
 *   colorScheme: "colorful1",
 *   style: "moderate",
 *   nodes: [
 *     { id: "1", text: "CEO", children: [
 *       { id: "2", text: "VP Marketing", parentId: "1" },
 *     ]},
 *   ],
 * };
 * // => satisfies PptxSmartArtData
 * ```
 */
export interface PptxSmartArtData {
  layoutType?: string;
  resolvedLayoutType?: SmartArtLayoutType;
  /** Named layout preset (used when creating new SmartArt). */
  layout?: SmartArtLayout;
  /** Colour scheme for the SmartArt graphic. */
  colorScheme?: SmartArtColorScheme;
  /** Visual style intensity. */
  style?: SmartArtStyle;
  nodes: PptxSmartArtNode[];
  /** Connections between data-model nodes. */
  connections?: PptxSmartArtConnection[];
  /** Pre-computed shapes from `ppt/diagrams/drawing*.xml`. */
  drawingShapes?: PptxSmartArtDrawingShape[];
  /** Background and outline chrome from `dgm:bg` / `dgm:whole`. */
  chrome?: PptxSmartArtChrome;
  /** Colour transform from `ppt/diagrams/colors*.xml`. */
  colorTransform?: PptxSmartArtColorTransform;
  /** Quick style from `ppt/diagrams/quickStyles*.xml`. */
  quickStyle?: PptxSmartArtQuickStyle;
  /** Relationship ID for the diagram data part (for round-trip save). */
  dataRelId?: string;
  /** Relationship ID for the drawing part. */
  drawingRelId?: string;
  /** Relationship ID for the colours part. */
  colorsRelId?: string;
  /** Relationship ID for the quick-styles part. */
  styleRelId?: string;
}
