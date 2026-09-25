/**
 * The planar arrangement behind {@link booleanRegions}: every edge of every
 * input loop, split at every point where it meets another edge, with coincident
 * vertices merged and duplicate edges collapsed.
 *
 * Splitting first and classifying afterwards is what makes the boolean robust
 * where the older Sutherland-Hodgman path in core was not: a concave clip, a
 * shared edge, a hole, a vertex touching an edge are all just edges of the
 * arrangement, each classified on its own by sampling either side of it.
 *
 * @module render/merge-shapes/polygon-arrangement
 */
import type { PolygonLoop, PolygonPoint } from './polygon-types';

/** One edge of the arrangement between two canonical vertex indices. */
export interface ArrangementEdge {
	from: number;
	to: number;
}

/** Canonical vertices plus the undirected, de-duplicated edges between them. */
export interface Arrangement {
	vertices: PolygonPoint[];
	edges: ArrangementEdge[];
	/** Largest bounding-box dimension of the input; every tolerance scales from it. */
	scale: number;
}

interface Segment {
	a: PolygonPoint;
	b: PolygonPoint;
}

function loopSegments(loops: readonly PolygonLoop[]): Segment[] {
	const segments: Segment[] = [];
	for (const loop of loops) {
		for (let i = 0; i < loop.length; i++) {
			const a = loop[i];
			const b = loop[(i + 1) % loop.length];
			if (a.x !== b.x || a.y !== b.y) {
				segments.push({ a, b });
			}
		}
	}
	return segments;
}

function boundsScale(segments: readonly Segment[]): number {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const { a, b } of segments) {
		minX = Math.min(minX, a.x, b.x);
		minY = Math.min(minY, a.y, b.y);
		maxX = Math.max(maxX, a.x, b.x);
		maxY = Math.max(maxY, a.y, b.y);
	}
	return Number.isFinite(minX) ? Math.max(maxX - minX, maxY - minY, 1e-9) : 1;
}

/** Parameter of `p` projected onto segment `s`, as a fraction of its length. */
function projectParam(s: Segment, p: PolygonPoint): number {
	const dx = s.b.x - s.a.x;
	const dy = s.b.y - s.a.y;
	return ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / (dx * dx + dy * dy);
}

/** Record where segments `i` and `j` meet (crossing, touching or overlapping). */
function recordIntersections(
	si: Segment,
	sj: Segment,
	ti: number[],
	tj: number[],
	tol: number,
): void {
	const rx = si.b.x - si.a.x;
	const ry = si.b.y - si.a.y;
	const sx = sj.b.x - sj.a.x;
	const sy = sj.b.y - sj.a.y;
	const denom = rx * sy - ry * sx;
	const qpx = sj.a.x - si.a.x;
	const qpy = sj.a.y - si.a.y;
	const lenI = Math.hypot(rx, ry);
	const lenJ = Math.hypot(sx, sy);
	if (Math.abs(denom) <= 1e-12 * lenI * lenJ) {
		// Parallel: only collinear overlaps split anything.
		const dist = Math.abs(qpx * ry - qpy * rx) / lenI;
		if (dist > tol) {
			return;
		}
		for (const p of [sj.a, sj.b]) {
			const t = projectParam(si, p);
			if (t > 0 && t < 1) {
				ti.push(t);
			}
		}
		for (const p of [si.a, si.b]) {
			const u = projectParam(sj, p);
			if (u > 0 && u < 1) {
				tj.push(u);
			}
		}
		return;
	}
	const t = (qpx * sy - qpy * sx) / denom;
	const u = (qpx * ry - qpy * rx) / denom;
	const epsI = tol / lenI;
	const epsJ = tol / lenJ;
	if (t < -epsI || t > 1 + epsI || u < -epsJ || u > 1 + epsJ) {
		return;
	}
	ti.push(Math.min(1, Math.max(0, t)));
	tj.push(Math.min(1, Math.max(0, u)));
}

/** Snaps near-coincident points onto one canonical vertex. */
class VertexIndex {
	readonly vertices: PolygonPoint[] = [];
	private readonly cells = new Map<string, number[]>();

	constructor(private readonly tol: number) {}

	indexOf(p: PolygonPoint): number {
		const cx = Math.round(p.x / this.tol);
		const cy = Math.round(p.y / this.tol);
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				for (const idx of this.cells.get(`${cx + dx},${cy + dy}`) ?? []) {
					const v = this.vertices[idx];
					if (Math.abs(v.x - p.x) <= this.tol && Math.abs(v.y - p.y) <= this.tol) {
						return idx;
					}
				}
			}
		}
		const idx = this.vertices.length;
		this.vertices.push({ x: p.x, y: p.y });
		const key = `${cx},${cy}`;
		const bucket = this.cells.get(key);
		if (bucket) {
			bucket.push(idx);
		} else {
			this.cells.set(key, [idx]);
		}
		return idx;
	}
}

function overlaps(a: Segment, b: Segment, tol: number): boolean {
	return (
		Math.min(a.a.x, a.b.x) - tol <= Math.max(b.a.x, b.b.x) &&
		Math.min(b.a.x, b.b.x) - tol <= Math.max(a.a.x, a.b.x) &&
		Math.min(a.a.y, a.b.y) - tol <= Math.max(b.a.y, b.b.y) &&
		Math.min(b.a.y, b.b.y) - tol <= Math.max(a.a.y, a.b.y)
	);
}

/** Build the arrangement of every loop in `regions`. */
export function buildArrangement(regions: readonly (readonly PolygonLoop[])[]): Arrangement {
	const segments = regions.flatMap((loops) => loopSegments(loops));
	const scale = boundsScale(segments);
	const tol = scale * 1e-9;
	const params = segments.map(() => [0, 1]);
	for (let i = 0; i < segments.length; i++) {
		for (let j = i + 1; j < segments.length; j++) {
			if (overlaps(segments[i], segments[j], tol)) {
				recordIntersections(segments[i], segments[j], params[i], params[j], tol);
			}
		}
	}
	const index = new VertexIndex(scale * 1e-7);
	const seen = new Set<string>();
	const edges: ArrangementEdge[] = [];
	segments.forEach((seg, i) => {
		const ts = [...new Set(params[i])].sort((x, y) => x - y);
		let prev = -1;
		for (const t of ts) {
			const idx = index.indexOf({
				x: seg.a.x + (seg.b.x - seg.a.x) * t,
				y: seg.a.y + (seg.b.y - seg.a.y) * t,
			});
			if (prev >= 0 && prev !== idx) {
				const key = prev < idx ? `${prev}|${idx}` : `${idx}|${prev}`;
				if (!seen.has(key)) {
					seen.add(key);
					edges.push({ from: prev, to: idx });
				}
			}
			prev = idx;
		}
	});
	return { vertices: index.vertices, edges, scale };
}
