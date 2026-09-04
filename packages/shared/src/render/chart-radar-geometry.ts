/**
 * chart-radar-geometry.ts: radar (spider) chart polar-coordinate geometry,
 * split out of `chart-view-model-points.ts` to keep that file within the
 * repo's ~300-LOC limit. Re-exported from there (and from `chart-view-model.ts`)
 * so the public import surface is unchanged.
 *
 * @module chart-radar-geometry
 */

/** Angle (radians) of the i-th radar spoke; 0 points up (-90°), clockwise. */
export function radarAngle(index: number, catCount: number): number {
	const n = Math.max(catCount, 1);
	return (Math.PI * 2 * index) / n - Math.PI / 2;
}

export interface RadarPoint {
	x: number;
	y: number;
}

/** Project a series' values onto radar (polar) coordinates around (cx, cy). */
export function computeRadarPoints(
	values: ReadonlyArray<number>,
	maxVal: number,
	radius: number,
	cx: number,
	cy: number,
	catCount: number,
): RadarPoint[] {
	const denom = maxVal > 0 ? maxVal : 1;
	return values.slice(0, Math.max(catCount, 1)).map((val, i) => {
		const angle = radarAngle(i, catCount),
			r = (Math.abs(val) / denom) * radius;
		return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
	});
}

/** Points string for a radar gridline ring at radius `rr`. */
export function radarRingPoints(cx: number, cy: number, rr: number, catCount: number): string {
	const n = Math.max(catCount, 1);
	return Array.from({ length: n }, (_, i) => {
		const angle = radarAngle(i, n);
		return `${(cx + rr * Math.cos(angle)).toFixed(2)},${(cy + rr * Math.sin(angle)).toFixed(2)}`;
	}).join(' ');
}
