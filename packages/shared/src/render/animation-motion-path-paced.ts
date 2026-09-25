/**
 * `animation-motion-path-paced` - constant-speed travel along a sampled
 * motion path.
 *
 * `p:animMotion` moves at an even speed along the path's length (SMIL's
 * default `calcMode="paced"` for motion), not an even share of time per
 * sampled point. Measured on PowerPoint's Arc Up entrance (CreateVideo, a
 * 200 px square, 2 s): 1.3 s in, the eased progress is 0.85 and the shape
 * sits just past the end of the third of four curve segments, which ends at
 * 84% of the path's length but at 75% of its point count.
 *
 * Path coordinates are fractions of the slide's width (x) and height (y), so
 * the length is measured with x scaled by the slide aspect ratio.
 *
 * @module render/animation-motion-path-paced
 */
import type { MotionPoint } from './animation-motion-path';

/** Default slide aspect (16:9) when the caller does not know the real one. */
export const DEFAULT_SLIDE_ASPECT = 16 / 9;

/** Cumulative length fraction (0..1) at each point; all zeros for a zero-length path. */
export function pacedFractions(
	points: ReadonlyArray<MotionPoint>,
	aspect: number = DEFAULT_SLIDE_ASPECT,
): number[] {
	const lengths = [0];
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const dx = (points[i].x - points[i - 1].x) * aspect;
		const dy = points[i].y - points[i - 1].y;
		total += Math.hypot(dx, dy);
		lengths.push(total);
	}
	if (total <= 0) {
		return points.map((_, i) => (points.length > 1 ? i / (points.length - 1) : 0));
	}
	return lengths.map((length) => length / total);
}

/** The point `progress` (0..1) of the way along the path by length. */
export function pacedPointAt(
	points: ReadonlyArray<MotionPoint>,
	fractions: ReadonlyArray<number>,
	progress: number,
): MotionPoint {
	if (points.length === 0) {
		return { x: 0, y: 0 };
	}
	if (points.length === 1 || progress <= 0) {
		return points[0];
	}
	if (progress >= 1) {
		return points[points.length - 1];
	}
	let i = 1;
	while (i < points.length - 1 && fractions[i] < progress) {
		i++;
	}
	const span = fractions[i] - fractions[i - 1];
	const ratio = span > 0 ? (progress - fractions[i - 1]) / span : 1;
	return {
		x: points[i - 1].x + (points[i].x - points[i - 1].x) * ratio,
		y: points[i - 1].y + (points[i].y - points[i - 1].y) * ratio,
	};
}
