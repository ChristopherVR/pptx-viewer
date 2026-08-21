import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildSurfaceChart3DData,
	buildSurfaceChart3DDataForElement,
} from './surface-chart-3d-data';

function makeSurfaceData(seriesCount: number, catCount: number): PptxChartData {
	return {
		chartType: 'surface',
		categories: Array.from({ length: catCount }, (_, i) => `C${i + 1}`),
		series: Array.from({ length: seriesCount }, (_, si) => ({
			name: `S${si + 1}`,
			values: Array.from({ length: catCount }, (_v, ci) => (si + 1) * (ci + 1) * 10),
		})),
	};
}

describe('buildSurfaceChart3DData', () => {
	it('returns null when there are no series', () => {
		const data: PptxChartData = { chartType: 'surface', categories: ['A'], series: [] };
		expect(buildSurfaceChart3DData(data, ['A'], { width: 400, height: 300 })).toBeNull();
	});

	it('returns null when there are no categories', () => {
		const data = makeSurfaceData(2, 0);
		expect(buildSurfaceChart3DData(data, [], { width: 400, height: 300 })).toBeNull();
	});

	it('sizes cols/rows from categories/series and the maps from their product', () => {
		const data = makeSurfaceData(3, 4);
		const result = buildSurfaceChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result).not.toBeNull();
		expect(result!.cols).toBe(4);
		expect(result!.rows).toBe(3);
		expect(result!.heightMap).toHaveLength(12);
		expect(result!.colorMap).toHaveLength(36);
	});

	it('normalises heights into [0, 1] and preserves the relative value order', () => {
		const data: PptxChartData = {
			chartType: 'surface',
			categories: ['A', 'B'],
			series: [
				{ name: 'S1', values: [0, 50] },
				{ name: 'S2', values: [100, 25] },
			],
		};
		const result = buildSurfaceChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result).not.toBeNull();
		// row-major: idx = row * cols + col. The lowest authored value (S1/A = 0)
		// maps to the lowest height; the highest (S2/A = 100) to the highest.
		expect(result!.heightMap[0]).toBeLessThan(result!.heightMap[1]); // S1/A(0) < S1/B(50)
		expect(result!.heightMap[2]).toBeGreaterThan(result!.heightMap[1]); // S2/A(100) > S1/B(50)
		expect(result!.heightMap[2]).toBeGreaterThan(result!.heightMap[3]); // S2/A(100) > S2/B(25)
		for (const h of result!.heightMap) {
			expect(h).toBeGreaterThanOrEqual(0);
			expect(h).toBeLessThanOrEqual(1);
		}
	});

	it('produces colour channels within [0, 1]', () => {
		const data = makeSurfaceData(2, 2);
		const result = buildSurfaceChart3DData(data, data.categories, { width: 400, height: 300 });
		for (const c of result!.colorMap) {
			expect(c).toBeGreaterThanOrEqual(0);
			expect(c).toBeLessThanOrEqual(1);
		}
	});

	it('defaults wireframe to true and passes width/height through', () => {
		const data = makeSurfaceData(2, 2);
		const result = buildSurfaceChart3DData(data, data.categories, { width: 640, height: 480 });
		expect(result!.wireframe).toBeTruthy();
		expect(result!.width).toBe(640);
		expect(result!.height).toBe(480);
	});

	it('honours an explicit wireframe: false', () => {
		const data = makeSurfaceData(2, 2);
		const result = buildSurfaceChart3DData(data, data.categories, {
			width: 400,
			height: 300,
			wireframe: false,
		});
		expect(result!.wireframe).toBeFalsy();
	});

	it('carries each series name through as the series axis label', () => {
		const data: PptxChartData = {
			chartType: 'surface',
			categories: ['A', 'B'],
			series: [
				{ name: 'S1', values: [1, 2] },
				{ name: 'S2', values: [3, 4] },
			],
		};
		const result = buildSurfaceChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.seriesNames).toStrictEqual(['S1', 'S2']);
	});

	it('a flat (all-equal) series maps every height to the same value', () => {
		const data: PptxChartData = {
			chartType: 'surface',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [5, 5] }],
		};
		const result = buildSurfaceChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.heightMap[0]).toBeCloseTo(result!.heightMap[1]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSurfaceChart3DDataForElement — the single decision point every binding
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

describe('buildSurfaceChart3DDataForElement', () => {
	it('returns null for a non-chart element', () => {
		const element = { id: 'el-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(buildSurfaceChart3DDataForElement(element, { width: 10, height: 10 })).toBeNull();
	});

	it('returns null when the chart has no data', () => {
		expect(
			buildSurfaceChart3DDataForElement(makeChartElement(undefined), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns null for a non-surface chart kind', () => {
		const data: PptxChartData = {
			chartType: 'bar',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
		};
		expect(
			buildSurfaceChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('resolves both `surface` and `surface3D` chart types', () => {
		const base: PptxChartData = {
			chartType: 'surface',
			categories: ['A', 'B'],
			series: [
				{ name: 'S1', values: [1, 2] },
				{ name: 'S2', values: [3, 4] },
			],
		};
		expect(
			buildSurfaceChart3DDataForElement(makeChartElement(base), { width: 400, height: 300 }),
		).not.toBeNull();
		expect(
			buildSurfaceChart3DDataForElement(makeChartElement({ ...base, chartType: 'surface3D' }), {
				width: 400,
				height: 300,
			}),
		).not.toBeNull();
	});

	it('falls back to 1-based index labels when categories are empty, matching buildChartViewModel', () => {
		const data: PptxChartData = {
			chartType: 'surface',
			categories: [],
			series: [
				{ name: 'S1', values: [1, 2, 3] },
				{ name: 'S2', values: [4, 5, 6] },
			],
		};
		const result = buildSurfaceChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result).not.toBeNull();
		expect(result!.categoryLabels).toStrictEqual(['1', '2', '3']);
	});

	it('passes the element frame box through as width/height', () => {
		const data: PptxChartData = {
			chartType: 'surface',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
		};
		const result = buildSurfaceChart3DDataForElement(makeChartElement(data, 600, 500), {
			width: 600,
			height: 500,
		});
		expect(result!.width).toBe(600);
		expect(result!.height).toBe(500);
	});
});
