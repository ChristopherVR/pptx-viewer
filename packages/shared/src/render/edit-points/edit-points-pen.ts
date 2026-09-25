/**
 * A pen that turns a stream of path commands into the vertex-centric
 * {@link EditGeometry}, shared by every importer (structured `a:custGeom`
 * paths, SVG path strings from the preset engine, freeform drawing tools).
 *
 * @module render/edit-points/edit-points-pen
 */
import type {
	EditGeometry,
	EditNode,
	EditPoint,
	EditPointNodeType,
	EditSegment,
	EditSubpath,
	EditSubpathFillMode,
} from './edit-points-types';

/** Two points closer than this (local px) are the same vertex. */
export const EDIT_POINT_COINCIDENT_EPSILON = 0.01;

function samePoint(a: EditPoint, b: EditPoint): boolean {
	return (
		Math.abs(a.x - b.x) <= EDIT_POINT_COINCIDENT_EPSILON &&
		Math.abs(a.y - b.y) <= EDIT_POINT_COINCIDENT_EPSILON
	);
}

/** Accumulates sub-paths from pen commands. */
export class EditGeometryPen {
	private readonly subpaths: EditSubpath[] = [];
	private current: EditSubpath | null = null;
	private startPoint: EditPoint = { x: 0, y: 0 };
	private pen: EditPoint = { x: 0, y: 0 };
	private fillMode: EditSubpathFillMode | undefined;
	private stroke: boolean | undefined;

	/** Paint flags applied to every sub-path started from now on. */
	setPaint(fillMode: EditSubpathFillMode | undefined, stroke: boolean | undefined): void {
		this.fillMode = fillMode;
		this.stroke = stroke;
	}

	/** The current pen position. */
	get position(): EditPoint {
		return this.pen;
	}

	moveTo(point: EditPoint): void {
		this.current = {
			nodes: [{ x: point.x, y: point.y, type: 'corner' }],
			segments: [],
			closed: false,
			...(this.fillMode !== undefined ? { fillMode: this.fillMode } : {}),
			...(this.stroke !== undefined ? { stroke: this.stroke } : {}),
		};
		this.subpaths.push(this.current);
		this.startPoint = { x: point.x, y: point.y };
		this.pen = { x: point.x, y: point.y };
	}

	private ensureOpen(): EditSubpath {
		if (!this.current || this.current.closed) {
			// Drawing after a close (or with no moveTo at all) starts a new run at
			// the pen, as both SVG and DrawingML do.
			this.moveTo(this.pen);
		}
		return this.current as EditSubpath;
	}

	lineTo(point: EditPoint): void {
		this.push({ kind: 'line' }, point);
	}

	curveTo(c1: EditPoint, c2: EditPoint, point: EditPoint): void {
		this.push({ kind: 'curve', c1: { ...c1 }, c2: { ...c2 } }, point);
	}

	private push(segment: EditSegment, point: EditPoint): void {
		const sub = this.ensureOpen();
		sub.segments.push(segment);
		sub.nodes.push({ x: point.x, y: point.y, type: 'corner' });
		this.pen = { x: point.x, y: point.y };
	}

	close(): void {
		const sub = this.current;
		if (!sub || sub.closed) {
			return;
		}
		const first = sub.nodes[0];
		const last = sub.nodes[sub.nodes.length - 1];
		if (sub.nodes.length > 1 && samePoint(first, last)) {
			// The run already ends on its start: the final node IS the first one,
			// so drop the duplicate and let the last segment wrap onto node 0.
			sub.nodes.pop();
		} else {
			sub.segments.push({ kind: 'line' });
		}
		sub.closed = true;
		this.pen = { ...this.startPoint };
	}

	/** The finished geometry, with lone `moveTo`s dropped and node types inferred. */
	finish(): EditGeometry {
		const subpaths = this.subpaths.filter(
			(sub) => sub.nodes.length >= 2 || (sub.closed && sub.segments.length > 0),
		);
		for (const sub of subpaths) {
			inferNodeTypes(sub);
		}
		return { subpaths };
	}
}

/** The segment arriving at node `i` (or undefined at an open start). */
export function incomingSegmentIndex(sub: EditSubpath, node: number): number | undefined {
	if (node > 0) {
		return node - 1;
	}
	return sub.closed ? sub.segments.length - 1 : undefined;
}

/** The segment leaving node `i` (or undefined at an open end). */
export function outgoingSegmentIndex(sub: EditSubpath, node: number): number | undefined {
	if (node < sub.segments.length) {
		return node;
	}
	return undefined;
}

/**
 * Classify each vertex from its handles: a vertex whose in and out handles are
 * collinear through it is `smooth` when they are equally long and `straight`
 * otherwise; everything else (including a vertex between two lines) is a
 * `corner`, which is what PowerPoint reports for a converted preset.
 */
export function inferNodeTypes(sub: EditSubpath): void {
	sub.nodes.forEach((node, index) => {
		node.type = classifyNode(sub, index, node);
	});
}

function classifyNode(sub: EditSubpath, index: number, node: EditNode): EditPointNodeType {
	const inIdx = incomingSegmentIndex(sub, index);
	const outIdx = outgoingSegmentIndex(sub, index);
	const inSeg = inIdx === undefined ? undefined : sub.segments[inIdx];
	const outSeg = outIdx === undefined ? undefined : sub.segments[outIdx];
	if (inSeg?.kind !== 'curve' || outSeg?.kind !== 'curve') {
		return 'corner';
	}
	const ax = inSeg.c2.x - node.x;
	const ay = inSeg.c2.y - node.y;
	const bx = outSeg.c1.x - node.x;
	const by = outSeg.c1.y - node.y;
	const la = Math.hypot(ax, ay);
	const lb = Math.hypot(bx, by);
	if (la < 1e-6 || lb < 1e-6) {
		return 'corner';
	}
	const cross = (ax * by - ay * bx) / (la * lb);
	const dot = (ax * bx + ay * by) / (la * lb);
	if (Math.abs(cross) > 0.01 || dot > -0.99) {
		return 'corner';
	}
	return Math.abs(la - lb) <= Math.max(0.5, 0.02 * Math.max(la, lb)) ? 'smooth' : 'straight';
}
