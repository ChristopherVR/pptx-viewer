/**
 * `area3D`-specific entry point onto the shared cartesian line/area 3D data
 * shaping ({@link ./cartesian-line-chart-3d-data.ts}).
 *
 * @module area-chart-3d-data
 */
import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';

import type {
	CartesianLine3DDataOptions,
	CartesianLine3DSceneOptions,
} from './cartesian-line-chart-3d-data';
import { buildCartesianLine3DSceneData } from './cartesian-line-chart-3d-data';

export type AreaChart3DSceneOptions = CartesianLine3DSceneOptions;
export type AreaChart3DDataOptions = CartesianLine3DDataOptions;
export type { CartesianLine3DSeriesPath as AreaChart3DSeriesPath } from './cartesian-line-chart-3d-layout';

/**
 * Single decision point every binding calls to decide whether a chart element
 * should mount the interactive 3D area scene. Mirrors
 * {@link ./line-chart-3d-data.ts}'s `buildLineChart3DDataForElement} exactly,
 * gated on `c:chartType === 'area3D'` instead.
 *
 * Returns `null` when the element is not a chart, its `c:chartType` is not
 * literally `area3D`, or the chart has no plottable grid. A non-null result
 * means "render the WebGL scene"; `null` means "fall back to the flat SVG
 * oblique-projection area3D renderer".
 */
export function buildAreaChart3DDataForElement(
	element: PptxElement,
	options: AreaChart3DDataOptions,
): AreaChart3DSceneOptions | null {
	if (element.type !== 'chart') {
		return null;
	}
	const chartEl = element as ChartPptxElement;
	const chartData = chartEl.chartData;
	if (!chartData || chartData.series.length === 0) {
		return null;
	}
	if (chartData.chartType !== 'area3D') {
		return null;
	}

	const longestLen = chartData.series.reduce((m, s) => Math.max(m, s.values.length), 0);
	const categoryLabels =
		chartData.categories.length > 0
			? chartData.categories
			: Array.from({ length: longestLen }, (_, i) => String(i + 1));

	return buildCartesianLine3DSceneData(chartData, categoryLabels, options);
}
