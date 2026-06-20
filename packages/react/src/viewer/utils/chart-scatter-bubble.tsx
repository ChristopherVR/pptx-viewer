import type { PptxElement, PptxChartData } from 'pptx-viewer-core';
import React from 'react';

import { buildReactChartViewModel, renderChartViewModel } from './chart-view-model-render';

/**
 * Render a scatter (XY) chart.
 *
 * Geometry, layout, chrome (gridlines / value axis / zero line / legend), and
 * overlays flow through the framework-agnostic `buildChartViewModel` engine in
 * `pptx-viewer-shared` (dispatched on `chartType === 'scatter'`). React's
 * style-id palette is threaded in via `buildReactChartViewModel`, so only colour
 * stays React-specific; geometry is identical across React / Vue / Angular.
 *
 * The `chartData` / `categoryLabels` parameters are retained for `chart.tsx`
 * dispatcher signature stability; the shared builder derives its own.
 */
export function renderScatterChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}

/**
 * Render a bubble chart.
 *
 * Geometry (first two series as points, a third as bubble size), layout, chrome,
 * and overlays flow through the framework-agnostic `buildChartViewModel` engine
 * in `pptx-viewer-shared` (dispatched on `chartType === 'bubble'`). React's
 * style-id palette is threaded in via `buildReactChartViewModel`.
 *
 * Note: the shared engine fills bubbles with no stroke outline (its `SvgCircle`
 * primitive carries no stroke), so converging drops the thin same-colour outline
 * the bespoke React renderer drew. Angular already renders bubbles strokeless via
 * the same engine, so this aligns all three frameworks.
 *
 * The `chartData` / `categoryLabels` parameters are retained for `chart.tsx`
 * dispatcher signature stability; the shared builder derives its own.
 */
export function renderBubbleChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}
