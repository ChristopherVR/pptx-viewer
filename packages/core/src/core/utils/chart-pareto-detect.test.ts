import { describe, expect, it } from 'vitest';

import type { PptxChartData } from '../types/chart';
import { isParetoChartData, resolveDisplayedChartTypeName } from './chart-pareto-detect';

function makeChart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'histogram',
		categories: ['A', 'B', 'C'],
		series: [{ name: 'Frequency', values: [3, 5, 2] }],
		...overrides,
	};
}

describe('isParetoChartData', () => {
	it('is false for a plain histogram with no pareto-layout series', () => {
		expect(isParetoChartData(makeChart())).toBeFalsy();
	});

	it('is false for a non-histogram chart type', () => {
		const bar = makeChart({
			chartType: 'bar',
			series: [
				{ name: 'Frequency', values: [3, 5, 2] },
				{ name: 'Cumulative %', values: [30, 80, 100], histogramOptions: { layout: 'pareto' } },
			],
		});
		expect(isParetoChartData(bar)).toBeFalsy();
	});

	it('is true for a histogram carrying a paretoLine-layout series', () => {
		const pareto = makeChart({
			series: [
				{ name: 'Frequency', values: [3, 5, 2] },
				{ name: 'Cumulative %', values: [30, 80, 100], histogramOptions: { layout: 'pareto' } },
			],
		});
		expect(isParetoChartData(pareto)).toBeTruthy();
	});
});

describe('resolveDisplayedChartTypeName', () => {
	it('returns the raw chartType for a chart with no pareto series', () => {
		expect(resolveDisplayedChartTypeName(makeChart())).toBe('histogram');
		expect(resolveDisplayedChartTypeName(makeChart({ chartType: 'bar' }))).toBe('bar');
	});

	it('returns "pareto" for a histogram carrying a paretoLine-layout series, not "histogram"', () => {
		const pareto = makeChart({
			series: [
				{ name: 'Frequency', values: [3, 5, 2] },
				{ name: 'Cumulative %', values: [30, 80, 100], histogramOptions: { layout: 'pareto' } },
			],
		});
		expect(pareto.chartType).toBe('histogram');
		expect(resolveDisplayedChartTypeName(pareto)).toBe('pareto');
	});
});
