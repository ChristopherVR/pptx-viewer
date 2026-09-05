import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildDataLabelText,
	dataLabelFontOverride,
	resolveDataLabelContent,
	resolveDataLabelTextStyle,
} from './chart-data-label-text';

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
			buildDataLabelText({ chartData: chart(), series: shareSeries, pointIndex: 0, value: 40 })
				?.text,
		).toBe('40');
	});

	it('renders a percentage when c:showPercent is set', () => {
		const series: PptxChartSeries = {
			...shareSeries,
			dataLabelOptions: { showValue: false, showPercent: true },
		};
		expect(buildDataLabelText({ chartData: chart(), series, pointIndex: 0, value: 40 })?.text).toBe(
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
		expect(buildDataLabelText({ chartData: chart(), series, pointIndex: 1, value: 25 })?.text).toBe(
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
			})?.text,
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
		expect(buildDataLabelText({ chartData: chart(), series, pointIndex: 1, value: 25 })?.text).toBe(
			'Hand typed',
		);
	});

	it('carries a [Red]/[Blue] number-format colour when the label is JUST the value', () => {
		const series: PptxChartSeries = { ...shareSeries, numberFormat: '#,##0;[Red]-#,##0' };
		const result = buildDataLabelText({ chartData: chart(), series, pointIndex: 0, value: -5 });
		expect(result).toStrictEqual({ text: '-5', color: '#FF0000' });
	});

	it('drops the number-format colour once another component joins the value', () => {
		const series: PptxChartSeries = {
			...shareSeries,
			numberFormat: '#,##0;[Red]-#,##0',
			dataLabelOptions: { showValue: true, showCategory: true },
		};
		const result = buildDataLabelText({ chartData: chart(), series, pointIndex: 0, value: -5 });
		expect(result?.text).toBe('Direct, -5');
		expect(result?.color).toBeUndefined();
	});

	it('a per-point c:dLbl/c:numFmt overrides the series number format', () => {
		// `numberFormat` on a per-point `c:dLbl` is a wave-agreed core field not
		// yet on `PptxChartDataLabel` in `packages/core/dist`; bridge it here the
		// same way `chart-data-label-text.ts` does internally.
		const series: PptxChartSeries = {
			...shareSeries,
			numberFormat: '0.00',
			dataLabels: [{ idx: 0, numberFormat: '0%' }] as unknown as PptxChartSeries['dataLabels'],
		};
		expect(
			buildDataLabelText({ chartData: chart(), series, pointIndex: 0, value: 0.4 })?.text,
		).toBe('40%');
	});

	it('a series-level c:ser/c:dLbls/c:numFmt wins over the chart-type level and the series format', () => {
		const data = chart({
			style: {
				hasDataLabels: true,
				dataLabels: { numberFormat: '0.0%' } as unknown as NonNullable<
					PptxChartData['style']
				>['dataLabels'],
			},
		});
		const series: PptxChartSeries = {
			...shareSeries,
			numberFormat: '0.00',
			dataLabelOptions: { numberFormat: '0%' } as unknown as PptxChartSeries['dataLabelOptions'],
		};
		expect(buildDataLabelText({ chartData: data, series, pointIndex: 0, value: 0.4 })?.text).toBe(
			'40%',
		);
	});

	it('a chart-type-level c:dLbls/c:numFmt wins over the series format', () => {
		// Same bridge as above, at the chart-type (`c:*Chart/c:dLbls`) level.
		const data = chart({
			style: {
				hasDataLabels: true,
				dataLabels: { numberFormat: '0%' } as unknown as NonNullable<
					PptxChartData['style']
				>['dataLabels'],
			},
		});
		const series: PptxChartSeries = { ...shareSeries, numberFormat: '0.00' };
		expect(buildDataLabelText({ chartData: data, series, pointIndex: 0, value: 0.4 })?.text).toBe(
			'40%',
		);
	});
});

// C2-G1 (data-label half): c:dLbl / c:ser.dLbls / c:*Chart.dLbls txPr cascade,
// mirroring the numFmt cascade above.
describe('resolveDataLabelTextStyle', () => {
	it('returns undefined when nothing at any level authored a font', () => {
		expect(resolveDataLabelTextStyle(chart(), shareSeries, 0)).toBeUndefined();
	});

	it('falls back to the chart-type-level c:dLbls/c:txPr', () => {
		const data = chart({ style: { hasDataLabels: true, dataLabels: { txPr: { fontSize: 8 } } } });
		expect(resolveDataLabelTextStyle(data, shareSeries, 0)).toStrictEqual({ fontSize: 8 });
	});

	it('lets the series-level c:ser/c:dLbls/c:txPr win over the chart-type level', () => {
		const data = chart({ style: { hasDataLabels: true, dataLabels: { txPr: { fontSize: 8 } } } });
		const series: PptxChartSeries = {
			...shareSeries,
			dataLabelOptions: { txPr: { fontSize: 10 } },
		};
		expect(resolveDataLabelTextStyle(data, series, 0)).toStrictEqual({ fontSize: 10 });
	});

	it('lets a per-point c:dLbl/c:txPr win over the series and chart-type levels', () => {
		const data = chart({ style: { hasDataLabels: true, dataLabels: { txPr: { fontSize: 8 } } } });
		const series: PptxChartSeries = {
			...shareSeries,
			dataLabelOptions: { txPr: { fontSize: 10 } },
			dataLabels: [{ idx: 0, txPr: { fontSize: 14, bold: true } }],
		};
		expect(resolveDataLabelTextStyle(data, series, 0)).toStrictEqual({ fontSize: 14, bold: true });
	});
});

// C2-G1 (data-label half): resolveDataLabelTextStyle's font, converted to the
// SvgText fields every non-pie emitter (bar/column, line/area/scatter/bubble,
// radar, stock close, ChartEx histogram/waterfall/box-whisker/funnel/
// treemap/sunburst) needs to actually draw with it.
describe('dataLabelFontOverride', () => {
	it('returns an empty override for undefined (a chart with no authored font)', () => {
		expect(dataLabelFontOverride(undefined)).toStrictEqual({});
	});

	it('converts fontSize from points to px', () => {
		expect(dataLabelFontOverride({ fontSize: 12 })).toStrictEqual({ fontSize: 16 });
	});

	it('maps bold/italic to the CSS-shaped fontWeight/fontStyle', () => {
		expect(dataLabelFontOverride({ bold: true, italic: true })).toStrictEqual({
			fontWeight: 'bold',
			fontStyle: 'italic',
		});
	});

	it('honours an explicit false, not just a set bold/italic', () => {
		expect(dataLabelFontOverride({ bold: false, italic: false })).toStrictEqual({
			fontWeight: 'normal',
			fontStyle: 'normal',
		});
	});

	it('maps color to fill and fontFamily through unchanged', () => {
		expect(dataLabelFontOverride({ color: '#FF0000', fontFamily: 'Calibri' })).toStrictEqual({
			fill: '#FF0000',
			fontFamily: 'Calibri',
		});
	});

	it('omits every field the source txPr left unset', () => {
		expect(dataLabelFontOverride({ fontFamily: 'Calibri' })).toStrictEqual({
			fontFamily: 'Calibri',
		});
	});
});
