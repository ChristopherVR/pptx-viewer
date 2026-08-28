import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildAreaChart3DDataForElement } from './area-chart-3d-data';

function makeAreaData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'area3D',
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

describe('buildAreaChart3DDataForElement', () => {
	it('returns null for a non-chart element', () => {
		const element = { id: 'el-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(buildAreaChart3DDataForElement(element, { width: 10, height: 10 })).toBeNull();
	});

	it('returns null for a plain (non-3D) area chart', () => {
		const data = makeAreaData({ chartType: 'area' });
		expect(
			buildAreaChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns null for a different 3D chart kind (line3D)', () => {
		const data = makeAreaData({ chartType: 'line3D' });
		expect(
			buildAreaChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('resolves an area3D chart with one path per series and a baselineY for the ribbon', () => {
		const data = makeAreaData();
		const result = buildAreaChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result).not.toBeNull();
		expect(result!.series).toHaveLength(2);
		for (const s of result!.series) {
			expect(s.baselineY).toBeTypeOf('number');
		}
	});

	it('gives every series its own depth plane', () => {
		const data = makeAreaData();
		const result = buildAreaChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result!.series[0].depthZ).not.toBeCloseTo(result!.series[1].depthZ);
	});
});
