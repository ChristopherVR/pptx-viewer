import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildComboViewModel, buildStockViewModel } from './chart-combo-stock';
import { excelSerialToDate } from './chart-date-axis';
import { buildChartViewModel } from './chart-view-model';

function data(chartType: PptxChartData['chartType'] = 'line'): PptxChartData {
	return {
		chartType,
		categories: ['first', 'second', 'third'],
		dateCategories: { values: [45_000, 45_001, 45_010], formatCode: 'd mmm yyyy' },
		series: [{ name: 'Value', values: [10, 20, 30] }],
		axes: [{ axisType: 'dateAx', axPos: 'b', majorTimeUnit: 'days', majorUnit: 5 }],
	};
}

function element(chartData?: PptxChartData): ChartPptxElement {
	return {
		id: 'chart',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

function pointCircles(primitives: ReturnType<typeof buildChartViewModel>['primitives']) {
	return primitives.filter(
		(primitive) => primitive.kind === 'circle' && primitive.part?.role === 'dataPoint',
	);
}

describe('continuous date axes', () => {
	it('converts both Excel date systems without losing the epoch distinction', () => {
		expect(excelSerialToDate(1).toISOString().slice(0, 10)).toBe('1900-01-01');
		expect(excelSerialToDate(0, true).toISOString().slice(0, 10)).toBe('1904-01-01');
	});

	it('spaces line points by elapsed calendar time and emits date ticks', () => {
		const vm = buildChartViewModel(element(data()));
		const circles = pointCircles(vm.primitives);
		expect(circles).toHaveLength(3);
		if (
			circles[0]?.kind !== 'circle' ||
			circles[1]?.kind !== 'circle' ||
			circles[2]?.kind !== 'circle'
		) {
			return;
		}
		expect(circles[1].cx - circles[0].cx).toBeCloseTo((circles[2].cx - circles[0].cx) / 10);
		expect(vm.categoryLabels.some((label) => label.text.includes('2023'))).toBeTruthy();
	});

	it('honors bounds and reverse orientation while retaining source point indexes', () => {
		const chartData = data();
		chartData.axes = [
			{ axisType: 'dateAx', axPos: 'b', min: 45_001, max: 45_010, orientation: 'maxMin' },
		];
		const vm = buildChartViewModel(element(chartData));
		const circles = pointCircles(vm.primitives);
		expect(circles.map((circle) => circle.part?.pointIndex)).toStrictEqual([2, 1]);
	});

	it('uses the same continuous positions for combo line points', () => {
		const chartData = data('combo');
		chartData.series.push({ name: 'Line', values: [3, 4, 5] });
		const vm = buildComboViewModel(element(), chartData, chartData.categories);
		const circles = pointCircles(vm.primitives);
		if (
			circles[0]?.kind !== 'circle' ||
			circles[1]?.kind !== 'circle' ||
			circles[2]?.kind !== 'circle'
		) {
			return;
		}
		expect(circles[1].cx - circles[0].cx).toBeCloseTo((circles[2].cx - circles[0].cx) / 10);
	});

	it('uses continuous date positions and source indexes for stock candles', () => {
		const chartData = data('stock');
		chartData.series = [
			{ name: 'High', values: [5, 6, 7] },
			{ name: 'Low', values: [1, 2, 3] },
			{ name: 'Close', values: [4, 5, 6] },
		];
		const vm = buildStockViewModel(element(), chartData, chartData.categories);
		const bodies = vm.primitives.filter((primitive) => primitive.kind === 'rect');
		expect(bodies.map((body) => body.part?.pointIndex)).toStrictEqual([0, 1, 2]);
		if (bodies[0]?.kind !== 'rect' || bodies[1]?.kind !== 'rect' || bodies[2]?.kind !== 'rect') {
			return;
		}
		expect(bodies[1].x - bodies[0].x).toBeCloseTo((bodies[2].x - bodies[0].x) / 10);
	});
});
