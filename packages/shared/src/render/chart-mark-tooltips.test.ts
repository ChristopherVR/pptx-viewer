/**
 * Regression coverage for hover-tooltip text on chart marks.
 *
 * Only the region-map choropleth used to set `SvgPath.title`; every other
 * primitive kind (rect / circle / polyline / polygon / line) had no `title`
 * field at all, so bar / line / area / scatter / bubble / pie / radar marks
 * rendered no hover tooltip anywhere. This asserts `buildChartViewModel`
 * stamps a non-empty `title` on the interactive (`part`-tagged) primitive for
 * each of those kinds, and that chrome primitives (gridlines, legend swatches)
 * stay untitled.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartViewModel } from './chart-view-model';

function chartElement(chartData: PptxChartData, width = 400, height = 300): ChartPptxElement {
	return {
		id: 'el-tooltip',
		type: 'chart',
		x: 0,
		y: 0,
		width,
		height,
		chartData,
	} as ChartPptxElement;
}

describe('chart mark tooltips', () => {
	it('titles clustered bar rects with series, category and value', () => {
		const vm = buildChartViewModel(
				chartElement({
					chartType: 'bar',
					categories: ['Q1', 'Q2'],
					series: [{ name: 'Revenue', values: [100, 150] }],
				}),
			),
			rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(2);
		expect(rects[0].title).toBe('Revenue, Q1: 100');
		expect(rects[1].title).toBe('Revenue, Q2: 150');
	});

	it('titles stacked bar rects with the raw (non-running-sum) value', () => {
		const vm = buildChartViewModel(
				chartElement({
					chartType: 'bar',
					grouping: 'stacked',
					categories: ['Q1'],
					series: [
						{ name: 'A', values: [10] },
						{ name: 'B', values: [20] },
					],
				}),
			),
			rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects.map((r) => r.title)).toStrictEqual(['A, Q1: 10', 'B, Q1: 20']);
	});

	it('titles percentStacked bar rects with the raw value, not the normalised percent', () => {
		const vm = buildChartViewModel(
				chartElement({
					chartType: 'bar',
					grouping: 'percentStacked',
					categories: ['Q1'],
					series: [
						{ name: 'A', values: [25] },
						{ name: 'B', values: [75] },
					],
				}),
			),
			rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects.map((r) => r.title)).toStrictEqual(['A, Q1: 25', 'B, Q1: 75']);
	});

	it('titles horizontal ("bar direction") bars the same way as column bars', () => {
		const vm = buildChartViewModel(
				chartElement({
					chartType: 'bar',
					barDirection: 'bar',
					categories: ['Q1'],
					series: [{ name: 'Revenue', values: [42] }],
				}),
			),
			rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects[0].title).toBe('Revenue, Q1: 42');
	});

	it('titles line-chart data-point markers', () => {
		const vm = buildChartViewModel(
				chartElement({
					chartType: 'line',
					categories: ['Jan', 'Feb'],
					series: [{ name: 'Trend', values: [10, 30] }],
				}),
			),
			circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(circles).toHaveLength(2);
		expect(circles[0].title).toBe('Trend, Jan: 10');
		expect(circles[1].title).toBe('Trend, Feb: 30');
	});

	it('titles area-chart data-point markers', () => {
		const vm = buildChartViewModel(
				chartElement({
					chartType: 'area',
					categories: ['Jan', 'Feb'],
					series: [{ name: 'Trend', values: [10, 30] }],
				}),
			),
			circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(circles[0].title).toBe('Trend, Jan: 10');
	});

	it('titles scatter dots with the series name and (x, y) coordinate', () => {
		const vm = buildChartViewModel(
				chartElement({
					chartType: 'scatter',
					categories: [],
					series: [{ name: 'S1', values: [4], xValues: [2] }],
				}),
			),
			circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(circles[0].title).toBe('S1: (2, 4)');
	});

	it('titles bubbles with the coordinate and bubble size', () => {
		const vm = buildChartViewModel(
				chartElement({
					chartType: 'bubble',
					categories: [],
					series: [{ name: 'S1', values: [4], xValues: [2], bubbleSizes: [50] }],
				}),
			),
			circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(circles[0].title).toBe('S1: (2, 4), size 50');
	});

	it('titles pie slices with the series name, category and value', () => {
		const vm = buildChartViewModel(
				chartElement(
					{
						chartType: 'pie',
						categories: ['A', 'B'],
						series: [{ name: 'S1', values: [30, 70] }],
					},
					300,
					300,
				),
			),
			paths = vm.primitives.filter((p) => p.kind === 'path');
		expect(paths[0].title).toBe('S1, A: 30');
		expect(paths[1].title).toBe('S1, B: 70');
	});

	it('titles radar vertex markers with series, category and value', () => {
		const vm = buildChartViewModel(
				chartElement(
					{
						chartType: 'radar',
						categories: ['Speed', 'Power'],
						series: [{ name: 'Player 1', values: [8, 6] }],
					},
					400,
					400,
				),
			),
			circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(circles[0].title).toBe('Player 1, Speed: 8');
		expect(circles[1].title).toBe('Player 1, Power: 6');
	});

	it('leaves chrome primitives (gridlines) untitled', () => {
		const vm = buildChartViewModel(
			chartElement({
				chartType: 'bar',
				categories: ['Q1'],
				series: [{ name: 'Revenue', values: [100] }],
			}),
		);
		for (const gl of vm.gridlines) {
			expect(gl.title).toBeUndefined();
		}
	});
});
