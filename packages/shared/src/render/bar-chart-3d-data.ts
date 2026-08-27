/**
 * Adapts a `bar3D` chart's `PptxChartData` into the box-mesh layout the
 * interactive 3D scene ({@link ./bar-chart-3d-scene.ts}, `mountBarChart3D`)
 * needs to mount: one {@link BarChart3DBox} per (series, category) data point,
 * positioned in true 3D space (category = X, value = Y, series = Z/depth).
 *
 * Colour resolution (`seriesColor` / `resolveDataPointFill`) and value-range
 * maths (`computeValueRange` / `computeStackedValueRange`) are the SAME
 * functions the flat SVG oblique-projection engine uses
 * ({@link ./chart-cartesian-bars.ts}), so a bar3D chart's true-3D and 2D-
 * fallback presentations always agree on colour and scale: one set of chart
 * maths, two presentations (mirrors {@link ./surface-chart-3d-data.ts}).
 *
 * Clustered layout gives every series its own depth ("Z") plane, side by
 * side along the series axis, matching PowerPoint's real 3-D Column chart.
 * Stacked/percentStacked keeps every series coplanar (one Z plane) and
 * stacks segments vertically, matching the flat engine's
 * `chart-bar3d-series-depth.ts` semantics (a stacked 3D column has no
 * per-series depth stagger; only clustered does).
 *
 * @module bar-chart-3d-data
 */
import type {
	ChartPptxElement,
	PptxChartData,
	PptxChartSeries,
	PptxElement,
} from 'pptx-viewer-core';

import type { BarChart3DBox, CartesianChart3DPoint } from './bar-chart-3d-layout';
import { layoutBarChart3D } from './bar-chart-3d-layout';
import type { CartesianCameraView3D } from './cartesian-chart-3d-geom';
import { resolveChart3DWallColors } from './chart-3d-surfaces';
import { resolveDataPointFill } from './chart-datapoint-style';
import {
	computeStackedValueRange,
	computeValueRange,
	paletteColor,
	seriesColor,
} from './chart-view-model';
import type { ValueRange } from './chart-view-model';
import type { SurfaceWallColors } from './surface-chart-3d-walls';

export type { BarChart3DBox, CartesianChart3DPoint };

/** Inputs the interactive bar3D scene needs to mount. */
export interface BarChart3DSceneOptions {
	cols: number;
	rows: number;
	boxes: BarChart3DBox[];
	categoryLabels: ReadonlyArray<string>;
	seriesNames: ReadonlyArray<string>;
	numberFormats?: ReadonlyArray<string | undefined>;
	grouping: 'clustered' | 'stacked' | 'percentStacked';
	width: number;
	height: number;
	/** Authored `c:view3D` driving the initial camera + depth extent. */
	view3D?: CartesianCameraView3D;
	/** Authored `c:floor`/`c:sideWall`/`c:backWall` fill colours, when set. */
	wallColors?: SurfaceWallColors;
}

export interface BarChart3DDataOptions {
	width: number;
	height: number;
}

/** Per-category sum of absolute values, for percentStacked normalisation. */
function categoryTotals(series: ReadonlyArray<PptxChartSeries>, catCount: number): number[] {
	return Array.from({ length: catCount }, (_, ci) =>
		series.reduce((sum, s) => sum + Math.abs(s.values[ci] ?? 0), 0),
	);
}

/** Build the resolved (value + colour) grid points, row-major (series x category). */
function buildPoints(
	chartData: PptxChartData,
	catCount: number,
	isPercent: boolean,
): CartesianChart3DPoint[] {
	const series = chartData.series;
	const palette = chartData.colorPalette;
	const totals = isPercent ? categoryTotals(series, catCount) : undefined;
	const points: CartesianChart3DPoint[] = [];
	for (let si = 0; si < series.length; si++) {
		const baseColor = seriesColor(series[si], si, palette);
		for (let ci = 0; ci < catCount; ci++) {
			const value = series[si].values[ci] ?? 0;
			const color = resolveDataPointFill(series[si], ci, paletteColor(si, palette)) ?? baseColor;
			const catTotal = totals?.[ci];
			const plotValue =
				isPercent && catTotal !== undefined && catTotal > 0 ? (value / catTotal) * 100 : value;
			points.push({ seriesIndex: si, categoryIndex: ci, value, plotValue, color });
		}
	}
	return points;
}

