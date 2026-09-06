import type { CanvasPoint } from './useLiveInkPreview';

/**
 * Build an SVG path `d` string from an array of canvas-local `{x, y}` points.
 *
 * A module-level pure function (not a `useCallback`-wrapped closure) so its
 * reference is stable across renders for free, and both `useLiveInkPreview`
 * and `finishDrawStroke` can share the one copy instead of each hand-rolling
 * it.
 *
 * - 0 points -> `''`
 * - 1 point  -> `'M x y'`
 * - N points -> `'M x0 y0 L x1 y1 L x2 y2 ...'`
 */
export function buildCanvasPathD(points: CanvasPoint[]): string {
	if (points.length === 0) {
		return '';
	}
	const parts = [`M ${points[0].x} ${points[0].y}`];
	for (let i = 1; i < points.length; i++) {
		parts.push(`L ${points[i].x} ${points[i].y}`);
	}
	return parts.join(' ');
}
