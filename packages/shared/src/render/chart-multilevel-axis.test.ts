import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildPrimaryAxis } from './chart-axis-render';
import { buildDateAxisPlan } from './chart-date-axis';
import { buildCartesianHorizontalAxis } from './chart-horizontal-axis';
import type { PlotLayout, ValueRange } from './chart-view-model';

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

function hierarchyData(): PptxChartData {
	return {
		chartType: 'line',
		categories: ['Jan', 'Feb', 'Mar', 'Apr'],
		categoryLevels: [
			['Jan', 'Feb', 'Mar', 'Apr'],
			['H1', 'H1', 'H2', 'H2'],
			['2025', '2025', '2025', '2025'],
		],
		series: [{ name: 'Value', values: [10, 20, 30, 40] }],
		axes: [
			{
				axisType: 'catAx',
				axisId: 1,
				crossAxisId: 2,
				axPos: 'b',
				orientation: 'maxMin',
				fontFamily: 'Aptos',
				fontSize: 10,
				fontBold: true,
				fontColor: '#123456',
			},
			{ axisType: 'valAx', axisId: 2, crossAxisId: 1 },
			{
				axisType: 'catAx',
				axisId: 3,
				crossAxisId: 4,
				axPos: 't',
				noMultiLevelLabels: true,
				fontColor: '#CC0000',
			},
			{ axisType: 'valAx', axisId: 4, crossAxisId: 3, axPos: 'r' },
		],
	};
}

describe('multi-level category axes', () => {
	it('groups parent bands, reverses them, and keeps the top axis independent', () => {
		const chartData = hierarchyData();
		const plan = buildCartesianHorizontalAxis(
			chartData,
			chartData.categories,
			layout,
			'line',
			range,
			range,
		);
		expect(plan.sourceIndices).toStrictEqual([3, 2, 1, 0]);
		const primary = plan.labels.filter((label) => label.fill === '#123456');
		const secondary = plan.labels.filter((label) => label.fill === '#CC0000');
		expect(primary.map((label) => label.text)).toStrictEqual([
			'Apr',
			'Mar',
			'Feb',
			'Jan',
			'H2',
			'H1',
			'2025',
		]);
		expect(secondary).toHaveLength(4);
		expect(secondary.every((label) => label.y < layout.plotTop)).toBeTruthy();
		expect(primary.every((label) => label.fontFamily === 'Aptos')).toBeTruthy();
		expect(primary.every((label) => label.fontWeight === 'bold')).toBeTruthy();
	});

	it('applies skip, alignment, offset, and one band per hierarchy level', () => {
		const chartData = hierarchyData();
		chartData.axes = chartData.axes?.slice(0, 2);
		Object.assign(chartData.axes![0], {
			orientation: 'minMax',
			tickLabelSkip: 2,
			labelAlignment: 'l',
			labelOffset: 200,
		});
		const plan = buildCartesianHorizontalAxis(
			chartData,
			chartData.categories,
			layout,
			'line',
			range,
		);
		expect(plan.labels).toHaveLength(5);
		expect(plan.labels.every((label) => label.textAnchor === 'start')).toBeTruthy();
		expect(new Set(plan.labels.map((label) => label.y))).toHaveLength(3);
		expect(Math.min(...plan.labels.map((label) => label.y))).toBeGreaterThan(
			layout.plotBottom + 15,
		);
	});
});

describe('typed chart axis styling', () => {
	it('styles date labels, ticks, and the horizontal axis line', () => {
		const chartData: PptxChartData = {
			chartType: 'line',
			categories: ['A', 'B'],
			dateCategories: { values: [45_000, 45_010] },
			series: [{ name: 'Value', values: [1, 2] }],
			axes: [
				{
					axisType: 'dateAx',
					axPos: 'b',
					majorUnit: 10,
					majorTickMark: 'out',
					fontFamily: 'Arial',
					fontSize: 11,
					fontBold: true,
					fontColor: '#112233',
					spPr: { strokeColor: '#445566', strokeWidth: 2, strokeDashStyle: 'dash' },
				},
			],
		};
		const plan = buildDateAxisPlan(chartData, layout)!;
		expect(plan.labels.every((label) => label.fontFamily === 'Arial')).toBeTruthy();
		expect(plan.labels.every((label) => label.fontSize === 11)).toBeTruthy();
		expect(plan.labels.every((label) => label.fill === '#112233')).toBeTruthy();
		expect(plan.tickMarks.every((line) => line.stroke === '#445566')).toBeTruthy();
		expect(plan.tickMarks.every((line) => line.strokeWidth === 2)).toBeTruthy();
	});

	it('styles value labels, gridlines, ticks, and the vertical axis line', () => {
		const rendered = buildPrimaryAxis(range, layout, {
			axisType: 'valAx',
			majorTickMark: 'out',
			fontFamily: 'Arial',
			fontSize: 12,
			fontBold: true,
			fontColor: '#010203',
			spPr: { strokeColor: '#111111', strokeWidth: 3 },
			majorGridlinesSpPr: { strokeColor: '#222222', strokeWidth: 2, strokeDashStyle: 'dot' },
		});
		expect(rendered.axisLabels.every((label) => label.fontFamily === 'Arial')).toBeTruthy();
		expect(rendered.axisLabels.every((label) => label.fill === '#010203')).toBeTruthy();
		expect(
			rendered.gridlines.some((line) => line.stroke === '#111111' && line.strokeWidth === 3),
		).toBeTruthy();
		expect(
			rendered.gridlines.some((line) => line.stroke === '#222222' && line.strokeWidth === 2),
		).toBeTruthy();
	});
});
