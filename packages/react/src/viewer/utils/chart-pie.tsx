import type { PptxElement, PptxChartData } from 'pptx-viewer-core';
import React from 'react';

import { buildReactChartViewModel, renderChartViewModel } from './chart-view-model-render';

/**
 * Render a pie, doughnut, or 3D pie chart.
 *
 * Geometry (slice arcs, doughnut inner radius, data labels and legend layout)
 * is produced by the shared `buildChartViewModel` engine so all framework
 * bindings render identical pie geometry; React's style-id palette is threaded
 * through `buildReactChartViewModel` so only geometry, not colour, aligns.
 */
export function renderPieChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	const vm = buildReactChartViewModel(element);
	return renderChartViewModel(element.id, vm, 'xMidYMid meet');
}
