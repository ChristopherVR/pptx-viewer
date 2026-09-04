import { describe, expect, it } from 'vitest';

import { DEFAULT_CHART_DATA_LABEL_PX, DEFAULT_CHART_TEXT_PX, chartFontPx } from './chart-font';
import { resolveChartStyleDefaults } from './chart-style-defaults';

describe('resolveChartStyleDefaults', () => {
	it('falls back to the fixed chart defaults when chartStyleDefinition is absent', () => {
		expect(resolveChartStyleDefaults(undefined)).toStrictEqual({
			bodyTextPx: DEFAULT_CHART_TEXT_PX,
			dataLabelTextPx: DEFAULT_CHART_DATA_LABEL_PX,
			legendTextPx: DEFAULT_CHART_TEXT_PX,
			titleTextPx: 12,
			axisTextColor: '#334155',
			dataLabelTextColor: '#334155',
			legendTextColor: '#334155',
			titleTextColor: '#334155',
			gridlineColor: undefined,
			chartAreaFillColor: undefined,
			plotAreaFillColor: undefined,
		});
	});

	it('prefers the chart-style part font size/colour when present', () => {
		const result = resolveChartStyleDefaults({
			chartStyleDefinition: {
				categoryAxis: { fontSize: 9, color: '#112233' },
				dataLabel: { fontSize: 8, color: '#445566' },
				legend: { fontSize: 11, color: '#778899' },
				title: { fontSize: 18, color: '#000011' },
			},
		});
		expect(result.bodyTextPx).toBeCloseTo(chartFontPx(9), 5);
		expect(result.dataLabelTextPx).toBeCloseTo(chartFontPx(8), 5);
		expect(result.legendTextPx).toBeCloseTo(chartFontPx(11), 5);
		expect(result.titleTextPx).toBeCloseTo(chartFontPx(18), 5);
		expect(result.axisTextColor).toBe('#112233');
		expect(result.dataLabelTextColor).toBe('#445566');
		expect(result.legendTextColor).toBe('#778899');
		expect(result.titleTextColor).toBe('#000011');
	});

	it('falls back from categoryAxis to valueAxis to axisTitle for the axis entry', () => {
		expect(
			resolveChartStyleDefaults({
				chartStyleDefinition: { valueAxis: { fontSize: 10 } },
			}).bodyTextPx,
		).toBeCloseTo(chartFontPx(10), 5);
		expect(
			resolveChartStyleDefaults({
				chartStyleDefinition: { axisTitle: { fontSize: 14 } },
			}).bodyTextPx,
		).toBeCloseTo(chartFontPx(14), 5);
	});

	it('resolves gridline/chart-area/plot-area colours only when the style part names them', () => {
		const result = resolveChartStyleDefaults({
			chartStyleDefinition: {
				gridlineMajor: { lineColor: '#cccccc' },
				chartArea: { fillColor: '#ffffff' },
				plotArea: { fillColor: '#f5f5f5' },
			},
		});
		expect(result.gridlineColor).toBe('#cccccc');
		expect(result.chartAreaFillColor).toBe('#ffffff');
		expect(result.plotAreaFillColor).toBe('#f5f5f5');
	});

	it('falls back from gridlineMajor to gridlineMinor for the gridline colour', () => {
		const result = resolveChartStyleDefaults({
			chartStyleDefinition: { gridlineMinor: { lineColor: '#eeeeee' } },
		});
		expect(result.gridlineColor).toBe('#eeeeee');
	});

	it('falls back per-field when the style part only styles some elements', () => {
		const result = resolveChartStyleDefaults({
			chartStyleDefinition: { title: { fontSize: 20 } },
		});
		expect(result.titleTextPx).toBeCloseTo(chartFontPx(20), 5);
		expect(result.bodyTextPx).toBe(DEFAULT_CHART_TEXT_PX);
		expect(result.dataLabelTextPx).toBe(DEFAULT_CHART_DATA_LABEL_PX);
	});
});
