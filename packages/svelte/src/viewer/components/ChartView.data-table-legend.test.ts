import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ChartView from './ChartView.svelte';

/**
 * Regression tests: c:dTable data table (gap 1) and c:legendEntry deletion
 * (gap 2), verified through the real rendered Svelte DOM (not a hand-built
 * ChartViewModel), so they prove the whole shared pipeline (core parse ->
 * chart-view-model -> chart-data-table-render / chart-legend-entries) reaches
 * Svelte's actual output.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ChartView, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 0 },
	});
	flushSync();
	return target;
}

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

describe('chartView: c:dTable data table', () => {
	it('renders the data table grid below the plot, including the series key text', () => {
		const target = render(
			chartElement({
				chartType: 'bar',
				categories: ['Q1', 'Q2'],
				series: [{ name: 'Revenue', values: [100, 150] }],
				dataTable: { showKeys: true, showOutline: true },
			}),
		);
		const labels = Array.from(target.querySelectorAll('text')).map((t) => t.textContent);
		expect(labels).toContain('Revenue');
		expect(labels).toContain('Q1');
	});
});

describe('chartView: c:legendEntry deletion', () => {
	it('omits a deleted series from the rendered legend', () => {
		const target = render(
			chartElement({
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
			}),
		);
		const legendLabels = Array.from(
			target.querySelectorAll('.pptx-svelte-chart-legend-item text'),
		).map((t) => t.textContent);
		expect(legendLabels).toContain('Revenue');
		expect(legendLabels).not.toContain('Cost');
	});
});
