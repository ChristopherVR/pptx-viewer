/**
 * Shared point/series data-shaping for the interactive `line3D` and `area3D`
 * true-3D scenes ({@link ./line-chart-3d-data.ts}, {@link ./area-chart-3d-data.ts}).
 *
 * Both chart kinds share IDENTICAL per-series depth-plane geometry (see
 * {@link ./cartesian-line-chart-3d-layout.ts}): the only difference is
 * presentation, line3D draws a tube along each series' path, area3D
 * additionally fills a ribbon from that path down to its baseline. Colour
 * resolution (`seriesColor` / `resolveDataPointFill`) and value-range maths
 * (`computeValueRange`) are the SAME functions the flat SVG oblique-projection
 * engine uses ({@link ./chart-cartesian-line-area.ts}), so a chart's true-3D
 * and 2D-fallback presentations always agree on colour and scale (mirrors
 * {@link ./bar-chart-3d-data.ts}).
 *
 * @module cartesian-line-chart-3d-data
 */
import type { PptxChartData } from 'pptx-viewer-core';

import type { CartesianCameraView3D } from './cartesian-chart-3d-geom';
import type {
	CartesianLine3DPoint,
	CartesianLine3DSeriesPath,
} from './cartesian-line-chart-3d-layout';
import { layoutCartesianLine3DSeries } from './cartesian-line-chart-3d-layout';
import { resolveChart3DWallColors } from './chart-3d-surfaces';
import { resolveDataPointFill } from './chart-datapoint-style';
import { computeValueRange, paletteColor, seriesColor } from './chart-view-model';
import type { SurfaceWallColors } from './surface-chart-3d-walls';

export type {
	CartesianLine3DSeriesPath,
	CartesianLine3DVertex,
} from './cartesian-line-chart-3d-layout';

/** Inputs the interactive line3D/area3D scene needs to mount. */
export interface CartesianLine3DSceneOptions {
	cols: number;
	rows: number;
	series: CartesianLine3DSeriesPath[];
	categoryLabels: ReadonlyArray<string>;
	seriesNames: ReadonlyArray<string>;
	numberFormats?: ReadonlyArray<string | undefined>;
	width: number;
	height: number;
	/** Authored `c:view3D` driving the initial camera + depth extent. */
	view3D?: CartesianCameraView3D;
	/** Authored `c:floor`/`c:sideWall`/`c:backWall` fill colours, when set. */
	wallColors?: SurfaceWallColors;
}

export interface CartesianLine3DDataOptions {
	width: number;
	height: number;
}

/** Build the resolved (value + colour) points, row-major (series x category). */
function buildPoints(chartData: PptxChartData, catCount: number): CartesianLine3DPoint[] {
	const series = chartData.series;
	const palette = chartData.colorPalette;
	const points: CartesianLine3DPoint[] = [];
	for (let si = 0; si < series.length; si++) {
		const baseColor = seriesColor(series[si], si, palette);
		for (let ci = 0; ci < catCount; ci++) {
			const value = series[si].values[ci] ?? 0;
			const color = resolveDataPointFill(series[si], ci, paletteColor(si, palette)) ?? baseColor;
			points.push({ seriesIndex: si, categoryIndex: ci, value, color });
		}
	}
	return points;
}

/**
 * Build the {@link CartesianLine3DSceneOptions} `mountLineChart3D`/
 * `mountAreaChart3D` need, or `null` when the chart has no plottable grid (no
 * series, or every series has zero categories). Chart-type-agnostic: the
 * caller (`buildLineChart3DDataForElement` / `buildAreaChart3DDataForElement`)
 * is the one that gates on the authored `c:chartType`.
 */
export function buildCartesianLine3DSceneData(
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	options: CartesianLine3DDataOptions,
): CartesianLine3DSceneOptions | null {
	const rows = chartData.series.length;
	const cols = categoryLabels.length;
	if (rows === 0 || cols === 0) {
		return null;
	}

	const points = buildPoints(chartData, cols);
	const range = computeValueRange(chartData.series);
	const depthPercent = chartData.view3D?.depthPercent;
	const series = layoutCartesianLine3DSeries(points, cols, rows, range, depthPercent);

	return {
		cols,
		rows,
		series,
		categoryLabels,
		seriesNames: chartData.series.map((s) => s.name),
		numberFormats: chartData.series.map((s) => s.numberFormat),
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
