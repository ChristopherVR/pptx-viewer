/**
 * Boolean operations on polygon regions, the engine behind Merge Shapes.
 *
 * Method: build the planar arrangement of both inputs (see
 * `./polygon-arrangement`), then keep exactly the arrangement edges that
 * separate "in the result" from "not in the result". Each edge is classified
 * by sampling a point a hair to either side of its midpoint against the two
 * ORIGINAL regions (even-odd), so concave shapes, holes, shared edges and
 * touching vertices need no special cases. Kept edges are oriented with the
 * result on their left and chained into loops.
 *
 * @module render/merge-shapes/polygon-boolean
 */
import { buildArrangement } from './polygon-arrangement';
import type { ArrangementEdge } from './polygon-arrangement';
import type { PolygonLoop, PolygonPoint, PolygonRegion } from './polygon-types';
import { isPointInRegion, signedLoopArea } from './polygon-types';

/** The four binary set operations. Combine is `xor`. */
export type PolygonBooleanOp = 'union' | 'intersect' | 'subtract' | 'xor';

function combine(op: PolygonBooleanOp, a: boolean, b: boolean): boolean {
	switch (op) {
		case 'union':
			return a || b;
		case 'intersect':
			return a && b;
		case 'subtract':
			return a && !b;
		case 'xor':
			return a !== b;
	}
}

/** Pick the outgoing edge turning furthest left from the incoming direction. */
function pickNext(
	vertices: readonly PolygonPoint[],
	prev: number,
	cur: number,
	candidates: readonly number[],
	edges: readonly ArrangementEdge[],
): number {
	if (candidates.length === 1) {
		return candidates[0];
	}
	const inX = vertices[cur].x - vertices[prev].x;
	const inY = vertices[cur].y - vertices[prev].y;
	let best = candidates[0];
	let bestAngle = -Infinity;
	for (const c of candidates) {
		const to = vertices[edges[c].to];
		const outX = to.x - vertices[cur].x;
		const outY = to.y - vertices[cur].y;
		const angle = Math.atan2(inX * outY - inY * outX, inX * outX + inY * outY);
		if (angle > bestAngle) {
			bestAngle = angle;
			best = c;
		}
	}
	return best;
}

function chainLoops(
	vertices: readonly PolygonPoint[],
	edges: readonly ArrangementEdge[],
): number[][] {
	const outgoing = new Map<number, number[]>();
	edges.forEach((edge, i) => {
		const list = outgoing.get(edge.from);
		if (list) {
			list.push(i);
		} else {
			outgoing.set(edge.from, [i]);
		}
	});
	const used = new Set<number>();
	const loops: number[][] = [];
	for (let start = 0; start < edges.length; start++) {
		if (used.has(start)) {
			continue;
		}
		used.add(start);
		const loop = [edges[start].from];
		let prev = edges[start].from;
		let cur = edges[start].to;
		let closed = false;
		for (let guard = 0; guard <= edges.length; guard++) {
			if (cur === edges[start].from) {
				closed = true;
				break;
			}
			loop.push(cur);
			const candidates = (outgoing.get(cur) ?? []).filter((e) => !used.has(e));
			if (candidates.length === 0) {
				break;
			}
			const next = pickNext(vertices, prev, cur, candidates, edges);
			used.add(next);
			prev = cur;
			cur = edges[next].to;
		}
		if (closed && loop.length >= 3) {
			loops.push(loop);
		}
	}
	return loops;
}

