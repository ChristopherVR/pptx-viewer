/**
 * chart-pareto.test.ts: Vitest unit tests for chart-pareto.ts.
 *
 * Covers the "Pareto" display-type resolution (docs/guide/limitations.md's
 * ChartEx row): a Pareto chart is `chartType: 'histogram'` plus a
 * `paretoLine`-layout series and has no `PptxChartType` of its own, so
 * `isParetoChart`/`resolveDisplayedChartType` are what let a picker or
 * inspector show "Pareto" instead of "Histogram" once selected.
 *
 * @module shared/render/chart-pareto.test
 */

import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyParetoConversion, isParetoChart, resolveDisplayedChartType } from './chart-pareto';

function makeChart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'histogram',
		categories: ['A', 'B', 'C'],
		series: [{ name: 'Frequency', values: [3, 5, 2] }],
		...overrides,
	};
}

describe('isParetoChart', () => {
	it('is false for a plain histogram with no pareto-layout series', () => {
		expect(isParetoChart(makeChart())).toBeFalsy();
	});

	it('is false for a non-histogram chart type', () => {
		const bar = makeChart({
			chartType: 'bar',
			series: [
				{ name: 'Frequency', values: [3, 5, 2] },
				{ name: 'Cumulative %', values: [30, 80, 100], histogramOptions: { layout: 'pareto' } },
			],
		});
		expect(isParetoChart(bar)).toBeFalsy();
	});

	it('is true once the chart carries a paretoLine-layout series', () => {
		const pareto = applyParetoConversion(makeChart());
		expect(isParetoChart(pareto)).toBeTruthy();
	});
});

describe('resolveDisplayedChartType', () => {
	it('returns the raw chartType for a chart with no pareto series', () => {
		expect(resolveDisplayedChartType(makeChart())).toBe('histogram');
		expect(resolveDisplayedChartType(makeChart({ chartType: 'bar' }))).toBe('bar');
	});

	it('returns "pareto" for a histogram carrying a paretoLine-layout series, not "histogram"', () => {
		const pareto = applyParetoConversion(makeChart());
		expect(pareto.chartType).toBe('histogram');
		expect(resolveDisplayedChartType(pareto)).toBe('pareto');
	});

	it('round-trips through applyParetoConversion: selecting Pareto reads back as Pareto', () => {
		const converted = applyParetoConversion(makeChart());
		// This is the exact read-back path a Change Chart Type picker exercises:
		// convert, then re-derive what the control should show as selected.
		expect(resolveDisplayedChartType(converted)).toBe('pareto');
	});
});
