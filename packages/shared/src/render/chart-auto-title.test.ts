import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { CHART_AUTO_TITLE, resolveChartTitleText, withAutoTitle } from './chart-auto-title';
import { buildChartViewModel } from './chart-view-model';

function data(partial: Partial<PptxChartData>): PptxChartData {
	return { chartType: 'bar', categories: ['A'], series: [], ...partial } as PptxChartData;
}

describe('resolveChartTitleText', () => {
	it('shows no title without a c:title', () => {
		expect(resolveChartTitleText(data({ title: 'Ignored', series: [] }))).toBeUndefined();
	});

	it('uses the authored title text', () => {
		const chart = data({ title: 'Q4', style: { hasTitle: true }, series: [] });
		expect(resolveChartTitleText(chart)).toBe('Q4');
	});

	it('auto-titles a single-series chart with its series name', () => {
		const chart = data({ style: { hasTitle: true }, series: [{ name: 'Sales', values: [1] }] });
		expect(resolveChartTitleText(chart)).toBe('Sales');
	});

	it('auto-titles a multi-series chart "Chart Title"', () => {
		const chart = data({
			style: { hasTitle: true },
			series: [
				{ name: 'A', values: [1] },
				{ name: 'B', values: [2] },
			],
		});
		expect(resolveChartTitleText(chart)).toBe(CHART_AUTO_TITLE);
	});

	it('shows nothing for an unnamed single series or an empty chart', () => {
		expect(
			resolveChartTitleText(
				data({ style: { hasTitle: true }, series: [{ name: '', values: [1] }] }),
			),
		).toBeUndefined();
		expect(resolveChartTitleText(data({ style: { hasTitle: true }, series: [] }))).toBeUndefined();
	});

	it('auto-titles a single-series ChartEx chart "Chart Title", never the series name (COM: slide 26)', () => {
		// waterfall's lone series has no authored cx:tx, so it falls back to a
		// synthesized "Series 1" name; PowerPoint never lets that leak into the
		// title the way a classic chart's real series name would.
		const chart = data({
			chartType: 'waterfall',
			style: { hasTitle: true },
			series: [{ name: 'Series 1', values: [100, 20] }],
		});
		expect(resolveChartTitleText(chart)).toBe(CHART_AUTO_TITLE);
	});

	it.each([
		'waterfall',
		'funnel',
		'treemap',
		'sunburst',
		'boxWhisker',
		'histogram',
		'regionMap',
	] as const)('treats %s as a ChartEx-only type with no series-name auto-title', (chartType) => {
		const chart = data({
			chartType,
			style: { hasTitle: true },
			series: [{ name: 'Anything', values: [1] }],
		});
		expect(resolveChartTitleText(chart)).toBe(CHART_AUTO_TITLE);
	});
});

describe('withAutoTitle (COM: charts-com.pptx slides 5, 6, 24)', () => {
	const pie = (partial: Partial<PptxChartData> = {}) =>
		data({ chartType: 'pie', series: [{ name: 'Sales', values: [1, 2] }], ...partial });

	it('titles a single-series chart with no c:title after its series', () => {
		const chart = withAutoTitle(pie());
		expect(chart.style?.hasTitle).toBeTruthy();
		expect(resolveChartTitleText(chart)).toBe('Sales');
	});

	it('respects c:autoTitleDeleted and an explicit title toggle', () => {
		expect(
			withAutoTitle(pie({ chartChrome: { autoTitleDeleted: true } })).style?.hasTitle,
		).toBeUndefined();
		const toggledOff = pie({ style: { hasTitle: false } });
		expect(withAutoTitle(toggledOff)).toBe(toggledOff);
	});

	it('never auto-titles a multi-series chart or a ChartEx family this way', () => {
		const multi = data({
			series: [
				{ name: 'A', values: [1] },
				{ name: 'B', values: [2] },
			],
		});
		expect(withAutoTitle(multi)).toBe(multi);
		const funnel = data({ chartType: 'funnel', series: [{ name: 'S', values: [1] }] });
		expect(withAutoTitle(funnel)).toBe(funnel);
	});

	it('reaches the view model every binding renders', () => {
		const vm = buildChartViewModel({
			id: 'c',
			type: 'chart',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			chartData: pie({ categories: ['A', 'B'] }),
		} as never);
		expect(vm.title).toBe('Sales');
	});
});
