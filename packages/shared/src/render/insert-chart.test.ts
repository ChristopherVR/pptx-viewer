import { describe, expect, it } from 'vitest';

import { translationsEn } from '../i18n/translations-en';
import {
	createDefaultChartElement,
	DEFAULT_INSERT_CHART_KIND,
	DEFAULT_INSERT_CHART_TYPE,
	INSERT_CHART_TYPES,
} from './insert-chart';

describe('insert-chart', () => {
	it('exposes the common chart types in the dropdown list', () => {
		const ids = INSERT_CHART_TYPES.map((o) => o.id);
		expect(ids).toStrictEqual(['column', 'bar', 'line', 'pie', 'doughnut', 'area', 'scatter']);
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
});
