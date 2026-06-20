import { describe, expect, it } from 'vitest';

import {
	createDefaultChartElement,
	DEFAULT_INSERT_CHART_TYPE,
	INSERT_CHART_TYPES,
} from './insert-chart';

describe('insert-chart', () => {
	it('exposes the common chart types in the dropdown list', () => {
		const types = INSERT_CHART_TYPES.map((o) => o.type);
		expect(types).toContain('bar');
		expect(types).toContain('line');
		expect(types).toContain('pie');
		expect(types).toContain('doughnut');
		expect(types).toContain('area');
		expect(types).toContain('scatter');
		for (const opt of INSERT_CHART_TYPES) {
			expect(opt.label.length).toBeGreaterThan(0);
		}
	});

	it('defaults to a bar chart type', () => {
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

	it('uses the default chart type when none is supplied', () => {
		const el = createDefaultChartElement();
		expect(el.chartData?.chartType).toBe(DEFAULT_INSERT_CHART_TYPE);
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
