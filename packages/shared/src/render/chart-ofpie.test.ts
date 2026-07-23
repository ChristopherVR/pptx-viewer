import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildOfPieViewModel } from './chart-ofpie';
import { resolveSecondaryIndices } from './chart-ofpie-split';

function chartElement(data: Partial<PptxChartData>): PptxElement {
	return {
		id: 'ofpie-1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 480,
		height: 300,
		chartData: {
			chartType: 'ofPie',
			categories: ['A', 'B', 'C', 'D', 'E'],
			series: [{ name: 'S', values: [40, 30, 10, 6, 4] }],
			...data,
		} satisfies PptxChartData,
	} as PptxElement;
}

describe('resolveSecondaryIndices', () => {
	const values = [40, 30, 10, 6, 4];

	it("'pos' selects the last N points", () => {
		const set = resolveSecondaryIndices(values, {
			ofPieType: 'pie',
			splitType: 'pos',
			splitPos: 2,
		});
		expect([...set].sort()).toStrictEqual([3, 4]);
	});

	it("'auto' defaults to the last two points", () => {
		const set = resolveSecondaryIndices(values, { ofPieType: 'pie', splitType: 'auto' });
		expect([...set].sort()).toStrictEqual([3, 4]);
	});

	it("'val' selects points below the threshold", () => {
		const set = resolveSecondaryIndices(values, {
			ofPieType: 'pie',
			splitType: 'val',
			splitPos: 11,
		});
		expect([...set].sort()).toStrictEqual([2, 3, 4]);
	});

	it("'percent' selects points below a percentage threshold", () => {
		// total = 90; percentages: 44.4, 33.3, 11.1, 6.7, 4.4 -> below 12% = idx 2,3,4
		const set = resolveSecondaryIndices(values, {
			ofPieType: 'pie',
			splitType: 'percent',
			splitPos: 12,
		});
		expect([...set].sort()).toStrictEqual([2, 3, 4]);
	});

	it("'cust' uses the explicit index list", () => {
		const set = resolveSecondaryIndices(values, {
			ofPieType: 'pie',
			splitType: 'cust',
			custSplit: [0, 4],
		});
		expect([...set].sort()).toStrictEqual([0, 4]);
	});

	it('never moves every point to the secondary plot', () => {
		const set = resolveSecondaryIndices([1, 2], {
			ofPieType: 'pie',
			splitType: 'cust',
			custSplit: [0, 1],
		});
		expect(set.size).toBeLessThan(2);
	});
});

describe('buildOfPieViewModel', () => {
	it('renders primary slices (kept + Other) plus secondary slices as pie', () => {
		const vm = buildOfPieViewModel(
			chartElement({ ofPieOptions: { ofPieType: 'pie', splitType: 'pos', splitPos: 2 } }),
			{
				chartType: 'ofPie',
				categories: ['A', 'B', 'C', 'D', 'E'],
				series: [{ name: 'S', values: [40, 30, 10, 6, 4] }],
				ofPieOptions: { ofPieType: 'pie', splitType: 'pos', splitPos: 2 },
			},
			['A', 'B', 'C', 'D', 'E'],
		);
		const paths = vm.primitives.filter((p) => p.kind === 'path');
		// primary: 3 kept (A,B,C) + 1 Other = 4; secondary: 2 (D,E) = 6 total.
		expect(paths).toHaveLength(6);
	});

	it('renders a bar secondary plot for bar-of-pie', () => {
		const vm = buildOfPieViewModel(
			chartElement({ ofPieOptions: { ofPieType: 'bar' } }),
			{
				chartType: 'ofPie',
				categories: ['A', 'B', 'C', 'D', 'E'],
				series: [{ name: 'S', values: [40, 30, 10, 6, 4] }],
				ofPieOptions: { ofPieType: 'bar', splitType: 'pos', splitPos: 2 },
			},
			['A', 'B', 'C', 'D', 'E'],
		);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		// 2 secondary points -> 2 stacked bar segments.
		expect(rects).toHaveLength(2);
	});

	it('draws serLines connectors by default', () => {
		const vm = buildOfPieViewModel(
			chartElement({}),
			{
				chartType: 'ofPie',
				categories: ['A', 'B', 'C', 'D', 'E'],
				series: [{ name: 'S', values: [40, 30, 10, 6, 4] }],
				ofPieOptions: { ofPieType: 'pie', splitType: 'pos', splitPos: 2 },
			},
			['A', 'B', 'C', 'D', 'E'],
		);
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(2);
	});

	it('omits serLines when serLines is false', () => {
		const vm = buildOfPieViewModel(
			chartElement({}),
			{
				chartType: 'ofPie',
				categories: ['A', 'B', 'C', 'D', 'E'],
				series: [{ name: 'S', values: [40, 30, 10, 6, 4] }],
				ofPieOptions: { ofPieType: 'pie', splitType: 'pos', splitPos: 2, serLines: false },
			},
			['A', 'B', 'C', 'D', 'E'],
		);
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(0);
	});
});
