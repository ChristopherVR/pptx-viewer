/**
 * Small shared utilities for the Edit Points operations: cloning, addressing
 * and the vector arithmetic every op repeats.
 *
 * @module render/edit-points/edit-points-geometry-utils
 */
import type { CubicBezier } from './edit-points-bezier';
import { incomingSegmentIndex, outgoingSegmentIndex } from './edit-points-pen';
import type {
	EditGeometry,
	EditNodeRef,
	EditPoint,
	EditSegment,
	EditSegmentRef,
	EditSubpath,
} from './edit-points-types';

export function cloneSegment(seg: EditSegment): EditSegment {
	return seg.kind === 'line'
		? { kind: 'line' }
		: { kind: 'curve', c1: { ...seg.c1 }, c2: { ...seg.c2 } };
}

export function cloneSubpath(sub: EditSubpath): EditSubpath {
	return {
		...sub,
		nodes: sub.nodes.map((node) => ({ ...node })),
		segments: sub.segments.map(cloneSegment),
	};
}

export function cloneGeometry(geometry: EditGeometry): EditGeometry {
	return {
		subpaths: geometry.subpaths.map(cloneSubpath),
		...(geometry.textRect ? { textRect: { ...geometry.textRect } } : {}),
	};
}

/** The index of the node a segment ends on. */
export function segmentEndIndex(sub: EditSubpath, segment: number): number {
	return (segment + 1) % sub.nodes.length;
}

/** Whether `ref` addresses a real node. */
export function hasNode(geometry: EditGeometry, ref: EditNodeRef): boolean {
	const sub = geometry.subpaths[ref.subpath];
	return Boolean(sub) && ref.node >= 0 && ref.node < sub.nodes.length;
}

/** Whether `ref` addresses a real segment. */
export function hasSegment(geometry: EditGeometry, ref: EditSegmentRef): boolean {
	const sub = geometry.subpaths[ref.subpath];
	return Boolean(sub) && ref.segment >= 0 && ref.segment < sub.segments.length;
}

/** The segment as a cubic (a line becomes the equivalent straight cubic). */
export function segmentAsCubic(sub: EditSubpath, segment: number): CubicBezier {
	const p0 = sub.nodes[segment];
	const p3 = sub.nodes[segmentEndIndex(sub, segment)];
	const seg = sub.segments[segment];
	if (seg.kind === 'curve') {
		return { p0, p1: seg.c1, p2: seg.c2, p3 };
	}
	return { p0, p1: thirdPoint(p0, p3, 1 / 3), p2: thirdPoint(p0, p3, 2 / 3), p3 };
}

export function thirdPoint(a: EditPoint, b: EditPoint, t: number): EditPoint {
	return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Turn a line segment into a (still straight-looking) curve in place. */
export function ensureCurve(sub: EditSubpath, segment: number): void {
	const seg = sub.segments[segment];
	if (seg.kind === 'curve') {
		return;
	}
	const cubic = segmentAsCubic(sub, segment);
	sub.segments[segment] = { kind: 'curve', c1: { ...cubic.p1 }, c2: { ...cubic.p2 } };
}

/** The control handles either side of a node, when those segments are curves. */
export function nodeHandles(
	sub: EditSubpath,
	node: number,
): { inSeg?: number; outSeg?: number; inHandle?: EditPoint; outHandle?: EditPoint } {
	const inSeg = incomingSegmentIndex(sub, node);
	const outSeg = outgoingSegmentIndex(sub, node);
	const inS = inSeg === undefined ? undefined : sub.segments[inSeg];
	const outS = outSeg === undefined ? undefined : sub.segments[outSeg];
	return {
		inSeg,
		outSeg,
		inHandle: inS?.kind === 'curve' ? inS.c2 : undefined,
		outHandle: outS?.kind === 'curve' ? outS.c1 : undefined,
	};
}

/**
 * Re-impose a smooth / straight node's constraint after one of its handles
 * moved: the OTHER handle swings to stay collinear through the node, keeping
 * its own length (straight) or matching the moved one (smooth).
 */
export function constrainOppositeHandle(sub: EditSubpath, node: number, moved: 'in' | 'out'): void {
	const n = sub.nodes[node];
	if (n.type === 'corner') {
		return;
	}
	const { inHandle, outHandle } = nodeHandles(sub, node);
	const source = moved === 'in' ? inHandle : outHandle;
	const target = moved === 'in' ? outHandle : inHandle;
	if (!source || !target) {
		return;
	}
	const sx = source.x - n.x;
	const sy = source.y - n.y;
	const sLen = Math.hypot(sx, sy);
	if (sLen < 1e-9) {
		return;
	}
	const len = n.type === 'smooth' ? sLen : Math.hypot(target.x - n.x, target.y - n.y);
	target.x = n.x - (sx / sLen) * len;
	target.y = n.y - (sy / sLen) * len;
}
