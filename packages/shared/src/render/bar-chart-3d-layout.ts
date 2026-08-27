/**
 * Box-mesh layout maths for the interactive `bar3D` scene
 * ({@link ./bar-chart-3d-data.ts}). Split out of that module to stay under the
 * repo's ~300-LOC file cap.
 *
 * Clustered layout gives every series its own depth ("Z") plane, side by
 * side along the series axis, matching PowerPoint's real 3-D Column chart.
 * Stacked/percentStacked keeps every series coplanar (one Z plane) and
 * stacks segments vertically, matching the flat engine's
 * `chart-bar3d-series-depth.ts` semantics (a stacked 3D column has no
 * per-series depth stagger; only clustered does).
 *
 * @module bar-chart-3d-layout
 */
import { computeCartesianGridExtent, MAX_VALUE_HEIGHT } from './cartesian-chart-3d-geom';
import type { ValueRange } from './chart-view-model';

/** One (series, category) data point, resolved to display value + colour. */
export interface CartesianChart3DPoint {
	seriesIndex: number;
	categoryIndex: number;
	/** Authored value, for tooltip/display. */
	value: number;
	/**
	 * Value used for box-height maths. Equals `value` except for
	 * `percentStacked`, where it is normalised to percent-of-category-total
	 * (0-100), matching the flat engine's percentStacked geometry.
	 */
	plotValue: number;
	color: string;
}

/** One box mesh: world-space center + size (width=X, height=Y, depth=Z). */
export interface BarChart3DBox {
	seriesIndex: number;
	categoryIndex: number;
	value: number;
	color: string;
	center: readonly [number, number, number];
	size: readonly [number, number, number];
}

const MIN_BOX_HEIGHT = 0.02;
const BOX_GAP = 0.15;

function normalizeToHeight(value: number, range: ValueRange): number {
	if (range.span <= 0) {
		return 0;
	}
	return ((value - range.min) / range.span) * MAX_VALUE_HEIGHT;
}

/** Clustered box layout: each series gets its own depth ("Z") plane. */
function layoutClustered(
	points: ReadonlyArray<CartesianChart3DPoint>,
	cols: number,
	rows: number,
	range: ValueRange,
	depthPercent: number | undefined,
): BarChart3DBox[] {
	const { gridWidth, gridDepth } = computeCartesianGridExtent(cols, rows, depthPercent);
	const colStep = gridWidth / cols;
	const rowStep = gridDepth / Math.max(rows, 1);
	const boxW = colStep * (1 - BOX_GAP);
	const boxD = rowStep * (1 - BOX_GAP);
	const zeroH = normalizeToHeight(0, range);

	return points.map((p) => {
		const valueH = normalizeToHeight(p.plotValue, range);
		const top = Math.max(valueH, zeroH);
		const bottom = Math.min(valueH, zeroH);
		const h = Math.max(top - bottom, MIN_BOX_HEIGHT);
		const x = -gridWidth / 2 + colStep * (p.categoryIndex + 0.5);
		const z = -gridDepth / 2 + rowStep * (p.seriesIndex + 0.5);
		return {
			seriesIndex: p.seriesIndex,
			categoryIndex: p.categoryIndex,
			value: p.value,
			color: p.color,
			center: [x, bottom + h / 2, z],
			size: [boxW, h, boxD],
		};
	});
}

/** Stacked/percentStacked box layout: one coplanar depth plane, vertical stack. */
function layoutStacked(
	points: ReadonlyArray<CartesianChart3DPoint>,
	cols: number,
	rows: number,
	range: ValueRange,
	depthPercent: number | undefined,
): BarChart3DBox[] {
	const { gridWidth, gridDepth } = computeCartesianGridExtent(cols, rows, depthPercent);
	const colStep = gridWidth / cols;
	const boxW = colStep * (1 - BOX_GAP);
	const boxD = gridDepth * (1 - BOX_GAP);
	const boxes: BarChart3DBox[] = [];

	for (let ci = 0; ci < cols; ci++) {
		const x = -gridWidth / 2 + colStep * (ci + 0.5);
		let posRunning = 0;
		let negRunning = 0;
		const catPoints = points
			.filter((p) => p.categoryIndex === ci)
			.sort((a, b) => a.seriesIndex - b.seriesIndex);
		for (const p of catPoints) {
			const isNeg = p.plotValue < 0;
			const base = isNeg ? negRunning : posRunning;
			const top = base + p.plotValue;
			if (isNeg) {
				negRunning = top;
			} else {
				posRunning = top;
			}
			const baseH = normalizeToHeight(base, range);
			const topH = normalizeToHeight(top, range);
			const h = Math.max(Math.abs(topH - baseH), MIN_BOX_HEIGHT);
			boxes.push({
				seriesIndex: p.seriesIndex,
				categoryIndex: p.categoryIndex,
				value: p.value,
				color: p.color,
				center: [x, Math.min(baseH, topH) + h / 2, 0],
				size: [boxW, h, boxD],
			});
		}
	}
	return boxes;
}

/**
 * Build the box-mesh layout for a resolved grouping: clustered gives every
 * series its own depth plane; stacked/percentStacked keeps them coplanar and
 * stacks vertically (percentStacked's `plotValue`s are pre-normalised to
 * percent by the caller, so this function treats it identically to `stacked`).
 */
export function layoutBarChart3D(
	points: ReadonlyArray<CartesianChart3DPoint>,
	cols: number,
	rows: number,
	range: ValueRange,
	grouping: 'clustered' | 'stacked' | 'percentStacked',
	depthPercent: number | undefined,
): BarChart3DBox[] {
	return grouping === 'clustered'
		? layoutClustered(points, cols, rows, range, depthPercent)
		: layoutStacked(points, cols, rows, range, depthPercent);
}
