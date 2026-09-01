import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildRadarViewModel } from './chart-view-model-radar';

const element: PptxElement = {
	id: 'el-radar',
	type: 'chart',
	x: 0,
	y: 0,
	width: 400,
	height: 400,
} as PptxElement;

function chartData(radarStyle: PptxChartData['radarStyle']): PptxChartData {
	return {
		chartType: 'radar',
		categories: ['A', 'B', 'C'],
		series: [{ name: 'S1', values: [10, 20, 30] }],
		...(radarStyle !== undefined ? { radarStyle } : {}),
	};
}

function seriesPolygon(vm: ReturnType<typeof buildRadarViewModel>) {
	const polygons = vm.primitives.filter((p) => p.kind === 'polygon');
	// Last polygon pushed is the (only) series polygon; the rest are gridline rings.
	return polygons.at(-1) as Extract<(typeof polygons)[number], { kind: 'polygon' }>;
}

function circleCount(vm: ReturnType<typeof buildRadarViewModel>): number {
	return vm.primitives.filter((p) => p.kind === 'circle').length;
}

describe('buildRadarViewModel - radarStyle', () => {
	it('defaults to "marker" behaviour when radarStyle is absent: light fill + vertex markers', () => {
		const vm = buildRadarViewModel(element, chartData(undefined), ['A', 'B', 'C']);
		const polygon = seriesPolygon(vm);
		expect(polygon.fill).not.toBe('none');
		expect(polygon.opacity).toBe(0.2);
		expect(circleCount(vm)).toBe(3);
	});

	it('"marker" explicitly: light fill + vertex markers', () => {
		const vm = buildRadarViewModel(element, chartData('marker'), ['A', 'B', 'C']);
		const polygon = seriesPolygon(vm);
		expect(polygon.opacity).toBe(0.2);
		expect(circleCount(vm)).toBe(3);
	});

	it('"standard": outline only, no fill, no markers', () => {
		const vm = buildRadarViewModel(element, chartData('standard'), ['A', 'B', 'C']);
		const polygon = seriesPolygon(vm);
		expect(polygon.fill).toBe('none');
		expect(polygon.opacity).toBeUndefined();
		expect(circleCount(vm)).toBe(0);
	});

	it('"filled": solid series-colour fill at ~60% opacity, no markers', () => {
		const vm = buildRadarViewModel(element, chartData('filled'), ['A', 'B', 'C']);
		const polygon = seriesPolygon(vm);
		expect(polygon.fill).not.toBe('none');
		expect(polygon.opacity).toBe(0.6);
		expect(circleCount(vm)).toBe(0);
	});
});
