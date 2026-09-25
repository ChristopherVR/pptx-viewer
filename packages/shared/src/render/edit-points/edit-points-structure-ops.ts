/**
 * The Edit Points right-click commands that change a path's structure or a
 * vertex's type: Add / Delete Point, Delete Segment, Open / Close Path,
 * Smooth / Straight / Corner Point and Straight / Curved Segment.
 *
 * Every function is pure and returns `undefined` when the command does not
 * apply (so a caller can grey the menu entry out with the same call it would
 * run), never a half-applied geometry.
 *
 * @module render/edit-points/edit-points-structure-ops
 */
import { splitCubic } from './edit-points-bezier';
import {
	cloneGeometry,
	ensureCurve,
	hasNode,
	hasSegment,
	nodeHandles,
	segmentAsCubic,
	segmentEndIndex,
	thirdPoint,
} from './edit-points-geometry-utils';
import { incomingSegmentIndex, outgoingSegmentIndex } from './edit-points-pen';
import type {
	EditGeometry,
	EditNodeRef,
	EditPointNodeType,
	EditSegment,
	EditSegmentRef,
	EditSubpath,
} from './edit-points-types';

/** Insert a vertex on a segment at parameter `t` without changing the outline. */
export function addEditPoint(
	geometry: EditGeometry,
	ref: EditSegmentRef,
	t: number,
): { geometry: EditGeometry; node: EditNodeRef } | undefined {
	if (!hasSegment(geometry, ref) || !(t > 0 && t < 1)) {
		return undefined;
	}
	const next = cloneGeometry(geometry);
	const sub = next.subpaths[ref.subpath];
	const seg = sub.segments[ref.segment];
	const [a, b] = splitCubic(segmentAsCubic(sub, ref.segment), t);
	const insertAt = ref.segment + 1;
	let parts: [EditSegment, EditSegment];
	if (seg.kind === 'line') {
		parts = [{ kind: 'line' }, { kind: 'line' }];
	} else {
		parts = [
			{ kind: 'curve', c1: a.p1, c2: a.p2 },
			{ kind: 'curve', c1: b.p1, c2: b.p2 },
		];
	}
	// A line splits exactly by interpolation (de Casteljau on its straight
	// cubic would carry floating-point noise into the new vertex).
	const at =
		seg.kind === 'line'
			? thirdPoint(sub.nodes[ref.segment], sub.nodes[segmentEndIndex(sub, ref.segment)], t)
			: a.p3;
	sub.nodes.splice(insertAt, 0, {
		x: at.x,
		y: at.y,
		type: seg.kind === 'line' ? 'corner' : 'smooth',
	});
	sub.segments.splice(ref.segment, 1, ...parts);
	return { geometry: next, node: { subpath: ref.subpath, node: insertAt } };
}

function dropEmptySubpaths(geometry: EditGeometry): EditGeometry | undefined {
	const subpaths = geometry.subpaths.filter((sub) => sub.nodes.length >= 2);
	return subpaths.length > 0 ? { ...geometry, subpaths } : undefined;
}

/**
 * Remove a vertex, joining its two neighbours with one segment (a line when
 * both sides were lines, otherwise a curve keeping the outer handles).
 * Refused when it would leave nothing to draw.
 */
export function deleteEditPoint(
	geometry: EditGeometry,
	ref: EditNodeRef,
): EditGeometry | undefined {
	if (!hasNode(geometry, ref)) {
		return undefined;
	}
	const next = cloneGeometry(geometry);
	const sub = next.subpaths[ref.subpath];
	const k = ref.node;
	const inIdx = incomingSegmentIndex(sub, k);
	const outIdx = outgoingSegmentIndex(sub, k);
	if (inIdx === undefined || outIdx === undefined) {
		// An open end: just shorten the path.
		sub.nodes.splice(k, 1);
		sub.segments.splice(inIdx === undefined ? 0 : inIdx, 1);
		return dropEmptySubpaths(next);
	}
	const inSeg = sub.segments[inIdx];
	const outSeg = sub.segments[outIdx];
	const prev = sub.nodes[inIdx];
	const after = sub.nodes[segmentEndIndex(sub, outIdx)];
	const merged: EditSegment =
		inSeg.kind === 'line' && outSeg.kind === 'line'
			? { kind: 'line' }
			: {
					kind: 'curve',
					c1: inSeg.kind === 'curve' ? inSeg.c1 : thirdPoint(prev, after, 1 / 3),
					c2: outSeg.kind === 'curve' ? outSeg.c2 : thirdPoint(prev, after, 2 / 3),
				};
	sub.segments[inIdx] = merged;
	sub.segments.splice(outIdx, 1);
	sub.nodes.splice(k, 1);
	if (sub.closed && sub.nodes.length < 2) {
		sub.nodes = [];
	}
	return dropEmptySubpaths(next);
}

function rotate<T>(list: T[], by: number): T[] {
	return [...list.slice(by), ...list.slice(0, by)];
}

