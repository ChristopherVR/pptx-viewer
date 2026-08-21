import type { ChartPptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { applyParetoChartTypeAlias } from '../../tools/chart-pareto.js';

function makeChart(values: number[]): ChartPptxElement {
	return {
		id: 'chart-0',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'bar',
			categories: values.map((_, i) => `Cat ${i + 1}`),
			series: [{ name: 'Defects', values }],
		},
	} as ChartPptxElement;
}

describe('applyParetoChartTypeAlias', () => {
	it('no-ops for a non-pareto requested type', () => {
		const chart = makeChart([10, 20]);
		applyParetoChartTypeAlias(chart, 'bar');
		expect(chart.chartData?.chartType).toBe('bar');
		expect(chart.chartData?.series).toHaveLength(1);
	});

	it('converts a "pareto" request into histogram + computed cumulative-percent series', () => {
		const chart = makeChart([50, 30, 15, 5]);
		applyParetoChartTypeAlias(chart, 'pareto');

		expect(chart.chartData?.chartType).toBe('histogram');
		expect(chart.chartData?.series).toHaveLength(2);

		const [frequency, cumulative] = chart.chartData!.series;
		expect(frequency.histogramOptions?.layout).toBe('histogram');
		expect(frequency.values).toStrictEqual([50, 30, 15, 5]);

		expect(cumulative.name).toBe('Cumulative %');
		expect(cumulative.histogramOptions?.layout).toBe('pareto');
		expect(cumulative.values).toStrictEqual([50, 80, 95, 100]);
	});

	it('is case-insensitive and tolerates surrounding whitespace', () => {
		const chart = makeChart([1, 1]);
		applyParetoChartTypeAlias(chart, '  Pareto  ');
		expect(chart.chartData?.chartType).toBe('histogram');
	});

	it('does not duplicate the cumulative series when applied twice', () => {
		const chart = makeChart([4, 4, 2]);
		applyParetoChartTypeAlias(chart, 'pareto');
		applyParetoChartTypeAlias(chart, 'pareto');
		expect(chart.chartData?.series).toHaveLength(2);
	});

	it('handles an all-zero series without dividing by zero', () => {
		const chart = makeChart([0, 0, 0]);
		applyParetoChartTypeAlias(chart, 'pareto');
		const [, cumulative] = chart.chartData!.series;
		expect(cumulative.values).toStrictEqual([0, 0, 0]);
	});
});
