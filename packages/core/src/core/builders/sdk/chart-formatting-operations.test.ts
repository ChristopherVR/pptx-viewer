import { describe, it, expect } from 'vitest';

import type { PptxChartType } from '../../types/chart';
import type { ChartPptxElement } from '../../types/elements';
import {
	setChartDataPointStyle,
	setChartHelperLine,
	setChartColorMapOverride,
} from './chart-formatting-operations';
import { createChartElement } from './ElementFactory';

function makeChart(chartType: PptxChartType = 'line'): ChartPptxElement {
	return createChartElement(chartType, {
		series: [{ name: 'Revenue', values: [100, 200, 300] }],
		categories: ['Q1', 'Q2', 'Q3'],
	});
}

describe('setChartDataPointStyle', () => {
	it('sets full shape formatting (fill + stroke width + dash) on a point', () => {
		const chart = makeChart();
		setChartDataPointStyle(chart, 0, 1, {
			fillColor: '#112233',
			strokeColor: '#445566',
			strokeWidth: 2,
			strokeDashStyle: 'dash',
		});
		const dp = chart.chartData!.series[0].dataPoints?.find((p) => p.idx === 1);
		expect(dp?.spPr).toStrictEqual({
			fillColor: '#112233',
			strokeColor: '#445566',
			strokeWidth: 2,
			strokeDashStyle: 'dash',
		});
	});

	it('merges into an existing style rather than replacing it wholesale', () => {
		const chart = makeChart();
		setChartDataPointStyle(chart, 0, 0, { fillColor: '#111111' });
		setChartDataPointStyle(chart, 0, 0, { strokeColor: '#222222' });
		const dp = chart.chartData!.series[0].dataPoints?.find((p) => p.idx === 0);
		expect(dp?.spPr).toStrictEqual({ fillColor: '#111111', strokeColor: '#222222' });
	});

	it('clears the style and drops the c:dPt override when nothing else is set', () => {
		const chart = makeChart();
		setChartDataPointStyle(chart, 0, 0, { fillColor: '#111111' });
		setChartDataPointStyle(chart, 0, 0, null);
		expect(chart.chartData!.series[0].dataPoints).toBeUndefined();
	});

	it('throws for an out-of-range series index', () => {
		const chart = makeChart();
		expect(() => setChartDataPointStyle(chart, 5, 0, { fillColor: '#fff' })).toThrow();
	});
});

describe('setChartHelperLine', () => {
	it('sets dropLines and hiLowLines on a line chart', () => {
		const chart = makeChart('line');
		setChartHelperLine(chart, 'dropLines', { color: '#AAAAAA', width: 0.75 });
		setChartHelperLine(chart, 'hiLowLines', { color: '#BBBBBB', dashStyle: 'dot' });
		expect(chart.chartData!.dropLines).toStrictEqual({ color: '#AAAAAA', width: 0.75 });
		expect(chart.chartData!.hiLowLines).toStrictEqual({ color: '#BBBBBB', dashStyle: 'dot' });
	});

	it('removes an existing helper line when passed null', () => {
		const chart = makeChart('stock');
		setChartHelperLine(chart, 'hiLowLines', { color: '#BBBBBB' });
		setChartHelperLine(chart, 'hiLowLines', null);
		expect(chart.chartData!.hiLowLines).toBeNull();
	});

	it('rejects helper lines on a chart type that cannot carry them', () => {
		const chart = makeChart('bar');
		expect(() => setChartHelperLine(chart, 'dropLines', { color: '#000' })).toThrow(
			/only valid on line, stock, or combo charts/,
		);
	});
});

describe('setChartColorMapOverride', () => {
	it('sets a new colour-map override', () => {
		const chart = makeChart();
		setChartColorMapOverride(chart, { bg1: 'lt1', accent1: 'accent2' });
		expect(chart.chartData!.clrMapOvr).toStrictEqual({ bg1: 'lt1', accent1: 'accent2' });
	});

	it('merges into an existing override', () => {
		const chart = makeChart();
		setChartColorMapOverride(chart, { bg1: 'lt1' });
		setChartColorMapOverride(chart, { accent1: 'accent2' });
		expect(chart.chartData!.clrMapOvr).toStrictEqual({ bg1: 'lt1', accent1: 'accent2' });
	});

	it('removes the override when passed null', () => {
		const chart = makeChart();
		setChartColorMapOverride(chart, { bg1: 'lt1' });
		setChartColorMapOverride(chart, null);
		expect(chart.chartData!.clrMapOvr).toBeNull();
	});
});
