import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computePerspChartLayout } from './chart-3d-persp-layout';
import { buildPerspPrisms } from './chart-3d-persp-marks';
import { buildChart3DSpecForElement } from './chart-3d-spec';
import { buildChartViewModel } from './chart-view-model-build';

function bars(chartData: Partial<PptxChartData> = {}): PptxElement {
	return {
		id: 'c',
		type: 'chart',
		x: 0,
		y: 0,
		width: 800,
		height: 450,
		chartData: {
			chartType: 'bar3D',
			grouping: 'clustered',
			categories: ['A', 'B'],
			series: [
				{ name: 'S1', values: [1, 2] },
				{ name: 'S2', values: [3, 4] },
			],
			view3D: { rotX: 15, rotY: 20, rAngAx: false },
			...chartData,
		},
	} as unknown as PptxElement;
}

function layoutOf(el: PptxElement) {
	const layout = computePerspChartLayout(el, buildChartViewModel(el));
	if (!layout || el.type !== 'chart' || !el.chartData) {
		throw new Error('expected a layout');
	}
	return { layout, prisms: buildPerspPrisms(el.chartData, layout) };
}

const xRange = (outline: Array<[number, number]>): [number, number] => [
	Math.min(...outline.map(([x]) => x)),
	Math.max(...outline.map(([x]) => x)),
];

describe('bar3D without right-angle axes', () => {
	it('lays vertical and horizontal bars on the perspective box', () => {
		expect(buildChart3DSpecForElement(bars())?.geometry?.kind).toBe('perspective');
		const horizontal = buildChart3DSpecForElement(bars({ barDirection: 'bar' }));
		expect(horizontal?.geometry?.kind).toBe('perspective');
		expect(horizontal?.perspective).toBeNull();
	});

	it('runs a horizontal chart value-along-x with categories up the left edge', () => {
		const { layout, prisms } = layoutOf(bars({ barDirection: 'bar' }));
		expect(layout.horizontal).toBeTruthy();
		const first = prisms[0];
		const xs = first.outline.map(([x]) => x);
		expect(Math.min(...xs)).toBe(0);
		expect(Math.max(...xs)).toBeCloseTo(layout.valueScale, 9);
		// Categories stack upward: category 2 sits above category 1.
		const yOf = (p: typeof first) => Math.min(...p.outline.map(([, y]) => y));
		expect(yOf(prisms[2])).toBeGreaterThan(yOf(prisms[0]));
		const category = layout.labels.find((l) => l.role === 'category');
		expect(category?.anchor).toBe('end');
		const value = layout.labels.find((l) => l.role === 'value');
		expect(value?.anchor).toBe('middle');
	});

	it('puts clustered series side by side in one row, one prism per point', () => {
		const { layout, prisms } = layoutOf(bars());
		expect(layout.grouping).toBe('clustered');
		expect(layout.rows).toBe(1);
		expect(prisms).toHaveLength(4);
		const [a, b] = [prisms[0], prisms[1]];
		expect(a.pointIndex).toBe(0);
		expect(xRange(b.outline)[0]).toBeCloseTo(xRange(a.outline)[1], 9);
		expect(a.z0).toBe(b.z0);
	});

	it('stacks stacked series on one bar and gives standard series their own rows', () => {
		const stacked = layoutOf(bars({ grouping: 'stacked' })).prisms;
		expect(Math.min(...stacked[1].outline.map(([, y]) => y))).toBeCloseTo(
			Math.max(...stacked[0].outline.map(([, y]) => y)),
			9,
		);
		const standard = layoutOf(bars({ groupingStandard: true }));
		expect(standard.layout.rows).toBe(2);
		expect(standard.prisms[1].z0).toBeGreaterThan(standard.prisms[0].z1);
	});

	it('uses no value-axis headroom and puts categories in slot centres', () => {
		const { layout } = layoutOf(bars());
		expect(layout.range.max).toBe(4);
		expect(layout.categoryX).toStrictEqual([0.25, 0.75]);
	});
});
