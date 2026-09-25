/**
 * Plain polygon types for the Merge Shapes boolean engine.
 *
 * A region is a list of closed loops read with the even-odd rule on input.
 * Every region the engine RETURNS is additionally oriented so its inside lies
 * to the left of each edge (outer loops have positive signed area, holes
 * negative), which makes even-odd and non-zero fills agree on it.
 *
 * @module render/merge-shapes/polygon-types
 */

/** A 2D point in slide pixels. */
export interface PolygonPoint {
	x: number;
	y: number;
}

/** One closed loop; the closing edge back to the first point is implicit. */
export type PolygonLoop = PolygonPoint[];

/** A filled area: a set of loops (outer boundaries and holes). */
export type PolygonRegion = PolygonLoop[];

/** Shoelace signed area; positive when the inside is on the left of each edge. */
export function signedLoopArea(loop: readonly PolygonPoint[]): number {
	let area = 0;
	for (let i = 0; i < loop.length; i++) {
		const a = loop[i];
		const b = loop[(i + 1) % loop.length];
		area += a.x * b.y - b.x * a.y;
	}
	return area / 2;
}

/** Even-odd point-in-region test (ray casting against every loop). */
export function isPointInRegion(p: PolygonPoint, loops: readonly PolygonLoop[]): boolean {
	let inside = false;
	for (const loop of loops) {
		for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
			const a = loop[i];
			const b = loop[j];
			if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
				inside = !inside;
			}
		}
	}
	return inside;
}

/** Axis-aligned bounds of a set of loops, or null when there are no points. */
export function polygonRegionBounds(
	loops: readonly PolygonLoop[],
): { x: number; y: number; width: number; height: number } | null {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const loop of loops) {
		for (const p of loop) {
			minX = Math.min(minX, p.x);
			minY = Math.min(minY, p.y);
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}
	}
	if (!Number.isFinite(minX)) {
		return null;
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
