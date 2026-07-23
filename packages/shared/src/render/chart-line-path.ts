/**
 * chart-line-path.ts: bezier smoothing for line-series paths.
 *
 * OOXML line/scatter series may set `c:smooth`, which PowerPoint renders as a
 * smoothed curve through the data points rather than straight segments. This
 * helper converts a point list into an SVG path `d` string using a Catmull-Rom
 * spline expressed as cubic beziers, so every binding can render the smoothed
 * line identically.
 *
 * @module chart-line-path
 */

import type { LinePoint } from './chart-view-model';

/**
 * Build a smoothed cubic-bezier path `d` through `points` (Catmull-Rom spline).
 * Returns a straight `M…L…` fallback for fewer than three points.
 */
export function smoothLinePath(points: ReadonlyArray<LinePoint>): string {
	if (points.length === 0) {
		return '';
	}
	if (points.length === 1) {
		return `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
	}
	if (points.length === 2) {
		return `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} L${points[1].x.toFixed(2)},${points[1].y.toFixed(2)}`;
	}

	let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;
		const cp1x = p1.x + (p2.x - p0.x) / 6;
		const cp1y = p1.y + (p2.y - p0.y) / 6;
		const cp2x = p2.x - (p3.x - p1.x) / 6;
		const cp2y = p2.y - (p3.y - p1.y) / 6;
		d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
	}
	return d;
}
