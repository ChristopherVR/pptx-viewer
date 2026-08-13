import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildDataLabelText, resolveDataLabelContent } from './chart-data-label-text';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'pie',
		categories: ['Direct', 'Partner', 'Online', 'Retail'],
		series: [{ name: 'Share', values: [40, 25, 20, 15] }],
		...overrides,
	};
}

const shareSeries: PptxChartSeries = { name: 'Share', values: [40, 25, 20, 15] };

describe('resolveDataLabelContent', () => {
	it('falls back to value-only when nothing declares a content flag', () => {
		const content = resolveDataLabelContent(chart(), shareSeries, 0);
		expect({
			showValue: content.showValue,
			showPercent: content.showPercent,
			showCategory: content.showCategory,
		}).toStrictEqual({ showValue: true, showPercent: false, showCategory: false });
	});

	it('lets the SERIES group override the chart-type group', () => {
		// This is the arrangement PowerPoint actually writes: the user's choices
		// go on c:ser/c:dLbls and the chart-type-level group stays all-zero.
		const data = chart({
			style: {
				hasDataLabels: true,
				dataLabels: { showValue: false, showPercent: false, showCategory: false },
			},
		});
		const series: PptxChartSeries = {
			...shareSeries,
			dataLabelOptions: { showValue: false, showPercent: true, showCategory: true },
		};
		const content = resolveDataLabelContent(data, series, 0);
		expect({
			showValue: content.showValue,
			showPercent: content.showPercent,
			showCategory: content.showCategory,
		}).toStrictEqual({ showValue: false, showPercent: true, showCategory: true });
	});

	it('lets a per-point c:dLbl override the series group', () => {
		const series: PptxChartSeries = {
			...shareSeries,
			dataLabelOptions: { showValue: false, showPercent: true },
			dataLabels: [{ idx: 1, showPercent: false, showVal: true }],
		};
		const overridden = resolveDataLabelContent(chart(), series, 1);
		expect({ percent: overridden.showPercent, value: overridden.showValue }).toStrictEqual({
			percent: false,
			value: true,
		});
		expect(resolveDataLabelContent(chart(), series, 0).showPercent).toBeTruthy();
	});
});

describe('buildDataLabelText', () => {
	it('prints the raw value when no content flag is set (historical behaviour)', () => {
		expect(
			buildDataLabelText({ chartData: chart(), series: shareSeries, pointIndex: 0, value: 40 }),
		).toBe('40');
	});

	it('renders a percentage when c:showPercent is set', () => {
		const series: PptxChartSeries = {
			...shareSeries,
			dataLabelOptions: { showValue: false, showPercent: true },
		};
		expect(buildDataLabelText({ chartData: chart(), series, pointIndex: 0, value: 40 })).toBe(
			'40%',
		);
	});

	it('combines category and percentage through c:separator', () => {
		const series: PptxChartSeries = {
			...shareSeries,
			dataLabelOptions: {
				showValue: false,
				showPercent: true,
				showCategory: true,
				separator: ', ',
			},
		};
		expect(buildDataLabelText({ chartData: chart(), series, pointIndex: 1, value: 25 })).toBe(
			'Partner, 25%',
		);
	});

	it('honours an explicit percentBase over the series total', () => {
		const series: PptxChartSeries = {
			...shareSeries,
			dataLabelOptions: { showValue: false, showPercent: true },
		};
		expect(
			buildDataLabelText({
				chartData: chart(),
				series,
				pointIndex: 0,
				value: 40,
				percentBase: 200,
			}),
		).toBe('20%');
	});

	it('suppresses a deleted label and honours custom c:dLbl text', () => {
		const series: PptxChartSeries = {
			...shareSeries,
			dataLabels: [
				{ idx: 0, deleted: true },
				{ idx: 1, text: 'Hand typed' },
			],
		};
		expect(
			buildDataLabelText({ chartData: chart(), series, pointIndex: 0, value: 40 }),
		).toBeUndefined();
		expect(buildDataLabelText({ chartData: chart(), series, pointIndex: 1, value: 25 })).toBe(
			'Hand typed',
		);
	});
});
