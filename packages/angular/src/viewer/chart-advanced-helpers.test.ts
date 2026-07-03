/**
 * chart-advanced-helpers.test.ts: Vitest unit tests for chart-advanced-helpers.ts.
 *
 * These cover the immutable wrappers that back the advanced chart-editor control
 * components (title/legend/data-labels/axis/trendline/error-bars/data-point
 * labels). Each control component routes its edits through one of these, so the
 * tests here assert the behaviour the controls rely on without needing the
 * Angular compiler / TestBed (unavailable in the plain vitest env).
 *
 * @module angular-viewer/chart-advanced-helpers.test
 */

import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	setAxis,
	setDataLabels,
	setDataPointLabel,
	setLegend,
	setSeriesErrorBars,
	setSeriesTrendline,
	setTitle,
} from './chart-advanced-helpers';

function makeChart(chartType: PptxChartData['chartType'] = 'bar'): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType,
		categories: ['Q1', 'Q2', 'Q3'],
		series: [
			{ name: 'Rev', values: [10, 20, 30] },
			{ name: 'Cost', values: [5, 15, 25] },
		],
		axes: [{ axisType: 'catAx' }, { axisType: 'valAx' }],
	};
	return { type: 'chart', id: 'ch-1', x: 0, y: 0, width: 400, height: 300, chartData };
}

const noChart: ChartPptxElement = {
	type: 'chart',
	id: 'c',
	x: 0,
	y: 0,
	width: 1,
	height: 1,
};

describe('setTitle', () => {
	it('sets the chart title immutably', () => {
		const el = makeChart();
		const result = setTitle(el, 'Revenue');
		expect(result).not.toBe(el);
		expect(result.chartData?.title).toBe('Revenue');
		expect(el.chartData?.title).toBeUndefined();
	});

	it('returns the element unchanged when chartData is missing', () => {
		expect(setTitle(noChart, 'x')).toBe(noChart);
	});
});

describe('setLegend', () => {
	it('toggles legend visibility', () => {
		const result = setLegend(makeChart(), { show: true });
		expect(result.chartData?.style?.hasLegend).toBeTruthy();
	});

	it('sets the legend position and turns it on', () => {
		const result = setLegend(makeChart(), { position: 'r' });
		expect(result.chartData?.style?.legendPosition).toBe('r');
		expect(result.chartData?.style?.hasLegend).toBeTruthy();
	});
});

describe('setDataLabels', () => {
	it('toggles the data-label master flag', () => {
		const result = setDataLabels(makeChart(), { show: true });
		expect(result.chartData?.style?.hasDataLabels).toBeTruthy();
	});

	it('sets content flags and a position, turning labels on', () => {
		const result = setDataLabels(makeChart(), { showValue: true, position: 'outEnd' });
		expect(result.chartData?.style?.dataLabels?.showValue).toBeTruthy();
		expect(result.chartData?.style?.dataLabels?.position).toBe('outEnd');
		expect(result.chartData?.style?.hasDataLabels).toBeTruthy();
	});
});

describe('setAxis', () => {
	it('sets min/max/major-unit on the value axis', () => {
		const result = setAxis(makeChart(), 'valAx', { min: 0, max: 100, majorUnit: 20 });
		const axis = result.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.min).toBe(0);
		expect(axis?.max).toBe(100);
		expect(axis?.majorUnit).toBe(20);
	});

	it('clears a scale override with null', () => {
		const set = setAxis(makeChart(), 'valAx', { min: 5 });
		const cleared = setAxis(set, 'valAx', { min: null });
		expect(cleared.chartData?.axes?.find((a) => a.axisType === 'valAx')?.min).toBeUndefined();
	});

	it('sets the number format and tick-label position', () => {
		const result = setAxis(makeChart(), 'valAx', {
			numberFormat: '0.0%',
			tickLabelPosition: 'low',
		});
		const axis = result.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.numFmt?.formatCode).toBe('0.0%');
		expect(axis?.tickLblPos).toBe('low');
	});

	it('toggles gridline visibility', () => {
		const result = setAxis(makeChart(), 'valAx', { majorGridlines: true, minorGridlines: false });
		const axis = result.chartData?.axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.majorGridlines).toBeTruthy();
		expect(axis?.minorGridlines).toBeFalsy();
	});

	it('does not mutate the original', () => {
		const el = makeChart();
		setAxis(el, 'valAx', { min: 42 });
		expect(el.chartData?.axes?.find((a) => a.axisType === 'valAx')?.min).toBeUndefined();
	});
});

describe('setSeriesTrendline', () => {
	it('sets and clears a series trendline', () => {
		const set = setSeriesTrendline(makeChart(), 0, { trendlineType: 'linear', displayEq: true });
		expect(set.chartData?.series[0].trendlines?.[0].trendlineType).toBe('linear');
		expect(set.chartData?.series[0].trendlines?.[0].displayEq).toBeTruthy();
		const cleared = setSeriesTrendline(set, 0, null);
		expect(cleared.chartData?.series[0].trendlines).toStrictEqual([]);
	});
});

describe('setSeriesErrorBars', () => {
	it('sets and clears series error bars', () => {
		const set = setSeriesErrorBars(makeChart(), 1, {
			direction: 'y',
			barType: 'both',
			valType: 'percentage',
			val: 5,
		});
		expect(set.chartData?.series[1].errBars?.[0].valType).toBe('percentage');
		expect(set.chartData?.series[1].errBars?.[0].val).toBe(5);
		const cleared = setSeriesErrorBars(set, 1, null);
		expect(cleared.chartData?.series[1].errBars).toStrictEqual([]);
	});
});

describe('setDataPointLabel', () => {
	it('sets and clears a per-point label override', () => {
		const set = setDataPointLabel(makeChart('pie'), 0, 2, { showValue: true, text: 'Peak' });
		const label = set.chartData?.series[0].dataLabels?.find((l) => l.idx === 2);
		expect(label?.showVal).toBeTruthy();
		expect(label?.text).toBe('Peak');
		const cleared = setDataPointLabel(set, 0, 2, null);
		expect(cleared.chartData?.series[0].dataLabels).toBeUndefined();
	});
});
