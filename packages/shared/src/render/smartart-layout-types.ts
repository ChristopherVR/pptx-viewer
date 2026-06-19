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

/** A node rendered as an SVG rect (rounded or flat). */
export interface RenderedRectNode {
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
export interface RenderedCircleNode {
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
}

/** A node rendered as an SVG polygon (chevron, trapezoid, etc.). */
export interface RenderedPolygonNode {
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

/** A connector line between two rendered nodes. */
export interface RenderedConnector {
	key: string;
	/** SVG path data string. */
	d: string;
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
	| 'target';

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
