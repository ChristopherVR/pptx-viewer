/**
 * Closed-polygon ("ring") helpers for the lit SmartArt 3D solids: clean-up,
 * orientation, per-edge normals and a mitred inward/outward offset
 * (framework-agnostic, pure).
 *
 * @module render/smartart-3d-ring
 */
import type { Point2 } from './smartart-3d-types';

/** Points closer than this are treated as the same vertex. */
const EPSILON = 1e-6;
/** Longest mitre, as a multiple of the offset distance (sharp spikes are clipped). */
const MITER_LIMIT = 4;

/** Drop repeated consecutive points and the closing duplicate of the first point. */
export function cleanRing(points: readonly Point2[]): Point2[] {
	const out: Point2[] = [];
	for (const p of points) {
		const last = out[out.length - 1];
		if (!last || Math.hypot(p.x - last.x, p.y - last.y) > EPSILON) {
			out.push({ x: p.x, y: p.y });
		}
	}
	while (out.length > 1) {
		const first = out[0];
		const last = out[out.length - 1];
		if (Math.hypot(first.x - last.x, first.y - last.y) > EPSILON) {
			break;
		}
		out.pop();
	}
	return out;
}

/** Shoelace signed area: positive for a counter-clockwise ring in y-up space. */
export function ringSignedArea(ring: readonly Point2[]): number {
	let area = 0;
	for (let i = 0; i < ring.length; i++) {
		const a = ring[i];
		const b = ring[(i + 1) % ring.length];
		area += a.x * b.y - b.x * a.y;
	}
	return area / 2;
}

/** A cleaned, counter-clockwise (y-up) copy of `points`. */
export function toCcwRing(points: readonly Point2[]): Point2[] {
	const ring = cleanRing(points);
	return ringSignedArea(ring) < 0 ? ring.reverse() : ring;
}

/**
 * Unit inward normal of every edge `i -> i + 1` of a counter-clockwise ring
 * (the interior is on the edge's left).
 */
export function ringEdgeNormals(ring: readonly Point2[]): Point2[] {
	return ring.map((a, i) => {
		const b = ring[(i + 1) % ring.length];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		return { x: -dy / len, y: dx / len };
	});
}

/**
 * Offset a counter-clockwise ring by `distance` along its inward normals
 * (negative grows it). Each vertex moves along its mitre, clipped at
 * {@link MITER_LIMIT} times the distance so a sharp spike stays bounded.
 */
export function offsetRing(ring: readonly Point2[], distance: number): Point2[] {
	if (distance === 0) {
		return ring.map((p) => ({ x: p.x, y: p.y }));
	}
	const normals = ringEdgeNormals(ring);
	const n = ring.length;
	return ring.map((p, i) => {
		const prev = normals[(i - 1 + n) % n];
		const next = normals[i];
		const denom = Math.max(0.05, 1 + prev.x * next.x + prev.y * next.y);
		let ox = ((prev.x + next.x) / denom) * distance;
		let oy = ((prev.y + next.y) / denom) * distance;
		const len = Math.hypot(ox, oy);
		const max = Math.abs(distance) * MITER_LIMIT;
		if (len > max) {
			ox = (ox / len) * max;
			oy = (oy / len) * max;
		}
		return { x: p.x + ox, y: p.y + oy };
	});
}

/**
 * The in-plane inward direction to shade each edge's two ends with.
 *
 * `result[i]` is `[atStart, atEnd]` for edge `i -> i + 1`. Where the ring
 * turns by less than `smoothDeg` (a curve's tessellation) the two edges share
 * the averaged normal, so a circle shades smoothly; at a real corner each
 * edge keeps its own normal, so a rectangle's sides shade flat.
 */
export function ringShadingNormals(
	ring: readonly Point2[],
	smoothDeg = 30,
): Array<[Point2, Point2]> {
	const normals = ringEdgeNormals(ring);
	const n = ring.length;
	const cosLimit = Math.cos((smoothDeg * Math.PI) / 180);
	const vertexNormal = (own: Point2, other: Point2): Point2 => {
		if (own.x * other.x + own.y * other.y < cosLimit) {
			return own;
		}
		const x = own.x + other.x;
		const y = own.y + other.y;
		const len = Math.hypot(x, y) || 1;
		return { x: x / len, y: y / len };
	};
	return normals.map((own, i) => [
		vertexNormal(own, normals[(i - 1 + n) % n]),
		vertexNormal(own, normals[(i + 1) % n]),
	]);
}
