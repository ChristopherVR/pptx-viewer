/**
 * Per-series depth staggering for the `bar3D` oblique-depth pass
 * ({@link ./chart-3d-depth.ts}).
 *
 * Before this module, every series in a `bar3D` chart shared the exact same
 * depth offset: a chart with two series drew both series' extrusion at the
 * identical (dx, dy), so the second series sat in the same depth plane as
 * the first instead of receding behind it the way PowerPoint's 3D column
 * chart lays series out along a depth ("series") axis. This is the most
 * visible gap between the oblique illusion and an actual 3D projection for
 * the chart type PowerPoint authors use most.
 *
 * `computeSeriesDepth` scales the chart's base depth vector by each series'
 * position along that axis (front = smallest offset, back = the full base
 * magnitude); callers then paint the resulting per-series extrusion groups
 * back-to-front (farthest first) for correct occlusion where staggered
 * series overlap on screen.
 *
 * @module chart-bar3d-series-depth
 */
import type { DepthVector } from './chart-3d-depth';

/**
 * A series' fractional position along the depth axis, in `(0, 1]`.
 *
 * Series 0 (nearest the viewer) gets `1 / seriesCount`; the last series gets
 * `1` (the chart's full base depth magnitude). `seriesCount <= 1` returns
 * `1`, which reproduces the previous single-shared-depth behaviour exactly
 * for the common single-series `bar3D` chart, so that case does not regress.
 */
export function seriesDepthFactor(seriesIndex: number, seriesCount: number): number {
	if (seriesCount <= 1) {
		return 1;
	}
	return (seriesIndex + 1) / seriesCount;
}

/** Scale a depth vector by a fractional factor, keeping its direction. */
export function scaleDepthVector(depth: DepthVector, factor: number): DepthVector {
	return { dx: depth.dx * factor, dy: depth.dy * factor, magnitude: depth.magnitude * factor };
}

/** This series' depth offset: the base vector scaled by its position on the depth axis. */
export function computeSeriesDepth(
	depth: DepthVector,
	seriesIndex: number,
	seriesCount: number,
): DepthVector {
	return scaleDepthVector(depth, seriesDepthFactor(seriesIndex, seriesCount));
}

/**
 * Order series indexes back-to-front (farthest first) for a painter's-
 * algorithm draw order: the series with the larger depth factor recedes
 * further from the viewer, so it must be painted before (behind) a nearer
 * series' extrusion for staggered bars to occlude correctly.
 */
export function sortSeriesBackToFront(
	seriesIndexes: readonly number[],
	seriesCount: number,
): number[] {
	return [...seriesIndexes].sort(
		(a, b) => seriesDepthFactor(b, seriesCount) - seriesDepthFactor(a, seriesCount),
	);
}
