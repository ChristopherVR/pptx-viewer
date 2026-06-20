import type { PptxElement, PptxChartData } from 'pptx-viewer-core';
import React from 'react';

import { buildReactChartViewModel, renderChartViewModel } from './chart-view-model-render';

/**
 * Render an area chart (or area3D).
 *
 * Geometry, layout, chrome, log / display-unit value axes, and overlays
 * (trendlines / error bars / axis titles / data table) flow through the
 * framework-agnostic `buildChartViewModel` engine in `pptx-viewer-shared`
 * (dispatched on `chartType === 'area'` / `'area3D'`). React's style-id palette
 * is threaded in via `buildReactChartViewModel`, so only colour stays
 * React-specific; geometry is identical across React / Vue / Angular.
 *
 * The `chartData` / `categoryLabels` parameters are retained for `chart.tsx`
 * dispatcher signature stability; the shared builder derives its own.
 */
export function renderAreaChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}

/**
 * Render a line chart (or line3D).
 *
 * Geometry, layout, chrome, secondary value axis (series mapped to a right-hand
 * value axis), log / display-unit axes, and overlays flow through the
 * framework-agnostic `buildChartViewModel` engine in `pptx-viewer-shared`
 * (dispatched on `chartType === 'line'` / `'line3D'`). React's style-id palette
 * is threaded in via `buildReactChartViewModel`, so only colour stays
 * React-specific.
 *
 * The `chartData` / `categoryLabels` parameters are retained for `chart.tsx`
 * dispatcher signature stability; the shared builder derives its own.
 */
export function renderLineChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}
