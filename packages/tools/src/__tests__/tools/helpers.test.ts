import type { ChartPptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { describeElement } from '../../tools/helpers.js';

function makeChartElement(
	overrides: Partial<ChartPptxElement['chartData']> = {},
): ChartPptxElement {
	return {
		id: 'chart-0',
		type: 'chart',
		x: 50,
		y: 50,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'bar',
			categories: ['A', 'B', 'C', 'D'],
			series: [{ name: 'Defects', values: [40, 30, 20, 10] }],
			...overrides,
		},
	};
}

describe('describeElement chart type reporting', () => {
	it('reports chartType for a plain bar chart', () => {
		const described = describeElement(makeChartElement());
		expect(described.chartType).toBe('bar');
	});

	it('reports "pareto", not "histogram", for the histogram+paretoLine pareto shape', () => {
		const pareto = makeChartElement({
			chartType: 'histogram',
			series: [
				{ name: 'Defects', values: [40, 30, 20, 10] },
				{ name: 'Cumulative %', values: [40, 70, 90, 100], histogramOptions: { layout: 'pareto' } },
			],
		});
		const described = describeElement(pareto);
		expect(described.chartType).toBe('pareto');
	});

	it('does not throw when a chart element has no chartData', () => {
		const bare: ChartPptxElement = {
			id: 'chart-1',
			type: 'chart',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		};
		const described = describeElement(bare);
		expect(described.chartType).toBeUndefined();
	});
});
