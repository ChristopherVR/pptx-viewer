import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { horizontalAxisY, verticalAxisX } from './chart-axis-crossing';
import { buildPrimaryAxis } from './chart-axis-render';
import { buildCartesianHorizontalAxis } from './chart-horizontal-axis';
import type { PlotLayout, ValueRange } from './chart-view-model';
import { buildChartViewModel } from './chart-view-model';

const layout: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 40,
	plotRight: 360,
	plotTop: 30,
	plotBottom: 250,
	plotWidth: 320,
	plotHeight: 220,
};
const range: ValueRange = { min: 0, max: 40, span: 40 };

describe('chartML axis crossing rendering', () => {
	it('resolves automatic, boundary, and explicit horizontal crossings', () => {
		expect(horizontalAxisY({ axisType: 'valAx', crosses: 'max' }, range, layout, 'bottom')).toBe(
			30,
		);
		expect(horizontalAxisY({ axisType: 'valAx', crosses: 'min' }, range, layout, 'top')).toBe(250);
		expect(horizontalAxisY({ axisType: 'valAx', crossesAt: 20 }, range, layout, 'bottom')).toBe(
			140,
		);
	});

	it('resolves category crossing values and renders value ticks at that x coordinate', () => {
		const x = verticalAxisX({ axisType: 'catAx', crossesAt: 2 }, 3, layout, 'left');
		expect(x).toBe(200);
		const rendered = buildPrimaryAxis(
			range,
			layout,
			{ axisType: 'valAx', majorTickMark: 'out' },
			x,
		);
		expect(
			rendered.gridlines.some((line) => line.x1 === x && line.x2 !== layout.plotRight),
		).toBeTruthy();
	});

	it('renders an independent top date axis without changing primary source order', () => {
		const chartData: PptxChartData = {
			chartType: 'line',
			categories: ['A', 'B', 'C'],
			dateCategories: { values: [45_000, 45_001, 45_010] },
			series: [{ name: 'Value', values: [10, 20, 30] }],
			axes: [
				{ axisType: 'dateAx', axisId: 1, crossAxisId: 2, axPos: 'b', majorUnit: 10 },
				{ axisType: 'valAx', axisId: 2, crossAxisId: 1, crossesAt: 20 },
				{
					axisType: 'dateAx',
					axisId: 3,
					crossAxisId: 4,
					axPos: 't',
					orientation: 'maxMin',
					majorUnit: 10,
				},
				{ axisType: 'valAx', axisId: 4, crossAxisId: 3, axPos: 'r', crosses: 'max' },
			],
		};
		const plan = buildCartesianHorizontalAxis(
			chartData,
			chartData.categories,
			layout,
			'line',
			range,
			range,
		);
		expect(plan.sourceIndices).toStrictEqual([0, 1, 2]);
		expect(plan.labels).toHaveLength(4);
		expect(plan.labels.some((label) => label.y < layout.plotTop)).toBeTruthy();
		expect(plan.labels.some((label) => label.y > 140)).toBeTruthy();
	});

	it('honors crossBetween when positioning categorical line points', () => {
		const chartData: PptxChartData = {
			chartType: 'line',
			categories: ['A', 'B', 'C'],
			series: [{ name: 'Value', values: [1, 2, 3] }],
			axes: [
				{ axisType: 'catAx', axisId: 1, crossAxisId: 2, axPos: 'b' },
				{ axisType: 'valAx', axisId: 2, crossAxisId: 1, crossBetween: 'between' },
			],
		};
		const between = buildCartesianHorizontalAxis(
			chartData,
			chartData.categories,
			layout,
			'line',
			range,
		);
		expect(between.xPositions?.[0]).toBeGreaterThan(layout.plotLeft);
		chartData.axes![1].crossBetween = 'midCat';
		const onTicks = buildCartesianHorizontalAxis(
			chartData,
			chartData.categories,
			layout,
			'line',
			range,
		);
		expect(onTicks.xPositions?.[0]).toBe(layout.plotLeft);
		expect(onTicks.sourceIndices).toStrictEqual([0, 1, 2]);
	});

	it('places crossed axes and top date labels in the complete cartesian model', () => {
		const chartData: PptxChartData = {
			chartType: 'line',
			categories: ['A', 'B', 'C'],
			dateCategories: { values: [45_000, 45_001, 45_010] },
			series: [{ name: 'Value', values: [0, 20, 40] }],
			axes: [
				{
					axisType: 'catAx',
					axisId: 1,
					crossAxisId: 2,
					axPos: 'b',
					crossesAt: 2,
					majorTickMark: 'out',
				},
				{
					axisType: 'valAx',
					axisId: 2,
					crossAxisId: 1,
					crossesAt: 20,
					majorTickMark: 'out',
				},
				{ axisType: 'dateAx', axisId: 3, crossAxisId: 4, axPos: 't', majorUnit: 10 },
				{ axisType: 'valAx', axisId: 4, crossAxisId: 3, axPos: 'r', crosses: 'max' },
			],
		};
		const vm = buildChartViewModel({
			id: 'chart',
			type: 'chart',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			chartData,
		});
		const points = vm.primitives.filter(
			(primitive) => primitive.kind === 'circle' && primitive.part?.role === 'dataPoint',
		);
		expect(points.map((point) => point.part?.pointIndex)).toStrictEqual([0, 1, 2]);
		expect(vm.categoryLabels.some((label) => label.y < 46)).toBeTruthy();
		expect(
			vm.gridlines.some((line) => line.x1 > 150 && line.x1 < 250 && line.x2 !== layout.plotRight),
		).toBeTruthy();
		expect(
			vm.primitives.some(
				(primitive) => primitive.kind === 'line' && primitive.y1 > 100 && primitive.y1 < 200,
			),
		).toBeTruthy();
	});
});
