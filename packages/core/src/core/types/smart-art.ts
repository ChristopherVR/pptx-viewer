/**
 * SmartArt types: layout categories, layout presets, colour schemes,
 * data-model nodes/connections, drawing shapes, chrome, and the composite
 * `PptxSmartArtData`.
 *
 * @module pptx-types/smart-art
 */

import type { PptxCustomPathProperties } from './geometry';
import type { PptxSmartArtLayoutDefinition } from './smart-art-layout-definition';
import type { PptxSmartArtNode } from './smart-art-node';
import type {
	PptxSmartArtColorTransform,
	PptxSmartArtQuickStyle,
} from './smart-art-style-definition';
import type { TextSegment } from './text';

// Node-related types (PptxSmartArtTextRun, PptxSmartArtNodeStyle,
// PptxSmartArtNode) live in `smart-art-node.ts` to keep this file within the
// per-file line budget. They are re-exported here so existing imports from
// `smart-art` (and the `types` barrel) keep working unchanged.
export type {
	PptxSmartArtTextRun,
	PptxSmartArtTextParagraphItem,
	PptxSmartArtTextParagraph,
	PptxSmartArtNodeStyle,
	PptxSmartArtNode,
} from './smart-art-node';
export type {
	PptxSmartArtAlgorithmParameter,
	PptxSmartArtChoose,
	PptxSmartArtForEach,
	PptxSmartArtIteratorAttributes,
	PptxSmartArtLayoutCategory,
	PptxSmartArtLayoutAlgorithm,
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtLocalizedText,
	PptxSmartArtWhen,
} from './smart-art-layout-definition';
export type * from './smart-art-style-definition';
export type * from './smart-art-definition-header';
export type * from './smart-art-constraint-rules';

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
	| 'list'
	| 'process'
	| 'cycle'
	| 'hierarchy'
	| 'relationship'
	| 'matrix'
	| 'pyramid'
	| 'funnel'
	| 'gear'
	| 'target'
	| 'timeline'
	| 'venn'
	| 'chevron'
	| 'bending'
	| 'unknown';

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
	| 'basicBlockList'
	| 'alternatingHexagons'
	| 'basicChevronProcess'
	| 'basicCycle'
	| 'basicPie'
	| 'basicRadial'
	| 'basicVenn'
	| 'continuousBlockProcess'
	| 'convergingRadial'
	| 'hierarchy'
	| 'horizontalBulletList'
	| 'linearVenn'
	| 'segmentedProcess'
	| 'stackedList'
	| 'tableList'
	| 'trapezoidList'
	| 'upwardArrow'
	| 'basicFunnel'
	| 'basicTarget'
	| 'interlockingGears'
	| 'basicTimeline'
	| 'basicMatrix'
	| 'basicPyramid'
	| 'invertedPyramid'
	| 'bendingProcess'
	| 'stepDownProcess'
	| 'alternatingFlow'
	| 'descendingProcess'
	| 'pictureAccentList'
	| 'verticalBlockList'
	| 'groupedList'
	| 'pyramidList'
	| 'horizontalPictureList'
	| 'accentProcess'
	| 'verticalChevronList';

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
	| 'colorful1'
	| 'colorful2'
	| 'colorful3'
	| 'monochromatic1'
	| 'monochromatic2';

/**
 * SmartArt visual style intensity.
 *
 * @example
 * ```ts
 * const style: SmartArtStyle = "moderate";
 * // => "moderate" — one of: "flat" | "moderate" | "intense"
 * ```
 */
