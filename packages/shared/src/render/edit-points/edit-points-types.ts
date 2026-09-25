/**
 * The editable path model behind PowerPoint's Edit Points mode.
 *
 * `a:custGeom` stores a shape outline as a list of pen commands (`moveTo`,
 * `lnTo`, `cubicBezTo`, `quadBezTo`, `arcTo`, `close`). That list is awkward to
 * edit directly: a vertex has no identity of its own (it is the end point of one
 * command and the implicit start of the next), and a Bezier's control points
 * belong to the segment, not to the vertex a user drags. This model is the
 * vertex-centric view PowerPoint shows instead:
 *
 *  - a {@link EditSubpath} is one `moveTo`-started run of the pen;
 *  - its `nodes` are the vertices, each with a PowerPoint point type
 *    (corner / smooth / straight);
 *  - `segments[i]` joins `nodes[i]` to `nodes[i + 1]` (wrapping to `nodes[0]`
 *    when the sub-path is closed), and is either a straight line or a cubic
 *    Bezier carrying its two control points.
 *
 * Quadratic Beziers and elliptical arcs are converted to cubics on the way in,
 * exactly as PowerPoint itself does the first time a shape's points are
 * edited, so every operation only ever has two segment kinds to handle.
 *
 * Coordinates are in the element's LOCAL pixel frame: `(0, 0)` is the top-left
 * of the unrotated, unflipped box the session started from (see
 * `edit-points-frame.ts`).
 *
 * @module render/edit-points/edit-points-types
 */

/** A 2D point in the element's local pixel frame. */
export interface EditPoint {
	x: number;
	y: number;
}

/**
 * PowerPoint's three vertex types (right-click a point in Edit Points mode):
 *
 *  - `corner`: the two control handles move independently;
 *  - `smooth`: the handles stay collinear AND equally long;
 *  - `straight`: the handles stay collinear but keep their own lengths.
 */
export type EditPointNodeType = 'corner' | 'smooth' | 'straight';

/** One vertex of a sub-path. */
export interface EditNode extends EditPoint {
	type: EditPointNodeType;
}

/** The segment joining two consecutive nodes. */
export type EditSegment =
	| { kind: 'line' }
	| {
			kind: 'curve';
			/** Control point leaving the segment's start node. */
			c1: EditPoint;
			/** Control point arriving at the segment's end node. */
			c2: EditPoint;
	  };

/** OOXML `a:path/@fill` values preserved per sub-path. */
export type EditSubpathFillMode =
	| 'norm'
	| 'lighten'
	| 'lightenLess'
	| 'darken'
	| 'darkenLess'
	| 'none';

/** One `moveTo`-started run of the pen. */
export interface EditSubpath {
	nodes: EditNode[];
	/**
	 * `segments[i]` joins `nodes[i]` to `nodes[i + 1]`; a closed sub-path has
	 * one more, joining the last node back to the first. So the length is
	 * `nodes.length` when closed and `nodes.length - 1` when open.
	 */
	segments: EditSegment[];
	closed: boolean;
	/** `a:path/@fill`, carried through unchanged. */
	fillMode?: EditSubpathFillMode;
	/** `a:path/@stroke`, carried through unchanged. */
	stroke?: boolean;
}

/** A whole editable outline: every sub-path of the shape. */
export interface EditGeometry {
	subpaths: EditSubpath[];
	/**
	 * The text rectangle (local px) the shape had when editing began: a
	 * converted preset keeps its own text box (a star's text stays in the
	 * star's centre) instead of spreading over the new bounding box.
	 */
	textRect?: EditTextRect;
}

/** A text rectangle as absolute left / top / right / bottom edges. */
export interface EditTextRect {
	l: number;
	t: number;
	r: number;
	b: number;
}

/** Address of one node. */
export interface EditNodeRef {
	subpath: number;
	node: number;
}

/** Address of one segment. */
export interface EditSegmentRef {
	subpath: number;
	segment: number;
}

/** Address of one Bezier control handle: `c1` or `c2` of a curve segment. */
export interface EditHandleRef extends EditSegmentRef {
	which: 'c1' | 'c2';
}

/**
 * The box the local frame is anchored to: the element's position, size,
 * rotation (degrees clockwise) and flips when the session began.
 */
export interface EditFrame {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	flipH: boolean;
	flipV: boolean;
}
