/**
 * The three Edit Points drags: move a vertex, move a Bezier handle, and bend a
 * segment by dragging a point on it. Each is a pure function from the
 * geometry AT DRAG START to the geometry for the current pointer, so a session
 * can recompute every frame from one stable origin instead of accumulating
 * rounding drift.
 *
 * @module render/edit-points/edit-points-drag-ops
 */
import { cubicPointAt } from './edit-points-bezier';
import {
	cloneGeometry,
	constrainOppositeHandle,
	ensureCurve,
	hasNode,
	hasSegment,
	segmentAsCubic,
	segmentEndIndex,
} from './edit-points-geometry-utils';
import { incomingSegmentIndex, outgoingSegmentIndex } from './edit-points-pen';
import type {
	EditGeometry,
	EditHandleRef,
	EditNodeRef,
	EditPoint,
	EditSegmentRef,
} from './edit-points-types';

/**
 * Move a vertex to `to`. Its two handles travel with it, so the curves either
 * side keep their shape near the vertex (PowerPoint behaves the same).
 */
export function moveEditNode(
	geometry: EditGeometry,
	ref: EditNodeRef,
	to: EditPoint,
): EditGeometry {
	if (!hasNode(geometry, ref)) {
		return geometry;
	}
	const next = cloneGeometry(geometry);
	const sub = next.subpaths[ref.subpath];
	const node = sub.nodes[ref.node];
	const dx = to.x - node.x;
	const dy = to.y - node.y;
	node.x = to.x;
	node.y = to.y;
	const inIdx = incomingSegmentIndex(sub, ref.node);
	const outIdx = outgoingSegmentIndex(sub, ref.node);
	const inSeg = inIdx === undefined ? undefined : sub.segments[inIdx];
	const outSeg = outIdx === undefined ? undefined : sub.segments[outIdx];
	// A one-node closed loop has the same segment on both sides; move each
	// handle once.
	if (inSeg?.kind === 'curve') {
		inSeg.c2 = { x: inSeg.c2.x + dx, y: inSeg.c2.y + dy };
	}
	if (outSeg?.kind === 'curve') {
		outSeg.c1 = { x: outSeg.c1.x + dx, y: outSeg.c1.y + dy };
	}
	return next;
}

/**
 * Move one Bezier handle to `to`. A smooth or straight vertex swings its other
 * handle to stay collinear (see `constrainOppositeHandle`).
 */
export function moveEditHandle(
	geometry: EditGeometry,
	ref: EditHandleRef,
	to: EditPoint,
): EditGeometry {
	if (!hasSegment(geometry, ref)) {
		return geometry;
	}
	const next = cloneGeometry(geometry);
	const sub = next.subpaths[ref.subpath];
	const seg = sub.segments[ref.segment];
	if (seg.kind !== 'curve') {
		return geometry;
	}
	if (ref.which === 'c1') {
		seg.c1 = { x: to.x, y: to.y };
		constrainOppositeHandle(sub, ref.segment, 'out');
	} else {
		seg.c2 = { x: to.x, y: to.y };
		constrainOppositeHandle(sub, segmentEndIndex(sub, ref.segment), 'in');
	}
	return next;
}

/** Keep the grab parameter away from the ends, where a bend has no leverage. */
const BEND_PARAM_MIN = 0.05;

/**
 * Bend a segment so the point originally at parameter `t` follows the pointer
 * to `to`. A straight segment becomes a curve first (PowerPoint converts it the
 * same way). Both controls move, weighted towards the nearer end, by exactly
 * the amount that puts `B(t)` on the pointer.
 */
export function bendEditSegment(
	geometry: EditGeometry,
	ref: EditSegmentRef,
	t: number,
	to: EditPoint,
): EditGeometry {
	if (!hasSegment(geometry, ref)) {
		return geometry;
	}
	const next = cloneGeometry(geometry);
	const sub = next.subpaths[ref.subpath];
	ensureCurve(sub, ref.segment);
	const seg = sub.segments[ref.segment];
	if (seg.kind !== 'curve') {
		return geometry;
	}
	const u = Math.min(1 - BEND_PARAM_MIN, Math.max(BEND_PARAM_MIN, t));
	const at = cubicPointAt(segmentAsCubic(sub, ref.segment), u);
	const dx = to.x - at.x;
	const dy = to.y - at.y;
	// dB(u) = 3(1-u)^2 u * d1 + 3(1-u) u^2 * d2 with d1 = d(1-u)/k, d2 = d u/k.
	const k = 3 * u * (1 - u) * ((1 - u) ** 2 + u ** 2);
	const w1 = (1 - u) / k;
	const w2 = u / k;
	seg.c1 = { x: seg.c1.x + dx * w1, y: seg.c1.y + dy * w1 };
	seg.c2 = { x: seg.c2.x + dx * w2, y: seg.c2.y + dy * w2 };
	constrainOppositeHandle(sub, ref.segment, 'out');
	constrainOppositeHandle(sub, segmentEndIndex(sub, ref.segment), 'in');
	return next;
}
