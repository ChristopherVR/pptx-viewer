import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildLineChart3DDataForElement } from './line-chart-3d-data';

function makeLineData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'line3D',
		categories: ['A', 'B', 'C'],
		series: [
			{ name: 'S1', values: [10, 20, 30] },
			{ name: 'S2', values: [15, 5, 25] },
		],
		...overrides,
	};
}

function makeChartElement(
	chartData: PptxChartData | undefined,
	width = 400,
	height = 300,
): PptxElement {
	return {
		id: 'el-1',
		type: 'chart',
		x: 0,
		y: 0,
		width,
		height,
		chartData,
	} as unknown as PptxElement;
}

describe('buildLineChart3DDataForElement', () => {
	it('returns null for a non-chart element', () => {
		const element = { id: 'el-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(buildLineChart3DDataForElement(element, { width: 10, height: 10 })).toBeNull();
	});

	it('returns null when the chart has no data', () => {
		expect(
			buildLineChart3DDataForElement(makeChartElement(undefined), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns null for a plain (non-3D) line chart', () => {
		const data = makeLineData({ chartType: 'line' });
		expect(
			buildLineChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns null for a different 3D chart kind (area3D)', () => {
		const data = makeLineData({ chartType: 'area3D' });
		expect(
			buildLineChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('resolves a line3D chart with one path per series', () => {
		const data = makeLineData();
		const result = buildLineChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result).not.toBeNull();
		expect(result!.cols).toBe(3);
		expect(result!.rows).toBe(2);
		expect(result!.series).toHaveLength(2);
		expect(result!.series[0].vertices).toHaveLength(3);
	});

	it('falls back to 1-based index labels when categories are empty', () => {
		const data = makeLineData({ categories: [] });
		const result = buildLineChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result!.categoryLabels).toStrictEqual(['1', '2', '3']);
	});

	it('carries view3D through to scene options', () => {
		const data = makeLineData({
			view3D: { rotX: 25, rotY: 130, perspective: 45, depthPercent: 60, rAngAx: false },
		});
		const result = buildLineChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result!.view3D).toStrictEqual({
			rotX: 25,
			rotY: 130,
			rperspective: 45,
			depthPercent: 60,
			rAngAx: false,
		});
	});

	it('resolves series colour from the palette when the series has none', () => {
		const data = makeLineData();
		const result = buildLineChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		for (const s of result!.series) {
			expect(s.color).toMatch(/^#/u);
		}
	});

	it('honours an explicit series colour', () => {
		const data: PptxChartData = {
			chartType: 'line3D',
			categories: ['A'],
			series: [{ name: 'S1', values: [1], color: '#ABCDEF' }],
		};
		const result = buildLineChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result!.series[0].color.toUpperCase()).toBe('#ABCDEF');
	});
});
