import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildCartesianViewModel } from './chart-cartesian';
import { buildHorizontalBarViewModel, valueToX } from './chart-horizontal-bars';
import type { SvgRect } from './chart-view-model';

function element(): ChartPptxElement {
	return {
		type: 'chart',
		id: 'c1',
		x: 0,
		y: 0,
		width: 480,
		height: 320,
	} as ChartPptxElement;
}

function chartData(overrides?: Partial<PptxChartData>): PptxChartData {
	return {
		chartType: 'bar',
		barDirection: 'bar',
		categories: ['A', 'B', 'C'],
		series: [{ name: 'S1', values: [4, 3, 5] }],
		style: { hasLegend: true },
		...overrides,
	};
}

function rects(vm: { primitives: ReadonlyArray<{ kind: string }> }): SvgRect[] {
	return vm.primitives.filter((p): p is SvgRect => p.kind === 'rect');
}

describe('valueToX', () => {
	it('maps min to the left edge and max to the right edge', () => {
		const range = { min: 0, max: 10, span: 10 };
		expect(valueToX(0, range, 50, 450)).toBe(50);
		expect(valueToX(10, range, 50, 450)).toBe(450);
		expect(valueToX(5, range, 50, 450)).toBe(250);
	});

	it('honours reversed axis order', () => {
		const range = { min: 0, max: 10, span: 10, reverseOrder: true };
		expect(valueToX(0, range, 50, 450)).toBe(450);
		expect(valueToX(10, range, 50, 450)).toBe(50);
	});
});

describe('buildHorizontalBarViewModel', () => {
	it('draws bars that grow horizontally: width varies with value, height is constant', () => {
		const vm = buildHorizontalBarViewModel(element(), chartData(), ['A', 'B', 'C']);
		const bars = rects(vm);
		expect(bars).toHaveLength(3);
		const heights = new Set(bars.map((b) => b.h.toFixed(3)));
		expect(heights.size).toBe(1);
		// values 4, 3, 5: widths ordered accordingly.
		expect(bars[1].w).toBeLessThan(bars[0].w);
		expect(bars[0].w).toBeLessThan(bars[2].w);
	});

	it('emits vertical value gridlines and left-anchored category labels', () => {
		const vm = buildHorizontalBarViewModel(element(), chartData(), ['A', 'B', 'C']);
		for (const line of vm.gridlines) {
			expect(line.x1).toBe(line.x2);
			expect(line.y1).not.toBe(line.y2);
		}
		expect(vm.categoryLabels).toHaveLength(3);
		for (const label of vm.categoryLabels) {
			expect(label.textAnchor).toBe('end');
		}
		// Category labels sit left of the plot; value labels below it.
		const maxCatX = Math.max(...vm.categoryLabels.map((l) => l.x));
		const minGridX = Math.min(...vm.gridlines.map((l) => l.x1));
		expect(maxCatX).toBeLessThan(minGridX + 1);
	});

	it('stacks series along x when grouping is stacked', () => {
		const vm = buildHorizontalBarViewModel(
			element(),
			chartData({
				grouping: 'stacked',
				series: [
					{ name: 'S1', values: [2, 2] },
					{ name: 'S2', values: [3, 1] },
				],
			}),
			['A', 'B'],
		);
		const bars = rects(vm);
		expect(bars).toHaveLength(4);
		const catABars = bars.filter((b) => b.part?.pointIndex === 0);
		expect(catABars).toHaveLength(2);
		// Second segment starts where the first ends.
		const [first, second] = catABars;
		expect(second.x).toBeCloseTo(first.x + first.w, 1);
	});

	it('normalises percentStacked categories to the full plot width', () => {
		const vm = buildHorizontalBarViewModel(
			element(),
			chartData({
				grouping: 'percentStacked',
				series: [
					{ name: 'S1', values: [1, 9] },
					{ name: 'S2', values: [3, 1] },
				],
			}),
			['A', 'B'],
		);
		const bars = rects(vm);
		const catWidth = (pointIndex: number) =>
			bars.filter((b) => b.part?.pointIndex === pointIndex).reduce((sum, b) => sum + b.w, 0);
		expect(catWidth(0)).toBeCloseTo(catWidth(1), 0);
	});

	it('draws a vertical zero line when the range spans zero', () => {
		const vm = buildHorizontalBarViewModel(
			element(),
			chartData({ series: [{ name: 'S1', values: [-2, 3] }] }),
			['A', 'B'],
		);
		expect(vm.zeroLine).toBeDefined();
		expect(vm.zeroLine?.x1).toBe(vm.zeroLine?.x2);
	});

	it('is dispatched by the cartesian builder for barDirection "bar" only', () => {
		const horizontal = buildCartesianViewModel(element(), chartData(), ['A', 'B', 'C'], 'bar');
		const vertical = buildCartesianViewModel(
			element(),
			chartData({ barDirection: 'col' }),
			['A', 'B', 'C'],
			'bar',
		);
		// The horizontal build carries end-anchored side category labels; the
		// column build centres its labels under the plot.
		expect(horizontal.categoryLabels.every((l) => l.textAnchor === 'end')).toBeTruthy();
		expect(vertical.categoryLabels.every((l) => l.textAnchor === 'middle')).toBeTruthy();
		const verticalBars = rects(vertical);
		const heights = new Set(verticalBars.map((b) => b.h.toFixed(3)));
		expect(heights.size).toBeGreaterThan(1);
	});
});
