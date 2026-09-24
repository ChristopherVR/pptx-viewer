import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { CHART_AUTO_TITLE, resolveChartTitleText } from './chart-auto-title';

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
});
