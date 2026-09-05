/**
 * chart-type-selector.component.test.ts: unit tests for the pure patch-apply
 * function driving the chart type/title/grouping inspector.
 *
 * No Angular TestBed (see action-settings-panel.component.test.ts for why);
 * the emit logic is factored into the standalone `applyChartTypeSelectorPatch`,
 * which is what the component's template events actually call.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { CHART_TYPE_OPTIONS, collapseChartTitleRunsForEdit } from '../internal/shared';
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

	it('changes into each of the six ChartEx types the picker now offers', () => {
		for (const chartType of [
			'histogram',
			'funnel',
			'treemap',
			'sunburst',
			'boxWhisker',
			'regionMap',
		] as const) {
			const next = applyChartTypeSelectorPatch(chart(), { chartType });
			expect(next?.chartData?.chartType).toBe(chartType);
		}
	});

	// W4-D: the title input's `onTitle` handler patches through
	// `collapseChartTitleRunsForEdit`, not a bare `{ title }` object, so a
	// multi-run title collapses to one run in its dominant style instead of
	// leaving a stale second run's text behind.
	it('collapses a multi-run title to one run in the dominant style on edit', () => {
		const el = chart({
			titleRuns: [
				{ text: 'Sales ', bold: true },
				{ text: 'Q1 Numbers', italic: true, color: '#FF0000' },
			],
		});
		const patch = collapseChartTitleRunsForEdit(el.chartData, 'New Title');
		const next = applyChartTypeSelectorPatch(el, patch);
		expect(next?.chartData?.title).toBe('New Title');
		expect(next?.chartData?.titleRuns).toStrictEqual([
			{ text: 'New Title', italic: true, color: '#FF0000' },
		]);
	});

	it("converts a 'pareto' selection to histogram plus a cumulative-percent series (docs/guide/limitations.md ChartEx row)", () => {
		// 'pareto' has no `PptxChartType` of its own; it only ever arrives here
		// the way a `<select>`'s raw string value does in the real template.
		const next = applyChartTypeSelectorPatch(chart(), {
			chartType: 'pareto' as PptxChartData['chartType'],
		});
		expect(next?.chartData?.chartType).toBe('histogram');
		expect(next?.chartData?.grouping).toBeUndefined();
		expect(next?.chartData?.series).toHaveLength(2);
		expect(next?.chartData?.series?.[1].histogramOptions?.layout).toBe('pareto');
	});
});

describe('chart type picker option list', () => {
	it('offers the six ChartEx types alongside the classic families', () => {
		const values = CHART_TYPE_OPTIONS.map((opt) => opt.value);
		for (const chartType of [
			'histogram',
			'funnel',
			'treemap',
			'sunburst',
			'boxWhisker',
			'regionMap',
		]) {
			expect(values).toContain(chartType);
		}
	});

	it('offers Pareto, the histogram-family entry with no PptxChartType of its own', () => {
		const values = CHART_TYPE_OPTIONS.map((opt) => opt.value);
		expect(values).toContain('pareto');
	});
});
