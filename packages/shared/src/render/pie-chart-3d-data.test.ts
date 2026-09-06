import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildPieChart3DData, buildPieChart3DDataForElement } from './pie-chart-3d-data';

function makePieData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'pie3D',
		categories: ['A', 'B', 'C'],
		series: [{ name: 'S1', values: [10, 20, 30] }],
		...overrides,
	};
}

describe('buildPieChart3DData', () => {
	it('returns null when there are no series', () => {
		const data: PptxChartData = { chartType: 'pie3D', categories: [], series: [] };
		expect(buildPieChart3DData(data, [], { width: 400, height: 300 })).toBeNull();
	});

	it('returns null when the series has no values', () => {
		const data: PptxChartData = {
			chartType: 'pie3D',
			categories: [],
			series: [{ name: 'S1', values: [] }],
		};
		expect(buildPieChart3DData(data, [], { width: 400, height: 300 })).toBeNull();
	});

	it('produces one wedge per data point', () => {
		const data = makePieData();
		const result = buildPieChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result).not.toBeNull();
		expect(result!.wedges).toHaveLength(3);
	});

	it('gives every wedge a distinct palette colour when the series has none', () => {
		const data = makePieData();
		const result = buildPieChart3DData(data, data.categories, { width: 400, height: 300 });
		const colors = result!.wedges.map((w) => w.color);
		expect(new Set(colors).size).toBe(3);
		for (const c of colors) {
			expect(c).toMatch(/^#/u);
		}
	});

	it('honours a per-point dPt fill override', () => {
		const data = makePieData({
			series: [
				{
					name: 'S1',
					values: [10, 20, 30],
					dataPoints: [{ idx: 1, spPr: { fillColor: '#ABCDEF' } }],
				},
			],
		});
		const result = buildPieChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.wedges[1].color.toUpperCase()).toBe('#ABCDEF');
	});

	it('resolves explosion from a per-point dPt override', () => {
		const data = makePieData({
			series: [
				{
					name: 'S1',
					values: [10, 20, 30],
					dataPoints: [{ idx: 2, explosion: 40 }],
				},
			],
		});
		const result = buildPieChart3DData(data, data.categories, { width: 400, height: 300 });
		const [x, z] = result!.wedges[2].explodeOffset;
		expect(Math.hypot(x, z)).toBeGreaterThan(0);
		expect(result!.wedges[0].explodeOffset).toStrictEqual([0, 0]);
	});

	it('carries view3D rotX/rotY/perspective/hPercent through to scene options', () => {
		const data = makePieData({
			view3D: { rotX: 25, rotY: 130, perspective: 45, hPercent: 60, rAngAx: false },
		});
		const result = buildPieChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.view3D).toStrictEqual({
			rotX: 25,
			rotY: 130,
			rperspective: 45,
			hPercent: 60,
			rAngAx: false,
		});
	});

	it('leaves view3D undefined when the chart has none authored', () => {
		const data = makePieData();
		const result = buildPieChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.view3D).toBeUndefined();
	});

	it('carries the raw values, explosions, and firstSliceAngleDeg through for a live drag recompute', () => {
		const data = makePieData({ firstSliceAngle: 45 });
		const result = buildPieChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.values).toStrictEqual([10, 20, 30]);
		expect(result!.explosions).toStrictEqual([0, 0, 0]);
		expect(result!.firstSliceAngleDeg).toBe(45);
	});

	it('resolves wedge thickness from hPercent', () => {
		const base = buildPieChart3DData(makePieData(), ['A', 'B', 'C'], { width: 400, height: 300 });
		const thin = buildPieChart3DData(makePieData({ view3D: { hPercent: 25 } }), ['A', 'B', 'C'], {
			width: 400,
			height: 300,
		});
		expect(thin!.thickness).toBeLessThan(base!.thickness);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPieChart3DDataForElement - the single decision point every binding
// calls to gate the interactive 3D scene.
// ─────────────────────────────────────────────────────────────────────────────

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

describe('buildPieChart3DDataForElement', () => {
	it('returns null for a non-chart element', () => {
		const element = { id: 'el-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(buildPieChart3DDataForElement(element, { width: 10, height: 10 })).toBeNull();
	});

	it('returns null when the chart has no data', () => {
		expect(
			buildPieChart3DDataForElement(makeChartElement(undefined), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns null for a plain (non-3D) pie chart, even though resolveChartKind folds both to "pie"', () => {
		const data: PptxChartData = {
			chartType: 'pie',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
		};
		expect(
			buildPieChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns null for any other 3D chart kind (bar3D)', () => {
		const data: PptxChartData = {
			chartType: 'bar3D',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
		};
		expect(
			buildPieChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('resolves a pie3D chart', () => {
		const data = makePieData();
		expect(
			buildPieChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).not.toBeNull();
	});

	it('falls back to 1-based index labels when categories are empty, matching buildChartViewModel', () => {
		const data = makePieData({ categories: [] });
		const result = buildPieChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result).not.toBeNull();
		expect(result!.categoryLabels).toStrictEqual(['1', '2', '3']);
	});
});
