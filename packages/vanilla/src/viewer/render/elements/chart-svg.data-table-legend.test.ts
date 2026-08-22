import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { buildChartViewModel } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { renderChartViewModelSvg } from './chart-svg';

/**
 * Regression tests: c:dTable data table (gap 1) and c:legendEntry deletion
 * (gap 2). Unlike a hand-built `ChartViewModel` fixture, these run a real
 * chart element through the shared `buildChartViewModel` first, so they
 * prove the whole shared pipeline (core parse -> chart-view-model ->
 * chart-data-table-render / chart-legend-entries) reaches vanilla's rendered
 * SVG DOM.
 */

function chartElement(chartData: PptxChartData): PptxElement {
	return {
		id: 'el-chart',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as PptxElement;
}

describe('renderChartViewModelSvg: c:dTable data table', () => {
	it('renders the data table grid below the plot, including the series key text', () => {
		const element = chartElement({
			chartType: 'bar',
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [100, 150] }],
			dataTable: { showKeys: true, showOutline: true },
		});
		const vm = buildChartViewModel(element);
		const svg = renderChartViewModelSvg(document, vm, 'none');
		const labels = Array.from(svg.querySelectorAll('text')).map((t) => t.textContent);
		expect(labels).toContain('Revenue');
		expect(labels).toContain('Q1');
	});
});

describe('renderChartViewModelSvg: c:legendEntry deletion', () => {
	it('omits a deleted series from the rendered legend', () => {
		const element = chartElement({
			chartType: 'bar',
			categories: ['Q1'],
			series: [
				{ name: 'Revenue', values: [100] },
				{ name: 'Cost', values: [80] },
			],
			style: {
				hasLegend: true,
				legendPosition: 'b',
				legendEntries: [{ index: 1, deleted: true }],
			},
		});
		const vm = buildChartViewModel(element);
		const svg = renderChartViewModelSvg(document, vm, 'none');
		const legendLabels = Array.from(svg.querySelectorAll('.pptxv-chart-legend-item text')).map(
			(t) => t.textContent,
		);
		expect(legendLabels).toContain('Revenue');
		expect(legendLabels).not.toContain('Cost');
	});
});
