/**
 * Regression tests for per-data-point `c:dPt` fill overrides and varyColors
 * rendering (GitHub issue #72). The resolver in `chart-datapoint-style.ts` was
 * correct but unwired: the plot builders coloured every point with the
 * series/palette colour and ignored per-point overrides. These tests assert the
 * effective fill emitted by `buildChartViewModel` honours a `dPt` override on
 * bar / stacked-bar / line / scatter / pie, and that a pie (varyColors-by-
 * default) yields distinct per-slice colours.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartViewModel } from './chart-view-model';

function chartElement(chartData: PptxChartData, width = 400, height = 300): ChartPptxElement {
	return {
		id: 'el-dpt',
		type: 'chart',
		x: 0,
		y: 0,
		width,
		height,
		chartData,
	} as ChartPptxElement;
}

const OVERRIDE = '#FF0000';

describe('dPt fill override rendering (issue #72)', () => {
	it('overrides a single clustered-bar point with its c:dPt fill', () => {
		const data: PptxChartData = {
			chartType: 'bar',
			categories: ['A', 'B', 'C'],
			series: [
				{
					name: 'S',
					values: [10, 20, 30],
					color: '#123456',
					dataPoints: [{ idx: 1, spPr: { fillColor: OVERRIDE } }],
				},
			],
		};
		const vm = buildChartViewModel(chartElement(data));
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		const overridden = rects.find((r) => r.part?.pointIndex === 1);
		const plain = rects.find((r) => r.part?.pointIndex === 0);
		expect(overridden?.fill).toBe(OVERRIDE);
		// Non-overridden points keep the series colour.
		expect(plain?.fill).toBe('#123456');
	});

	it('overrides a stacked-bar segment with its c:dPt fill', () => {
		const data: PptxChartData = {
			chartType: 'bar',
			grouping: 'stacked',
			categories: ['A', 'B'],
			series: [
				{
					name: 'S1',
					values: [10, 20],
					color: '#123456',
					dataPoints: [{ idx: 1, spPr: { fillColor: OVERRIDE } }],
				},
			],
		};
		const vm = buildChartViewModel(chartElement(data));
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		const overridden = rects.find((r) => r.part?.pointIndex === 1);
		expect(overridden?.fill).toBe(OVERRIDE);
	});

	it('overrides a line data-point marker with its c:dPt fill', () => {
		const data: PptxChartData = {
			chartType: 'line',
			categories: ['A', 'B', 'C'],
			series: [
				{
					name: 'S',
					values: [10, 20, 30],
					color: '#123456',
					dataPoints: [{ idx: 2, spPr: { fillColor: OVERRIDE } }],
				},
			],
		};
		const vm = buildChartViewModel(chartElement(data));
		const circles = vm.primitives.filter((p) => p.kind === 'circle');
		const overridden = circles.find((c) => c.part?.pointIndex === 2);
		const plain = circles.find((c) => c.part?.pointIndex === 0);
		expect(overridden?.fill).toBe(OVERRIDE);
		expect(plain?.fill).toBe('#123456');
	});

	it('overrides a scatter dot with its c:dPt fill', () => {
		const data: PptxChartData = {
			chartType: 'scatter',
			categories: ['1', '2', '3'],
			series: [
				{
					name: 'S',
					values: [10, 20, 30],
					color: '#123456',
					dataPoints: [{ idx: 1, spPr: { fillColor: OVERRIDE } }],
				},
			],
		};
		const vm = buildChartViewModel(chartElement(data));
		const circles = vm.primitives.filter((p) => p.kind === 'circle');
		const overridden = circles.find((c) => c.part?.pointIndex === 1);
		expect(overridden?.fill).toBe(OVERRIDE);
	});
});

describe('pie varyColors + dPt override rendering (issue #72)', () => {
	const pieData: PptxChartData = {
		chartType: 'pie',
		categories: ['A', 'B', 'C'],
		series: [
			{
				name: 'S',
				values: [30, 50, 20],
				dataPoints: [{ idx: 1, spPr: { fillColor: OVERRIDE } }],
			},
		],
	};

	it('yields a distinct palette colour per slice (varyColors default)', () => {
		const noOverride: PptxChartData = {
			...pieData,
			series: [{ name: 'S', values: [30, 50, 20] }],
		};
		const vm = buildChartViewModel(chartElement(noOverride));
		const fills = vm.primitives.filter((p) => p.kind === 'path').map((p) => p.fill);
		expect(fills).toHaveLength(3);
		expect(new Set(fills).size).toBe(3);
	});

	it('overrides a single slice with its c:dPt fill', () => {
		const vm = buildChartViewModel(chartElement(pieData));
		const paths = vm.primitives.filter((p) => p.kind === 'path');
		const overridden = paths.find((p) => p.part?.pointIndex === 1);
		expect(overridden?.fill).toBe(OVERRIDE);
		// Other slices keep their distinct palette colours (not the override).
		const others = paths.filter((p) => p.part?.pointIndex !== 1).map((p) => p.fill);
		expect(others.every((f) => f !== OVERRIDE)).toBeTruthy();
	});

	it('does not let a pie series-level colour flatten every slice', () => {
		const flattened: PptxChartData = {
			...pieData,
			series: [{ name: 'S', values: [30, 50, 20], color: '#00FF00' }],
		};
		const vm = buildChartViewModel(chartElement(flattened));
		const fills = vm.primitives.filter((p) => p.kind === 'path').map((p) => p.fill);
		// Distinct palette colours per slice, never a single flat series colour.
		expect(new Set(fills).size).toBe(3);
		expect(fills.every((f) => f !== '#00FF00')).toBeTruthy();
	});
});
