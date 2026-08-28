/**
 * `line3D`-specific entry point onto the shared cartesian line/area 3D data
 * shaping ({@link ./cartesian-line-chart-3d-data.ts}).
 *
 * @module line-chart-3d-data
 */
import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';

import type {
	CartesianLine3DDataOptions,
	CartesianLine3DSceneOptions,
} from './cartesian-line-chart-3d-data';
import { buildCartesianLine3DSceneData } from './cartesian-line-chart-3d-data';

export type LineChart3DSceneOptions = CartesianLine3DSceneOptions;
export type LineChart3DDataOptions = CartesianLine3DDataOptions;
export type { CartesianLine3DSeriesPath as LineChart3DSeriesPath } from './cartesian-line-chart-3d-layout';

/**
 * Single decision point every binding calls to decide whether a chart element
 * should mount the interactive 3D line scene: resolves the category-label
 * fallback (mirrors `buildChartViewModel`'s derivation exactly, so 2D and 3D
 * never disagree about what a category is called) and the per-series path
 * layout, in one place.
 *
 * Returns `null` when the element is not a chart, its `c:chartType` is not
 * literally `line3D` (a plain `line` chart never mounts the 3D scene), or the
 * chart has no plottable grid. A non-null result means "render the WebGL
 * scene"; `null` means "fall back to the flat SVG oblique-projection line3D
 * renderer".
 */
export function buildLineChart3DDataForElement(
	element: PptxElement,
	options: LineChart3DDataOptions,
): LineChart3DSceneOptions | null {
	if (element.type !== 'chart') {
		return null;
	}
	const chartEl = element as ChartPptxElement;
	const chartData = chartEl.chartData;
	if (!chartData || chartData.series.length === 0) {
		return null;
	}
	if (chartData.chartType !== 'line3D') {
		return null;
	}

	const longestLen = chartData.series.reduce((m, s) => Math.max(m, s.values.length), 0);
	const categoryLabels =
		chartData.categories.length > 0
			? chartData.categories
			: Array.from({ length: longestLen }, (_, i) => String(i + 1));

	return buildCartesianLine3DSceneData(chartData, categoryLabels, options);
}
