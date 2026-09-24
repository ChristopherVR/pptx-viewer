import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	chartTitleBand,
	chartTitleBandFor,
	chartTitleFontPx,
	chartTitleReservePx,
} from './chart-title-band';
import { buildChartViewModel, computePlotLayout } from './chart-view-model';

const PT = 4 / 3;

function chart(style: PptxChartData['style'], extra: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [
			{ name: 'S1', values: [1, 2] },
			{ name: 'S2', values: [3, 4] },
		],
		style,
		...extra,
	} as PptxChartData;
}

function element(chartData: PptxChartData): ChartPptxElement {
	return {
		id: 'c1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 480,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

describe('chartTitleBand', () => {
	it('puts a 14pt title baseline 24pt below the chart top, as PowerPoint does', () => {
		const band = chartTitleBand(14 * PT);
		expect(band.baselineY / PT).toBeCloseTo(24, 0);
	});

	it('keeps the whole title box inside the band, below the baseline', () => {
		const band = chartTitleBand(24);
		expect(band.bandHeight).toBeGreaterThan(band.baselineY);
		// The glyph tops (baseline - ascent) stay below the chart's top edge.
		expect(band.baselineY - 24).toBeGreaterThan(0);
	});

	it('grows with the font size', () => {
		const small = chartTitleBand(12),
			large = chartTitleBand(24 * PT);
		expect(large.baselineY).toBeGreaterThan(small.baselineY);
		expect(large.bandHeight).toBeGreaterThan(small.bandHeight);
	});

	it('adds one line height per extra wrapped line without moving the first baseline', () => {
		const one = chartTitleBand(20),
			two = chartTitleBand(20, 2);
		expect(two.baselineY).toBe(one.baselineY);
		expect(two.bandHeight - one.bandHeight).toBeCloseTo(24, 6);
	});

	it('falls back to a single 12px line for invalid input', () => {
		expect(chartTitleBand(Number.NaN, 0)).toStrictEqual(chartTitleBand(12, 1));
		expect(chartTitleBand(-4)).toStrictEqual(chartTitleBand(12));
	});
});

describe('chartTitleBandFor', () => {
	it('is undefined for a chart without a title', () => {
		expect(chartTitleBandFor(chart({ hasTitle: false }))).toBeUndefined();
		expect(chartTitleReservePx(chart(undefined))).toBe(0);
	});

	it('sizes from the resolved title font (points to px)', () => {
		const data = chart({ hasTitle: true, titleFontSize: 18 });
		expect(chartTitleFontPx(data)).toBeCloseTo(24, 6);
		expect(chartTitleBandFor(data)).toStrictEqual(chartTitleBand(24));
	});

	it('uses the largest title run size', () => {
		const data = chart({ hasTitle: true, titleFontSize: 10 }, {
			title: 'Big small',
			titleRuns: [{ text: 'Big', fontSize: 28 }, { text: ' small' }],
		} as Partial<PptxChartData>);
		expect(chartTitleFontPx(data)).toBeCloseTo(28 * PT, 6);
	});
});

describe('buildChartViewModel title band', () => {
	it('places an 18pt title fully inside the chart and the plot below it', () => {
		const data = chart({ hasTitle: true, titleFontSize: 18 }, { title: 'Chart Title' });
		const vm = buildChartViewModel(element(data));
		const layout = computePlotLayout(480, 300, data, true);
		expect(vm.titleY - 24 * 0.95).toBeGreaterThan(0);
		expect(vm.titleY).toBeCloseTo(chartTitleBand(24).baselineY, 6);
		expect(layout.plotTop).toBeCloseTo(8 + chartTitleBand(24).bandHeight, 6);
		expect(layout.plotTop).toBeGreaterThan(vm.titleY);
	});

	it('leaves a chart without a title on the historical layout', () => {
		const data = chart({ hasTitle: false });
		expect(computePlotLayout(480, 300, data, true).plotTop).toBe(8);
	});

	it('moves a top legend below the title band', () => {
		const data = chart(
			{ hasTitle: true, titleFontSize: 18, hasLegend: true, legendPosition: 't' },
			{ title: 'Chart Title' },
		);
		const vm = buildChartViewModel(element(data));
		const band = chartTitleBand(24);
		expect(vm.legendY).toBeCloseTo(8 + band.bandHeight, 6);
		expect(computePlotLayout(480, 300, data, true).plotTop).toBeCloseTo(
			8 + band.bandHeight + 20,
			6,
		);
	});
});
