/**
 * Polygon normalisation and interpolation for shape-geometry morphing.
 *
 * Two outlines rarely share a vertex count or orientation, so direct
 * vertex-to-vertex interpolation produces garbage. This module resamples both
 * outlines to a common point count by walking each perimeter at uniform arc
 * length, normalises winding order, and rotates one ring so its first point
 * aligns with the other's. The result is two equal-length, like-oriented rings
 * that interpolate cleanly point-for-point.
 *
 * @module render/morph-geometry-interp
 */
import type { MorphPoint } from './morph-geometry';
import { OUTLINE_SAMPLE_COUNT } from './morph-geometry';

// ---------------------------------------------------------------------------
// Perimeter resampling
// ---------------------------------------------------------------------------

/** Euclidean distance between two points. */
function dist(a: MorphPoint, b: MorphPoint): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Resample a closed polygon to exactly `count` points spaced uniformly by arc
 * length around its perimeter.
 *
 * @param poly  The source polygon (treated as closed).
 * @param count Desired number of output points (>= 3).
 * @returns A new polygon with `count` evenly-spaced vertices.
 */
export function resamplePolygon(poly: MorphPoint[], count: number): MorphPoint[] {
	if (poly.length < 2) {
		return Array.from({ length: count }, () => ({ x: poly[0]?.x ?? 0, y: poly[0]?.y ?? 0 }));
	}
	// Cumulative perimeter length (closing edge included).
	const ring = [...poly, poly[0]];
	const segLen: number[] = [];
	let total = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const d = dist(ring[i], ring[i + 1]);
		segLen.push(d);
		total += d;
	}
	if (total === 0) {
		return Array.from({ length: count }, () => ({ x: poly[0].x, y: poly[0].y }));
	}

	const result: MorphPoint[] = [];
	const step = total / count;
	let seg = 0;
	let segStart = 0;
	for (let i = 0; i < count; i++) {
		const target = i * step;
		while (seg < segLen.length - 1 && segStart + segLen[seg] < target) {
			segStart += segLen[seg];
			seg++;
		}
		const within = segLen[seg] > 0 ? (target - segStart) / segLen[seg] : 0;
		const a = ring[seg];
		const b = ring[seg + 1];
		result.push({ x: a.x + (b.x - a.x) * within, y: a.y + (b.y - a.y) * within });
	}
	return result;
}

// ---------------------------------------------------------------------------
// Winding + rotation alignment
// ---------------------------------------------------------------------------

/** Signed area of a polygon; positive for counter-clockwise (SVG y-down). */
function signedArea(poly: MorphPoint[]): number {
	let area = 0;
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i];
		const b = poly[(i + 1) % poly.length];
		area += a.x * b.y - b.x * a.y;
	}
	return area / 2;
}

/** Rotate a ring so element `offset` becomes index 0. */
function rotateRing(poly: MorphPoint[], offset: number): MorphPoint[] {
	const n = poly.length;
	const o = ((offset % n) + n) % n;
	return poly.slice(o).concat(poly.slice(0, o));
}

/**
 * Find the rotation of `to` that minimises total squared distance to `from`.
 * Both rings must already have the same length.
 */
function bestRotation(from: MorphPoint[], to: MorphPoint[]): number {
	let bestOffset = 0;
	let bestCost = Infinity;
	for (let offset = 0; offset < to.length; offset++) {
		let cost = 0;
		for (let i = 0; i < from.length; i++) {
			const t = to[(i + offset) % to.length];
			const dx = from[i].x - t.x;
			const dy = from[i].y - t.y;
			cost += dx * dx + dy * dy;
			if (cost >= bestCost) {
				break;
			}
		}
		if (cost < bestCost) {
			bestCost = cost;
			bestOffset = offset;
		}
	}
	return bestOffset;
}

// ---------------------------------------------------------------------------
// Pair normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise two outlines into equal-length, like-oriented, rotation-aligned
 * rings ready for vertex-wise interpolation.
 *
 * @param fromPoly The outgoing outline polygon.
 * @param toPoly   The incoming outline polygon.
 * @param count    Common sample count (defaults to {@link OUTLINE_SAMPLE_COUNT}).
 * @returns A tuple of two normalised polygons of identical length.
 */
export function normalizeOutlinePair(
	fromPoly: MorphPoint[],
	toPoly: MorphPoint[],
	count: number = OUTLINE_SAMPLE_COUNT,
): [MorphPoint[], MorphPoint[]] {
	const from = resamplePolygon(fromPoly, count);
	let to = resamplePolygon(toPoly, count);

	// Align winding order so both rings travel the same direction.
	if (Math.sign(signedArea(from)) !== Math.sign(signedArea(to))) {
		to = [...to].reverse();
	}

	// Rotate `to` so its first vertex best matches `from`'s first vertex.
	const offset = bestRotation(from, to);
	to = rotateRing(to, offset);

	return [from, to];
}

// ---------------------------------------------------------------------------
// Interpolation + serialisation
// ---------------------------------------------------------------------------

/**
 * Interpolate two normalised outlines at parameter `t` and serialise to an SVG
 * path `d` string (a single closed sub-path). Inputs should come from
 * {@link normalizeOutlinePair}; if lengths differ the shorter length is used.
 *
 * @param from The outgoing normalised polygon.
 * @param to   The incoming normalised polygon.
 * @param t    Interpolation parameter, clamped to [0, 1].
 * @returns An SVG path `d` string for the intermediate outline.
 */
export function interpolateOutline(from: MorphPoint[], to: MorphPoint[], t: number): string {
	const clamped = Math.max(0, Math.min(1, t));
	const len = Math.min(from.length, to.length);
	if (len === 0) {
		return '';
	}
	const parts: string[] = [];
	for (let i = 0; i < len; i++) {
		const x = from[i].x + (to[i].x - from[i].x) * clamped;
		const y = from[i].y + (to[i].y - from[i].y) * clamped;
		parts.push(`${i === 0 ? 'M' : 'L'}${Number(x.toFixed(2))} ${Number(y.toFixed(2))}`);
	}
	parts.push('Z');
	return parts.join(' ');
}