export type SmartArtStyle = 'flat' | 'moderate' | 'intense';

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
	/** Stable CT_Cxn model identifier. Required when serialized. */
	modelId?: string | null;
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
	/** Model ID of the parent transition point associated with this edge. */
	parentTransitionId?: string | null;
	/** Model ID of the sibling transition point associated with this edge. */
	siblingTransitionId?: string | null;
	/** Layout presentation identifier used by presentation connections. */
	presentationId?: string | null;
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
export interface PptxSmartArtDrawingShape extends PptxCustomPathProperties {
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
	/**
	 * Gradient fill stops when the cached shape uses `a:gradFill`. Positions are
	 * 0..100 (percent). Renderers emit an SVG/CSS gradient instead of a flat box.
	 */
	fillGradientStops?: Array<{ color: string; position: number; opacity?: number }>;
	/** Gradient geometry type (`linear` for `a:lin`, `radial` for `a:path`). */
	fillGradientType?: 'linear' | 'radial';
	/** Linear gradient angle in degrees (0..360). */
	fillGradientAngle?: number;
	/** Pattern fill preset name from `a:pattFill/@prst` (e.g. "pct50", "cross"). */
	fillPatternPreset?: string;
	/** Pattern fill foreground colour (hex) from `a:pattFill/a:fgClr`. */
	fillPatternForegroundColor?: string;
	/** Pattern fill background colour (hex) from `a:pattFill/a:bgClr`. */
	fillPatternBackgroundColor?: string;
	/**
	 * Relationship id of a picture (blip) fill's embedded image, from
	 * `a:blipFill/a:blip/@r:embed`. The image bytes are resolved separately; see
	 * {@link fillImageUrl}.
	 */
	fillBlipEmbedId?: string;
	/**
	 * Resolved data-URI/URL for a picture (blip) fill, when the embedded image
	 * part could be resolved. Absent when only {@link fillBlipEmbedId} is known.
	 */
	fillImageUrl?: string;
	/** Whether the cached shape carries an outer-shadow effect (`a:effectLst`). */
	hasShadow?: boolean;
	/** Resolved outer-shadow colour (hex), when present. */
	shadowColor?: string;
	/** Stroke colour (hex). */
	strokeColor?: string;
	/** Stroke width in points. */
	strokeWidth?: number;
	/** Text content of the shape. */
	text?: string;
	/** Standard rich-text segments projected from the associated SmartArt node. */
	textSegments?: TextSegment[];
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
 * Presentation layout variables from `dgm:prSet/dgm:presLayoutVars` (data model)
 * or `dgm:varLst` (layout definition defaults).
 *
 * These drive how the DiagramML layout interpreter arranges points: flow
 * direction, hierarchy branch style, org-chart mode, and child count limits.
 * The fallback layout engine can consult them for direction/org-chart hints.
 *
 * @example
 * ```ts
 * const vars: PptxSmartArtPresLayoutVars = { direction: "rev", orgChart: true };
 * // => satisfies PptxSmartArtPresLayoutVars
 * ```
 */
export interface PptxSmartArtPresLayoutVars {
	/** Flow direction (`dgm:dir`): "norm" (default) or "rev" (reversed/RTL). */
	direction?: 'norm' | 'rev';
	/** Hierarchy branch style (`dgm:hierBranch`): std/init/l/r/hang. */
	hierarchyBranch?: 'std' | 'init' | 'l' | 'r' | 'hang';
	/** Org-chart mode enabled (`dgm:orgChart`). */
	orgChart?: boolean;
	/** Maximum children per node (`dgm:chMax`, -1 = unbounded). */
	childMax?: number;
	/** Preferred children per node (`dgm:chPref`, -1 = unbounded). */
	childPreferred?: number;
	/** Whether bullets are enabled (`dgm:bulletEnabled`). */
	bulletEnabled?: boolean;
	/** Animation-by-level setting (`dgm:animLvl`). */
	animationLevel?: string;
	/** Animate-one setting (`dgm:animOne`). */
	animateOne?: string;
	/** Allowed resize handles (`dgm:resizeHandles`). */
	resizeHandles?: string;
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
	/** Editable metadata from the related DiagramML layout definition. */
	layoutDefinition?: PptxSmartArtLayoutDefinition;
	/**
	 * Presentation layout variables (direction, hierarchy branch, org-chart,
	 * child limits, bullets) from `dgm:presLayoutVars` / layout `dgm:varLst`.
	 * Consulted by the fallback layout engine for direction/org-chart hints.
	 */
	presLayoutVars?: PptxSmartArtPresLayoutVars;
	/** Relationship ID for the diagram data part (for round-trip save). */
	dataRelId?: string;
	/** Relationship ID for the diagram layout part. */
	layoutRelId?: string;
	/** Relationship ID for the drawing part. */
	drawingRelId?: string;
	/** Relationship ID for the colours part. */
	colorsRelId?: string;
	/** Relationship ID for the quick-styles part. */
	styleRelId?: string;
	/** Internal save hint: the layout definition changed in the editor. */
	layoutDirty?: boolean;
	/** Internal save hint: typed layout-definition metadata changed. */
	layoutDefinitionDirty?: boolean;
	/** Internal save hint: quick-style definition metadata changed. */
	quickStyleDirty?: boolean;
	/** Internal save hint: color-transform definition metadata changed. */
	colorTransformDirty?: boolean;
	/** Internal save hint: cached drawing geometry or text changed in the editor. */
	drawingDirty?: boolean;
}
