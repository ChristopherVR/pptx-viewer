import { describe, expect, it } from 'vitest';

import { translationsEn } from '../i18n/translations-en';
import {
	createDefaultChartElement,
	DEFAULT_INSERT_CHART_KIND,
	DEFAULT_INSERT_CHART_TYPE,
	INSERT_CHART_TYPES,
} from './insert-chart';

describe('insert-chart', () => {
	it('exposes the common chart types plus the six ChartEx kinds in the dropdown list', () => {
		const ids = INSERT_CHART_TYPES.map((o) => o.id);
		expect(ids).toStrictEqual([
			'column',
			'bar',
			'line',
			'pie',
			'doughnut',
			'area',
			'scatter',
			'histogram',
			'funnel',
			'treemap',
			'sunburst',
			'boxWhisker',
			'regionMap',
		]);
		for (const opt of INSERT_CHART_TYPES) {
			expect(opt.label.length).toBeGreaterThan(0);
		}
	});

	it('names every entry from a key the dictionary actually defines', () => {
		const missing = INSERT_CHART_TYPES.filter((opt) => !(opt.labelKey in translationsEn));
		expect(missing).toStrictEqual([]);
	});

	it('distinguishes Column (vertical) from Bar (horizontal) over the same family', () => {
		const column = INSERT_CHART_TYPES.find((opt) => opt.id === 'column');
		const bar = INSERT_CHART_TYPES.find((opt) => opt.id === 'bar');
		expect(column?.type).toBe('bar');
		expect(bar?.type).toBe('bar');
		expect(column?.barDirection).toBe('col');
		expect(bar?.barDirection).toBe('bar');
	});

	it('defaults to the column entry over the bar chart family', () => {
		expect(DEFAULT_INSERT_CHART_KIND).toBe('column');
		expect(DEFAULT_INSERT_CHART_TYPE).toBe('bar');
	});

	it('builds a self-contained chart element with sensible defaults', () => {
		const el = createDefaultChartElement('line');
		expect(el.type).toBe('chart');
		expect(el.id).toBeTruthy();
		// chartData only: no rawXml / embedded workbook required.
		expect('rawXml' in el).toBeFalsy();
		expect(el.chartData?.chartType).toBe('line');
		expect(el.chartData?.categories).toStrictEqual(['Category 1', 'Category 2', 'Category 3']);
		expect(el.chartData?.series).toHaveLength(1);
		expect(el.chartData?.series?.[0].name).toBe('Series 1');
		expect(el.chartData?.series?.[0].values).toHaveLength(3);
		expect(el.chartData?.style?.hasLegend).toBeTruthy();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses the default (column) entry when none is supplied', () => {
		const el = createDefaultChartElement();
		expect(el.chartData?.chartType).toBe('bar');
		expect(el.chartData?.barDirection).toBe('col');
	});

	it('inserting Bar yields a horizontal bar chart', () => {
		const el = createDefaultChartElement('bar');
		expect(el.chartData?.chartType).toBe('bar');
		expect(el.chartData?.barDirection).toBe('bar');
	});

	it('leaves non-bar families without a bar direction', () => {
		const el = createDefaultChartElement('pie');
		expect(el.chartData?.barDirection).toBeUndefined();
	});

	it('honours position overrides', () => {
		const el = createDefaultChartElement('pie', { x: 10, y: 20, width: 300, height: 200 });
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(300);
		expect(el.height).toBe(200);
	});

	it('produces unique ids across calls', () => {
		const a = createDefaultChartElement('bar');
		const b = createDefaultChartElement('bar');
		expect(a.id).not.toBe(b.id);
	});

	// ── ChartEx defaults: each needs a data shape other than the generic
	// three-category ascending series to actually look like that chart type.

	it('inserting a histogram gives raw observations plus binning options, not pre-binned categories', () => {
		const el = createDefaultChartElement('histogram');
		expect(el.chartData?.chartType).toBe('histogram');
		expect(el.chartData?.categories).toStrictEqual([]);
		expect(el.chartData?.series).toHaveLength(1);
		expect(el.chartData?.series?.[0].values.length).toBeGreaterThan(5);
		expect(el.chartData?.series?.[0].histogramOptions?.layout).toBe('histogram');
		expect(el.chartData?.series?.[0].histogramOptions?.binCount).toBeGreaterThan(0);
	});

	it('inserting a funnel gives one descending series of stage values', () => {
		const el = createDefaultChartElement('funnel');
		expect(el.chartData?.chartType).toBe('funnel');
		expect(el.chartData?.series).toHaveLength(1);
		const values = el.chartData?.series?.[0].values ?? [];
		expect(values.length).toBeGreaterThan(1);
		expect([...values].sort((a, b) => b - a)).toStrictEqual(values);
	});

	it('inserting a treemap gives a two-level leaf-first hierarchy', () => {
		const el = createDefaultChartElement('treemap');
		expect(el.chartData?.chartType).toBe('treemap');
		expect(el.chartData?.categoryLevels?.length).toBe(2);
		const [leaves, parents] = el.chartData?.categoryLevels ?? [];
		expect(leaves).toHaveLength(el.chartData?.series?.[0].values.length);
		expect(new Set(parents).size).toBeGreaterThan(1);
	});

	it('inserting a sunburst gives the same leaf-first hierarchy shape as a treemap', () => {
		const el = createDefaultChartElement('sunburst');
		expect(el.chartData?.chartType).toBe('sunburst');
		expect(el.chartData?.categoryLevels?.length).toBe(2);
	});

	it('inserting a box-and-whisker gives several observations per category via multiple series', () => {
		const el = createDefaultChartElement('boxWhisker');
		expect(el.chartData?.chartType).toBe('boxWhisker');
		const categoryCount = el.chartData?.categories.length ?? 0;
		expect(categoryCount).toBeGreaterThan(1);
		const series = el.chartData?.series ?? [];
		expect(series.length).toBeGreaterThan(3);
		for (const s of series) {
			expect(s.values).toHaveLength(categoryCount);
		}
		expect(series[0].boxWhiskerOptions).toBeDefined();
	});

	it('inserting a region map gives categories that resolve to a real region', () => {
		const el = createDefaultChartElement('regionMap');
		expect(el.chartData?.chartType).toBe('regionMap');
		expect(el.chartData?.categories.length).toBeGreaterThan(1);
		expect(el.chartData?.series?.[0].regionMapOptions).toBeDefined();
	});
});
