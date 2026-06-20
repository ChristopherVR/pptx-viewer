import type { PptxElement, PptxChartData } from 'pptx-viewer-core';
import React from 'react';

import { buildReactChartViewModel, renderChartViewModel } from './chart-view-model-render';

/**
 * Render a stacked or 100%-stacked bar chart.
 *
 * Geometry, layout, chrome, percentStacked normalisation (each category summed
 * to 100% with in-bar percent labels), and overlays now flow through the
 * framework-agnostic `buildChartViewModel` engine in `pptx-viewer-shared`
 * (dispatched on `chartType === 'bar'` with `grouping === 'stacked'` /
 * `'percentStacked'`). React's style-id palette is threaded in via
 * `buildReactChartViewModel`, so only colour stays React-specific.
 *
 * The `chartData` / `categoryLabels` parameters are retained for `chart.tsx`
 * dispatcher signature stability; the shared builder derives its own.
 */
export function renderStackedBarChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}
