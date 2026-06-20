import type { PptxElement, PptxChartData } from 'pptx-viewer-core';
import React from 'react';

import { buildReactChartViewModel, renderChartViewModel } from './chart-view-model-render';

/**
 * Render a radar / spider chart.
 *
 * Ring/spoke gridlines, perimeter category labels, per-series polygons + vertex
 * dots, data labels and the legend are all produced by the shared
 * `buildChartViewModel` engine so every framework binding renders identical
 * radar geometry. React's style-id palette is threaded through
 * `buildReactChartViewModel`, so only geometry, not colour, aligns.
 */
export function renderRadarChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	const vm = buildReactChartViewModel(element);
	return renderChartViewModel(element.id, vm, 'xMidYMid meet');
}
