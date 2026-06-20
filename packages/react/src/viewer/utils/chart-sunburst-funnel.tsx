import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import React from 'react';

import { buildReactChartViewModel, renderChartViewModel } from './chart-view-model-render';

/**
 * Render a sunburst chart: concentric ring arcs.
 *
 * Geometry, layout and palette now flow through the framework-agnostic
 * `buildSunburstViewModel` engine in `pptx-viewer-shared` (dispatched by
 * `buildChartViewModel` on `chartType === 'sunburst'`). React's style-id palette
 * is threaded in via `buildReactChartViewModel`, then the resulting view-model
 * is projected with the shared React projector. The `chartData` / `categoryLabels`
 * parameters are retained for signature stability with the `chart.tsx` dispatcher;
 * the shared builder derives its own category labels from `element.chartData`.
 */
export function renderSunburstChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}

/**
 * Render a funnel chart: descending trapezoids.
 *
 * Geometry, layout and palette now flow through the framework-agnostic
 * `buildFunnelViewModel` engine in `pptx-viewer-shared` (dispatched by
 * `buildChartViewModel` on `chartType === 'funnel'`). React's style-id palette is
 * threaded in via `buildReactChartViewModel`, then the resulting view-model is
 * projected with the shared React projector.
 */
export function renderFunnelChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}
