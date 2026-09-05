import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { buildChartViewModel } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { renderChartViewModelSvg } from './chart-svg';

/**
 * W4-D: a chart title with typed rich-text runs (`titleRuns`) draws one
 * <tspan> per run instead of collapsing to a single flat text node, through
 * the real shared `buildChartViewModel` pipeline.
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

describe('renderChartViewModelSvg: chart title rich text (titleRunSpans)', () => {
	it('renders one <tspan> per titleRunSpans entry with its own style', () => {
		const element = chartElement({
			chartType: 'bar',
			title: 'Sales Q1',
			categories: ['Q1'],
			series: [{ name: 'Revenue', values: [10] }],
			style: { hasTitle: true },
			titleRuns: [
				{ text: 'Sales ', bold: true },
				{ text: 'Q1', italic: true, color: '#FF0000' },
			],
		});
		const vm = buildChartViewModel(element);
		const svg = renderChartViewModelSvg(document, vm, 'none');
		const tspans = Array.from(svg.querySelectorAll('tspan'));
		expect(tspans).toHaveLength(2);
		expect(tspans[0].textContent).toBe('Sales ');
		expect(tspans[1].textContent).toBe('Q1');
		expect(tspans[1].getAttribute('font-style')).toBe('italic');
	});

	it('falls back to a flat text node when the title has no typed runs', () => {
		const element = chartElement({
			chartType: 'bar',
			title: 'Sales',
			categories: ['Q1'],
			series: [{ name: 'Revenue', values: [10] }],
			style: { hasTitle: true },
		});
		const vm = buildChartViewModel(element);
		const svg = renderChartViewModelSvg(document, vm, 'none');
		expect(svg.querySelectorAll('tspan')).toHaveLength(0);
		const titleText = svg.querySelector('[data-chart-part="title"]');
		expect(titleText?.textContent).toBe('Sales');
	});
});