/** Drop vertices that sit on the straight line between their neighbours. */
export function simplifyLoop(loop: readonly PolygonPoint[], tol: number): PolygonLoop {
	let points = [...loop];
	let changed = true;
	while (changed && points.length > 3) {
		changed = false;
		const kept: PolygonPoint[] = [];
		for (let i = 0; i < points.length; i++) {
			const a = kept.length > 0 ? kept[kept.length - 1] : points[points.length - 1];
			const b = points[i];
			const c = points[(i + 1) % points.length];
			const abx = b.x - a.x;
			const aby = b.y - a.y;
			const bcx = c.x - b.x;
			const bcy = c.y - b.y;
			const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
			const deviation = Math.abs(abx * bcy - aby * bcx) / len;
			if (deviation <= tol && abx * bcx + aby * bcy >= 0) {
				changed = true;
				continue;
			}
			kept.push(b);
		}
		points = kept;
	}
	return points;
}

/**
 * `a <op> b`. Inputs are read even-odd; the result is oriented inside-left
 * (see `./polygon-types`). An empty array means an empty result.
 */
export function booleanRegions(
	op: PolygonBooleanOp,
	a: readonly PolygonLoop[],
	b: readonly PolygonLoop[],
): PolygonRegion {
	const { vertices, edges, scale } = buildArrangement([a, b]);
	const offset = scale * 1e-6;
	const kept: ArrangementEdge[] = [];
	for (const edge of edges) {
		const p = vertices[edge.from];
		const q = vertices[edge.to];
		const len = Math.hypot(q.x - p.x, q.y - p.y);
		if (len === 0) {
			continue;
		}
		const mx = (p.x + q.x) / 2;
		const my = (p.y + q.y) / 2;
		const nx = (-(q.y - p.y) / len) * offset;
		const ny = ((q.x - p.x) / len) * offset;
		const left = { x: mx + nx, y: my + ny };
		const right = { x: mx - nx, y: my - ny };
		const inLeft = combine(op, isPointInRegion(left, a), isPointInRegion(left, b));
		const inRight = combine(op, isPointInRegion(right, a), isPointInRegion(right, b));
		if (inLeft !== inRight) {
			kept.push(inLeft ? edge : { from: edge.to, to: edge.from });
		}
	}
	const minArea = scale * scale * 1e-10;
	return chainLoops(vertices, kept)
		.map((loop) =>
			simplifyLoop(
				loop.map((i) => vertices[i]),
				scale * 1e-7,
			),
		)
		.filter((loop) => loop.length >= 3 && Math.abs(signedLoopArea(loop)) > minArea);
}

/** Total filled area of an inside-left oriented region (holes subtract). */
export function regionArea(region: readonly PolygonLoop[]): number {
	return region.reduce((sum, loop) => sum + signedLoopArea(loop), 0);
}

/** Re-orient an even-odd region inside-left by unioning it with nothing. */
export function normalizeRegion(region: readonly PolygonLoop[]): PolygonRegion {
	return booleanRegions('union', region, []);
}

/**
 * Split an inside-left region into its connected pieces: each outer loop plus
 * the holes directly inside it. Fragment uses this so two disjoint leftovers
 * become two shapes, as PowerPoint makes them.
 */
export function splitRegionComponents(region: readonly PolygonLoop[]): PolygonRegion[] {
	const outers = region.filter((loop) => signedLoopArea(loop) > 0);
	const holes = region.filter((loop) => signedLoopArea(loop) <= 0);
	const groups: PolygonRegion[] = outers.map((outer) => [outer]);
	for (const hole of holes) {
		// A point just left of a hole edge is filled, so it lies in the outer
		// that owns the hole; the smallest such outer is the direct owner.
		const p = hole[0];
		const q = hole[1];
		const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
		const probe = {
			x: (p.x + q.x) / 2 - ((q.y - p.y) / len) * 1e-6 * len,
			y: (p.y + q.y) / 2 + ((q.x - p.x) / len) * 1e-6 * len,
		};
		let owner = -1;
		let ownerArea = Infinity;
		outers.forEach((outer, i) => {
			const area = signedLoopArea(outer);
			if (area < ownerArea && isPointInRegion(probe, [outer])) {
				owner = i;
				ownerArea = area;
			}
		});
		if (owner >= 0) {
			groups[owner].push(hole);
		}
	}
	return groups;
}
