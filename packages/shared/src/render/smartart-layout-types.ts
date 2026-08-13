/**
 * SmartArt layout engine — shared public geometry types.
 *
 * Pure data structures describing the SVG fallback geometry produced when a
 * SmartArt element has no pre-computed `drawingShapes`. No framework code, no
 * DOM — consumed identically by the React, Vue, and Angular bindings.
 */

/** Axis-aligned rectangle. */
export interface LayoutRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Per-node label styling resolved from `PptxSmartArtNode.style` (the overrides
 * the inspector's node style bar writes).
 *
 * Every field is optional and every field has a documented binding default, so
 * a renderer that ignores them keeps its historic output:
 * `fontColor` -> `white`, `fontWeight` / `fontStyle` -> unset.
 */
export interface RenderedNodeTextStyle {
	/** Label colour. Default `white`. */
	fontColor?: string;
	/** SVG `font-weight` (`700` when the node is bold). Default unset. */
	fontWeight?: number;
	/** SVG `font-style`. Default unset. */
	fontStyle?: 'italic';
}

/** A node rendered as an SVG rect (rounded or flat). */
export interface RenderedRectNode extends RenderedNodeTextStyle {
	kind: 'rect';
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rx: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	text: string;
	fontSize: number;
	/** Centre x for text anchor. */
	textX: number;
	/** Centre y for text anchor. */
	textY: number;
}

/** A node rendered as an SVG circle. */
export interface RenderedCircleNode extends RenderedNodeTextStyle {
	kind: 'circle';
	key: string;
	cx: number;
	cy: number;
	r: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	text: string;
	fontSize: number;
	/**
	 * Label anchor x. Defaults to `cx`; set when the label sits away from the
	 * circle (target leader labels, timeline captions).
	 */
	textX?: number;
	/** Label anchor y. Defaults to `cy`. */
	textY?: number;
	/** SVG `text-anchor` for the label. Defaults to `middle`. */
	textAnchor?: 'start' | 'middle' | 'end';
	/**
	 * How the label block sits relative to `textY`: `middle` centres it (the
	 * default), `bottom` puts the last baseline on `textY` (label above the
	 * node), `top` puts the first line's top on `textY` (label below).
	 */
	textBaseline?: 'top' | 'middle' | 'bottom';
}

/** A node rendered as an SVG polygon (chevron, trapezoid, etc.). */
export interface RenderedPolygonNode extends RenderedNodeTextStyle {
	kind: 'polygon';
	key: string;
	points: string;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	text: string;
	fontSize: number;
	/** Centre x for text anchor. */
	textX: number;
	/** Centre y for text anchor. */
	textY: number;
}

export type RenderedNode = RenderedRectNode | RenderedCircleNode | RenderedPolygonNode;

/**
 * A connector line between two rendered nodes.
 *
 * The paint fields are optional and carry the values every binding already
 * hardcodes, so a renderer that ignores them is unchanged:
 * `stroke` -> `#94a3b8`, `strokeWidth` -> `1.5`, `opacity` -> `0.5`,
 * `dash` -> solid.
 */
export interface RenderedConnector {
	key: string;
	/** SVG path data string. */
	d: string;
	/** Stroke colour. Default `#94a3b8`. */
	stroke?: string;
	/** Stroke width. Default `1.5`. */
	strokeWidth?: number;
	/** Stroke opacity. Default `0.5`. */
	opacity?: number;
	/** SVG `stroke-dasharray`. Default solid. */
	dash?: string;
}

/** The layout family applied to a SmartArt element. */
export type LayoutFamily =
	| 'list'
	| 'process'
	| 'cycle'
	| 'hierarchy'
	| 'matrix'
	| 'radial'
	| 'pyramid'
	| 'venn'
	| 'funnel'
	| 'target'
	| 'gear'
	| 'timeline'
	| 'bending';

/** Complete layout output for a single SmartArt family. */
export interface SmartArtLayoutResult {
	/** Rendered geometry nodes. */
	nodes: RenderedNode[];
	/** Connector lines (may be empty). */
	connectors: RenderedConnector[];
	/** SVG filter string for drop shadows, e.g. `"drop-shadow(…)"`. */
	shadowFilter: string | undefined;
	/**
	 * Suggested viewBox string `"0 0 W H"`.
	 * Callers should use the element's actual pixel dimensions.
	 */
	viewBox: string;
	/** The layout family that was applied. */
	family: LayoutFamily;
}

/** Bounding box passed to every layout function. */
export interface BoundingBox {
	width: number;
	height: number;
}

/** Internal tree representation (mirrors React's smartart-helpers). */
export interface TreeNode {
	node: import('pptx-viewer-core').PptxSmartArtNode;
	children: TreeNode[];
}
