/**
 * Regression test: a line chart's legend must get a line + marker swatch, not
 * the default filled rect, through Angular's VENDORED copy of
 * `pptx-viewer-shared` (see `../internal/shared`, populated by
 * `scripts/inline-shared.mjs` at build time). Angular does not template-mount
 * `ChartRendererComponent` in this package's test setup (see
 * `chart-renderer.component.test.ts`'s doc comment), so this asserts the same
 * data adapter the template's `legendItems()` / `pptx-chart-primitives` binds
 * read, matching that file's established pattern.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeChartLegendLayout } from '../internal/shared';
import { buildChartViewModel } from './chart-renderer-helpers';

function lineChartElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'line',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'A', values: [10, 20], color: '#00B0F0' },
			{ name: 'B', values: [5, 15], color: '#404040' },
		],
		style: { hasLegend: true, legendPosition: 'b' },
	} as PptxChartData;
	return {
		id: 'ch_line_legend',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as unknown as ChartPptxElement;
}

function barChartElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'A', values: [10, 20] }],
		style: { hasLegend: true, legendPosition: 'b' },
	} as PptxChartData;
	return {
		id: 'ch_bar_legend',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as unknown as ChartPptxElement;
}

describe('chart-renderer legend swatch (vendored shared)', () => {
	it('gives a line chart legend entry a line + marker swatch', () => {
		const vm = buildChartViewModel(lineChartElement());
		const items = computeChartLegendLayout(vm);
		expect(items).toHaveLength(2);
		expect(items.every((item) => item.lineSwatch !== undefined)).toBeTruthy();
		expect(items[0].lineSwatch?.primitives.some((p) => p.kind === 'line')).toBeTruthy();
	});

	it('keeps a bar chart legend entry on the default rect swatch', () => {
		const vm = buildChartViewModel(barChartElement());
		const items = computeChartLegendLayout(vm);
		expect(items).toHaveLength(1);
		expect(items[0].lineSwatch).toBeUndefined();
	});
});