/**
 * Build the {@link BarChart3DSceneOptions} `mountBarChart3D` needs, or `null`
 * when the chart has no plottable grid (no series, or every series has zero
 * categories).
 */
export function buildBarChart3DData(
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	options: BarChart3DDataOptions,
): BarChart3DSceneOptions | null {
	const rows = chartData.series.length;
	const cols = categoryLabels.length;
	if (rows === 0 || cols === 0) {
		return null;
	}

	const grouping: 'clustered' | 'stacked' | 'percentStacked' =
		chartData.grouping === 'stacked' || chartData.grouping === 'percentStacked'
			? chartData.grouping
			: 'clustered';
	const isPercent = grouping === 'percentStacked';

	const points = buildPoints(chartData, cols, isPercent);
	const range: ValueRange = isPercent
		? { min: 0, max: 100, span: 100 }
		: grouping === 'stacked'
			? computeStackedValueRange(chartData.series, cols)
			: computeValueRange(chartData.series);

	const depthPercent = chartData.view3D?.depthPercent;
	const boxes = layoutBarChart3D(points, cols, rows, range, grouping, depthPercent);

	return {
		cols,
		rows,
		boxes,
		categoryLabels,
		seriesNames: chartData.series.map((s) => s.name),
		numberFormats: chartData.series.map((s) => s.numberFormat),
		grouping,
		width: options.width,
		height: options.height,
		view3D: chartData.view3D
			? {
					rotX: chartData.view3D.rotX,
					rotY: chartData.view3D.rotY,
					rperspective: chartData.view3D.perspective,
					depthPercent: chartData.view3D.depthPercent,
					rAngAx: chartData.view3D.rAngAx,
				}
			: undefined,
		wallColors: resolveChart3DWallColors(chartData),
	};
}

/**
 * Single decision point every binding calls to decide whether a chart element
 * should mount the interactive 3D bar scene: resolves the category-label
 * fallback (mirrors `buildChartViewModel`'s derivation exactly, so 2D and 3D
 * never disagree about what a category is called) and the box layout, in one
 * place.
 *
 * Returns `null` when the element is not a chart, its `c:chartType` is not
 * literally `bar3D` (a plain `bar` chart never mounts the 3D scene, even
 * though `resolveChartKind` folds both onto the same 'bar' kind), the chart
 * is authored as a horizontal 3-D Bar (`c:barDir="bar"`, not yet supported by
 * the true-3D mesh path), or the chart has no plottable grid. A non-null
 * result means "render the WebGL scene"; `null` means "fall back to the flat
 * SVG oblique-projection bar3D renderer".
 */
export function buildBarChart3DDataForElement(
	element: PptxElement,
	options: BarChart3DDataOptions,
): BarChart3DSceneOptions | null {
	if (element.type !== 'chart') {
		return null;
	}
	const chartEl = element as ChartPptxElement;
	const chartData = chartEl.chartData;
	if (!chartData || chartData.series.length === 0) {
		return null;
	}
	if (chartData.chartType !== 'bar3D' || chartData.barDirection === 'bar') {
		return null;
	}

	const longestLen = chartData.series.reduce((m, s) => Math.max(m, s.values.length), 0);
	const categoryLabels =
		chartData.categories.length > 0
			? chartData.categories
			: Array.from({ length: longestLen }, (_, i) => String(i + 1));

	return buildBarChart3DData(chartData, categoryLabels, options);
}
