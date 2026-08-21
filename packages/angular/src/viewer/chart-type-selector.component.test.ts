/**
 * chart-type-selector.component.test.ts: unit tests for the pure patch-apply
 * function driving the chart type/title/grouping inspector.
 *
 * No Angular TestBed (see action-settings-panel.component.test.ts for why);
 * the emit logic is factored into the standalone `applyChartTypeSelectorPatch`,
 * which is what the component's template events actually call.
 */
import type { ChartPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyChartTypeSelectorPatch } from './chart-type-selector.component';

function chart(overrides: Partial<ChartPptxElement['chartData']> = {}): ChartPptxElement {
	return {
		type: 'chart',
		id: 'c1',
		name: '',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'bar',
			grouping: 'stacked',
			title: 'Revenue',
			categories: ['Q1'],
			series: [{ name: 'A', values: [1] }],
			...overrides,
		},
	} as ChartPptxElement;
}

describe('applyChartTypeSelectorPatch', () => {
	it('returns null when the element has no chart data', () => {
		const el = { ...chart(), chartData: undefined } as ChartPptxElement;
		expect(applyChartTypeSelectorPatch(el, { title: 'x' })).toBeNull();
	});

	it('renames the chart without touching its type or grouping', () => {
		const next = applyChartTypeSelectorPatch(chart(), { title: 'New title' });
		expect(next?.chartData?.title).toBe('New title');
		expect(next?.chartData?.chartType).toBe('bar');
		expect(next?.chartData?.grouping).toBe('stacked');
	});

	it('changes the chart type and clears grouping the new type does not support', () => {
		const next = applyChartTypeSelectorPatch(chart(), { chartType: 'pie' });
		expect(next?.chartData?.chartType).toBe('pie');
		expect(next?.chartData?.grouping).toBeUndefined();
	});

	it('changes grouping without altering the chart type', () => {
		const next = applyChartTypeSelectorPatch(chart(), { grouping: 'percentStacked' });
		expect(next?.chartData?.chartType).toBe('bar');
		expect(next?.chartData?.grouping).toBe('percentStacked');
	});

	it('preserves every other element field', () => {
		const next = applyChartTypeSelectorPatch(chart(), { title: 'x' });
		expect(next?.id).toBe('c1');
		expect(next?.width).toBe(400);
		expect(next?.height).toBe(300);
	});
});