/** Open a closed path at a vertex: the vertex becomes both its start and end. */
export function openEditPathAtNode(
	geometry: EditGeometry,
	ref: EditNodeRef,
): EditGeometry | undefined {
	const sub = geometry.subpaths[ref.subpath];
	if (!hasNode(geometry, ref) || !sub.closed) {
		return undefined;
	}
	const next = cloneGeometry(geometry);
	const target = next.subpaths[ref.subpath];
	target.nodes = rotate(target.nodes, ref.node);
	target.segments = rotate(target.segments, ref.node);
	target.nodes.push({ ...target.nodes[0], type: 'corner' });
	target.nodes[0].type = 'corner';
	target.closed = false;
	return next;
}

/**
 * Remove a segment. A closed path opens there; an open path splits in two
 * (dropping any piece left with a single vertex).
 */
export function deleteEditSegment(
	geometry: EditGeometry,
	ref: EditSegmentRef,
): EditGeometry | undefined {
	if (!hasSegment(geometry, ref)) {
		return undefined;
	}
	const next = cloneGeometry(geometry);
	const sub = next.subpaths[ref.subpath];
	if (sub.closed) {
		const start = segmentEndIndex(sub, ref.segment);
		sub.nodes = rotate(sub.nodes, start);
		sub.segments = rotate(sub.segments, start);
		sub.segments.pop();
		sub.closed = false;
		return dropEmptySubpaths(next);
	}
	const head: EditSubpath = {
		...sub,
		nodes: sub.nodes.slice(0, ref.segment + 1),
		segments: sub.segments.slice(0, ref.segment),
	};
	const tail: EditSubpath = {
		...sub,
		nodes: sub.nodes.slice(ref.segment + 1),
		segments: sub.segments.slice(ref.segment + 1),
	};
	next.subpaths.splice(ref.subpath, 1, head, tail);
	return dropEmptySubpaths(next);
}

/**
 * Close an open path: a straight segment joins its end back to its start, or
 * the two ends merge when they already coincide.
 */
export function closeEditPath(geometry: EditGeometry, subpath: number): EditGeometry | undefined {
	const sub = geometry.subpaths[subpath];
	if (!sub || sub.closed || sub.nodes.length < 2) {
		return undefined;
	}
	const next = cloneGeometry(geometry);
	const target = next.subpaths[subpath];
	const first = target.nodes[0];
	const last = target.nodes[target.nodes.length - 1];
	if (target.nodes.length > 2 && Math.hypot(first.x - last.x, first.y - last.y) < 0.5) {
		target.nodes.pop();
	} else {
		target.segments.push({ kind: 'line' });
	}
	target.closed = true;
	return next;
}

/** Make a segment straight or curved. */
export function setEditSegmentKind(
	geometry: EditGeometry,
	ref: EditSegmentRef,
	kind: 'line' | 'curve',
): EditGeometry | undefined {
	if (
		!hasSegment(geometry, ref) ||
		geometry.subpaths[ref.subpath].segments[ref.segment].kind === kind
	) {
		return undefined;
	}
	const next = cloneGeometry(geometry);
	const sub = next.subpaths[ref.subpath];
	if (kind === 'line') {
		sub.segments[ref.segment] = { kind: 'line' };
	} else {
		ensureCurve(sub, ref.segment);
	}
	return next;
}

/**
 * Set a vertex's type. Smooth and Straight turn the adjoining segments into
 * curves and align both handles along the line through the neighbouring
 * vertices (Smooth also equalises their lengths); Corner only relabels.
 */
export function setEditNodeType(
	geometry: EditGeometry,
	ref: EditNodeRef,
	type: EditPointNodeType,
): EditGeometry | undefined {
	if (!hasNode(geometry, ref)) {
		return undefined;
	}
	const next = cloneGeometry(geometry);
	const sub = next.subpaths[ref.subpath];
	const node = sub.nodes[ref.node];
	node.type = type;
	if (type === 'corner') {
		return next;
	}
	const before = nodeHandles(sub, ref.node);
	if (before.inSeg !== undefined) {
		ensureCurve(sub, before.inSeg);
	}
	if (before.outSeg !== undefined) {
		ensureCurve(sub, before.outSeg);
	}
	const { inSeg, outSeg, inHandle, outHandle } = nodeHandles(sub, ref.node);
	if (!inHandle || !outHandle || inSeg === undefined || outSeg === undefined) {
		return next;
	}
	const prev = sub.nodes[inSeg];
	const after = sub.nodes[segmentEndIndex(sub, outSeg)];
	let dx = after.x - prev.x;
	let dy = after.y - prev.y;
	if (Math.hypot(dx, dy) < 1e-9) {
		dx = outHandle.x - inHandle.x;
		dy = outHandle.y - inHandle.y;
	}
	const len = Math.hypot(dx, dy);
	if (len < 1e-9) {
		return next;
	}
	const ux = dx / len;
	const uy = dy / len;
	const inLen = Math.hypot(inHandle.x - node.x, inHandle.y - node.y);
	const outLen = Math.hypot(outHandle.x - node.x, outHandle.y - node.y);
	const avg = (inLen + outLen) / 2;
	const li = type === 'smooth' ? avg : inLen;
	const lo = type === 'smooth' ? avg : outLen;
	inHandle.x = node.x - ux * li;
	inHandle.y = node.y - uy * li;
	outHandle.x = node.x + ux * lo;
	outHandle.y = node.y + uy * lo;
	return next;
}
