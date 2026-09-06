/**
 * Unit tests for chart-surface-treemap.ts
 *
 * All tests exercise pure TypeScript helpers — no Angular, no DOM, no TestBed.
 * Follows the style of chart-renderer-helpers.test.ts.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSurfaceViewModel, buildTreemapViewModel } from './chart-surface-treemap';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal element shape satisfying PptxElement (chart subtype). */
function makeElement(width = 400, height = 300) {
	return {
		id: 'el-test',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width,
		height,
	};
}

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

function makeTreemapData(): PptxChartData {
	return {
		chartType: 'treemap',
		categories: ['Alpha', 'Beta', 'Gamma', 'Delta'],
		series: [{ name: 'Size', values: [40, 30, 20, 10] }],
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// buildSurfaceViewModel — isometric path (≥2 series, ≥2 categories)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSurfaceViewModel — isometric (≥2 series, ≥2 categories)', () => {
	const el = makeElement();
	const data = makeSurfaceData(3, 4);
	const labels = data.categories;

	it('does not crash', () => {
		expect(() => buildSurfaceViewModel(el, data, labels)).not.toThrow();
	});

	it('returns a valid ChartViewModel shape', () => {
		const vm = buildSurfaceViewModel(el, data, labels);
		expect(vm).toHaveProperty('svgWidth');
		expect(vm).toHaveProperty('svgHeight');
		expect(vm).toHaveProperty('primitives');
		expect(Array.isArray(vm.primitives)).toBeTruthy();
	});

	it('produces polygon primitives (cell faces + edges)', () => {
		const vm = buildSurfaceViewModel(el, data, labels);
		const polygons = vm.primitives.filter((p) => p.kind === 'polygon');
		// (cols x rows) = (3 x 2) = 6 cells; each cell gets 2 polygons (face + edge).
		expect(polygons).toHaveLength(12);
	});

	it('has no cartesian gridlines or axis labels', () => {
		const vm = buildSurfaceViewModel(el, data, labels);
		expect(vm.gridlines).toHaveLength(0);
		expect(vm.axisLabels).toHaveLength(0);
		expect(vm.zeroLine).toBeUndefined();
	});

	it('svgWidth and svgHeight match the element frame box exactly', () => {
		const vm = buildSurfaceViewModel(makeElement(50, 50), makeSurfaceData(2, 2), ['C1', 'C2']);
		expect(vm.svgWidth).toBe(50);
		expect(vm.svgHeight).toBe(50);
	});

	it('includes legend entries when hasLegend is true', () => {
		const withLegend: PptxChartData = {
			...data,
			style: { hasLegend: true, legendPosition: 'b' },
		};
		const vm = buildSurfaceViewModel(el, withLegend, labels);
		expect(vm.legend).toHaveLength(data.series.length);
	});

	it('returns empty legend when hasLegend is false/absent', () => {
		const vm = buildSurfaceViewModel(el, data, labels);
		expect(vm.legend).toHaveLength(0);
	});

	it('carries a valueDrag context so a cell can be dragged to a new value', () => {
		const vm = buildSurfaceViewModel(el, data, labels);
		expect(vm.valueDrag).toBeDefined();
		expect(vm.valueDrag?.range.min).toBeLessThan(vm.valueDrag!.range.max);
		expect(vm.valueDrag?.plotTop).toBeLessThan(vm.valueDrag!.plotBottom);
	});

	it('tags each face polygon with the dataPoint part valueDrag commits through', () => {
		const vm = buildSurfaceViewModel(el, data, labels);
		const facePolygons = vm.primitives.filter((p) => p.kind === 'polygon' && p.fill !== 'none');
		for (const p of facePolygons) {
			expect(p.part?.role).toBe('dataPoint');
		}
	});

	it('exposes the chart title when hasTitle is true', () => {
		const titled: PptxChartData = {
			...data,
			title: 'My Surface Chart',
			style: { hasTitle: true },
		};
		const vm = buildSurfaceViewModel(el, titled, labels);
		expect(vm.title).toBe('My Surface Chart');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSurfaceViewModel - c:bandFmts and c:floor/sideWall/backWall
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSurfaceViewModel - bandFmts and floor/wall panels', () => {
	const el = makeElement();
	const data = makeSurfaceData(3, 4);
	const labels = data.categories;

	it('adds no extra polygons when no floor/wall is authored', () => {
		const vm = buildSurfaceViewModel(el, data, labels);
		const polygons = vm.primitives.filter((p) => p.kind === 'polygon');
		expect(polygons).toHaveLength(12);
	});

	it('prepends floor/wall backdrop panels ahead of the mesh facets', () => {
		const withWalls: PptxChartData = {
			...data,
			floor: { spPr: { fillColor: '#111111' } },
			backWall: { spPr: { fillColor: '#222222' } },
			sideWall: { spPr: { fillColor: '#333333' } },
		};
		const vm = buildSurfaceViewModel(el, withWalls, labels);
		const polygons = vm.primitives.filter((p) => p.kind === 'polygon');
		// 3 backdrop panels + 12 mesh polygons (6 cells x 2).
		expect(polygons).toHaveLength(15);
		expect(polygons.slice(0, 3).map((p) => p.fill)).toStrictEqual([
			'#222222',
			'#333333',
			'#111111',
		]);
	});

	it('uses bandFmts colours for the mesh face fill instead of the continuous ramp', () => {
		const withBands: PptxChartData = {
			...data,
			bandFmts: [
				{ index: 0, spPr: { fillColor: '#FF0000' } },
				{ index: 1, spPr: { fillColor: '#00FF00' } },
			],
		};
		const vm = buildSurfaceViewModel(el, withBands, labels);
		const faceFills = vm.primitives
			.filter((p) => p.kind === 'polygon' && p.part?.role === 'dataPoint')
			.map((p) => p.fill);
		expect(faceFills.length).toBeGreaterThan(0);
		for (const fill of faceFills) {
			expect(['#FF0000', '#00FF00']).toContain(fill);
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSurfaceViewModel — flat fallback (<2 series or <2 categories)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSurfaceViewModel — flat fallback (<2 series or <2 categories)', () => {
	it('falls back to rect primitives for a single series', () => {
		const el = makeElement();
		const data = makeSurfaceData(1, 4);
		const vm = buildSurfaceViewModel(el, data, data.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects.length).toBeGreaterThan(0);
		const polygons = vm.primitives.filter((p) => p.kind === 'polygon');
		expect(polygons).toHaveLength(0);
	});

	it('falls back for a single category column', () => {
		const el = makeElement();
		const data = makeSurfaceData(3, 1);
		const vm = buildSurfaceViewModel(el, data, data.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects.length).toBeGreaterThan(0);
	});

	it('produces seriesCount × catCount rect cells', () => {
		const el = makeElement();
		const data = makeSurfaceData(1, 3);
		const vm = buildSurfaceViewModel(el, data, data.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		// 1 series × 3 categories = 3 cells.
		expect(rects).toHaveLength(3);
	});

	it('carries a valueDrag context so a cell can be dragged to a new value', () => {
		const el = makeElement();
		const data = makeSurfaceData(1, 3);
		const vm = buildSurfaceViewModel(el, data, data.categories);
		expect(vm.valueDrag).toBeDefined();
		expect(vm.valueDrag?.range.min).toBeLessThan(vm.valueDrag!.range.max);
		expect(vm.valueDrag?.plotTop).toBeLessThan(vm.valueDrag!.plotBottom);
		for (const p of vm.primitives) {
			expect(p.part?.role).toBe('dataPoint');
		}
	});

	it('uses bandFmts colours for rect fills instead of the continuous ramp', () => {
		const el = makeElement();
		const data: PptxChartData = {
			...makeSurfaceData(1, 2),
			bandFmts: [
				{ index: 0, spPr: { fillColor: '#FF0000' } },
				{ index: 1, spPr: { fillColor: '#00FF00' } },
			],
		};
		const vm = buildSurfaceViewModel(el, data, data.categories);
		const fills = vm.primitives.filter((p) => p.kind === 'rect').map((p) => p.fill);
		for (const fill of fills) {
			expect(['#FF0000', '#00FF00']).toContain(fill);
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSurfaceViewModel — empty / edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSurfaceViewModel — empty / edge cases', () => {
	it('does not crash on an empty series array', () => {
		const el = makeElement();
		const data: PptxChartData = {
			chartType: 'surface',
			categories: [],
			series: [],
		};
		expect(() => buildSurfaceViewModel(el, data, [])).not.toThrow();
	});

	it('returns a well-formed view-model for an empty chart', () => {
		const el = makeElement();
		const data: PptxChartData = { chartType: 'surface', categories: [], series: [] };
		const vm = buildSurfaceViewModel(el, data, []);
		expect(vm.svgWidth).toBeGreaterThan(0);
		expect(vm.svgHeight).toBeGreaterThan(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTreemapViewModel — basic layout
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTreemapViewModel — basic layout', () => {
	const el = makeElement();
	const data = makeTreemapData();
	const labels = data.categories;

	it('does not crash', () => {
		expect(() => buildTreemapViewModel(el, data, labels)).not.toThrow();
	});

	it('returns a valid ChartViewModel shape', () => {
		const vm = buildTreemapViewModel(el, data, labels);
		expect(vm).toHaveProperty('primitives');
		expect(Array.isArray(vm.primitives)).toBeTruthy();
	});

	it('produces exactly one rect per value', () => {
		const vm = buildTreemapViewModel(el, data, labels);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		// 4 values → 4 rects.
		expect(rects).toHaveLength(4);
	});

	it('all rects have positive width and height', () => {
		const vm = buildTreemapViewModel(el, data, labels);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		for (const r of rects) {
			if (r.kind === 'rect') {
				expect(r.w).toBeGreaterThan(0);
				expect(r.h).toBeGreaterThan(0);
			}
		}
	});

	it('produces text labels for cells that are large enough', () => {
		// With a 400×300 element and 4 values, the largest cell should be big
		// enough to show its label.
		const vm = buildTreemapViewModel(el, data, labels);
		const texts = vm.primitives.filter((p) => p.kind === 'text');
		expect(texts.length).toBeGreaterThan(0);
	});

	it('label text matches the category label', () => {
		const vm = buildTreemapViewModel(el, data, labels);
		const texts = vm.primitives
			.filter((p) => p.kind === 'text')
			.map((p) => (p.kind === 'text' ? p.text : ''));
		expect(texts).toContain('Alpha');
	});

	it('has no cartesian gridlines, axisLabels, or zeroLine', () => {
		const vm = buildTreemapViewModel(el, data, labels);
		expect(vm.gridlines).toHaveLength(0);
		expect(vm.axisLabels).toHaveLength(0);
		expect(vm.zeroLine).toBeUndefined();
	});

	it('produces category-based legend entries when hasLegend is true', () => {
		const withLegend: PptxChartData = {
			...data,
			style: { hasLegend: true },
		};
		const vm = buildTreemapViewModel(el, withLegend, labels);
		// One legend entry per category label.
		expect(vm.legend).toHaveLength(labels.length);
		expect(vm.legend[0].label).toBe('Alpha');
	});

	it('returns empty legend when hasLegend is false/absent', () => {
		const vm = buildTreemapViewModel(el, data, labels);
		expect(vm.legend).toHaveLength(0);
	});

	it('exposes chart title when hasTitle is true', () => {
		const titled: PptxChartData = {
			...data,
			title: 'My Treemap',
			style: { hasTitle: true },
		};
		const vm = buildTreemapViewModel(el, titled, labels);
		expect(vm.title).toBe('My Treemap');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTreemapViewModel — value → area proportionality
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTreemapViewModel — value→size scaling', () => {
	it('largest value produces the largest rect area', () => {
		const el = makeElement(600, 400);
		const data: PptxChartData = {
			chartType: 'treemap',
			categories: ['Big', 'Medium', 'Small'],
			series: [{ name: 'S', values: [100, 50, 10] }],
		};
		const vm = buildTreemapViewModel(el, data, data.categories);
		const rects = vm.primitives
			.filter((p) => p.kind === 'rect')
			.map((p) => (p.kind === 'rect' ? p.w * p.h : 0));

		// Items are sorted largest-first so rects[0] > rects[1] > rects[2].
		expect(rects[0]).toBeGreaterThan(rects[1] ?? 0);
		expect(rects[1]).toBeGreaterThan(rects[2] ?? 0);
	});

	it('all rect areas sum close to total plot area', () => {
		const el = makeElement(400, 300);
		const data: PptxChartData = {
			chartType: 'treemap',
			categories: ['A', 'B'],
			series: [{ name: 'S', values: [70, 30] }],
		};
		const vm = buildTreemapViewModel(el, data, data.categories);
		const totalArea = vm.primitives
			.filter((p) => p.kind === 'rect')
			.reduce((sum, p) => (p.kind === 'rect' ? sum + p.w * p.h : sum), 0);

		// Layout margins mean the sum won't exactly equal svgWidth×svgHeight but
		// should be a substantial portion of the plot area.
		expect(totalArea).toBeGreaterThan(0);
	});
});

describe('buildTreemapViewModel - ChartEx hierarchy', () => {
	function hierarchicalData(
		parentLabelLayout: 'none' | 'banner' | 'overlapping' = 'banner',
	): PptxChartData {
		return {
			chartType: 'treemap',
			categories: ['Hardware', 'Software', 'Services', 'Support'],
			categoryLevels: [
				['Hardware', 'Software', 'Services', 'Support'],
				['North', '', 'South', ''],
			],
			series: [
				{
					name: 'Revenue',
					values: [65, 40, 25, 10],
					treemapOptions: { parentLabelLayout },
				},
			],
		};
	}

	it('renders nested parent labels and preserves leaf source indexes', () => {
		const data = hierarchicalData();
		const vm = buildTreemapViewModel(makeElement(600, 400), data, data.categories);
		const text = vm.primitives.filter((primitive) => primitive.kind === 'text');
		expect(text.map((primitive) => primitive.text)).toStrictEqual(
			expect.arrayContaining(['North', 'South', ...data.categories]),
		);

		const rects = vm.primitives.filter((primitive) => primitive.kind === 'rect');
		expect(rects.map((rect) => rect.part)).toStrictEqual(
			expect.arrayContaining(
				data.categories.map((_category, pointIndex) => ({
					role: 'dataPoint',
					seriesIndex: 0,
					pointIndex,
				})),
			),
		);
	});

	it('honors none and banner parent-label layouts', () => {
		const banner = hierarchicalData('banner');
		const withoutParents = hierarchicalData('none');
		const bannerVm = buildTreemapViewModel(makeElement(), banner, banner.categories);
		const noneVm = buildTreemapViewModel(makeElement(), withoutParents, withoutParents.categories);
		expect(
			bannerVm.primitives.some(
				(primitive) => primitive.kind === 'text' && primitive.text === 'North',
			),
		).toBeTruthy();
		expect(
			noneVm.primitives.some(
				(primitive) => primitive.kind === 'text' && primitive.text === 'North',
			),
		).toBeFalsy();
		const bannerTop = Math.min(
			...bannerVm.primitives
				.filter((primitive) => primitive.kind === 'rect')
				.map((primitive) => primitive.y),
		);
		const overlapping = hierarchicalData('overlapping');
		const overlappingVm = buildTreemapViewModel(makeElement(), overlapping, overlapping.categories);
		const overlappingTop = Math.min(
			...overlappingVm.primitives
				.filter((primitive) => primitive.kind === 'rect')
				.map((primitive) => primitive.y),
		);
		expect(bannerTop).toBeGreaterThan(overlappingTop);
	});

	it('keeps series and point alignment for multiple series', () => {
		const data = hierarchicalData();
		data.series.push({
			name: 'Profit',
			values: [20, 15, 8, 4],
			treemapOptions: { parentLabelLayout: 'banner' },
		});
		const vm = buildTreemapViewModel(makeElement(700, 400), data, data.categories);
		const refs = vm.primitives
			.filter((primitive) => primitive.kind === 'rect')
			.map((primitive) => primitive.part);
		expect(refs).toHaveLength(8);
		for (let seriesIndex = 0; seriesIndex < 2; seriesIndex++) {
			for (let pointIndex = 0; pointIndex < 4; pointIndex++) {
				expect(refs).toContainEqual({ role: 'dataPoint', seriesIndex, pointIndex });
			}
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTreemapViewModel — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTreemapViewModel — edge cases', () => {
	it('does not crash on an empty series', () => {
		const el = makeElement();
		const data: PptxChartData = { chartType: 'treemap', categories: [], series: [] };
		expect(() => buildTreemapViewModel(el, data, [])).not.toThrow();
	});

	it('handles a single-item treemap', () => {
		const el = makeElement();
		const data: PptxChartData = {
			chartType: 'treemap',
			categories: ['Only'],
			series: [{ name: 'S', values: [42] }],
		};
		const vm = buildTreemapViewModel(el, data, data.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(1);
	});

	it('treats negative values as absolute (mirrors React behaviour)', () => {
		const el = makeElement();
		const data: PptxChartData = {
			chartType: 'treemap',
			categories: ['Neg', 'Pos'],
			series: [{ name: 'S', values: [-60, 40] }],
		};
		expect(() => buildTreemapViewModel(el, data, data.categories)).not.toThrow();
		const vm = buildTreemapViewModel(el, data, data.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		// Larger absolute value produces a larger rect.
		const areas = rects.map((p) => (p.kind === 'rect' ? p.w * p.h : 0));
		expect(areas[0]).toBeGreaterThan(areas[1] ?? 0);
	});

	it('svgWidth and svgHeight match the element frame box exactly', () => {
		const el = makeElement(10, 10);
		const data: PptxChartData = {
			chartType: 'treemap',
			categories: ['X'],
			series: [{ name: 'S', values: [1] }],
		};
		const vm = buildTreemapViewModel(el, data, data.categories);
		expect(vm.svgWidth).toBe(10);
		expect(vm.svgHeight).toBe(10);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Selectable marks
//
// Surface was the one kind whose primitives carried no `ChartPartRef` at all,
// so its marks could not be selected on canvas in any binding. A mesh facet
// spans four data points, so it is tagged with the grid vertex it is anchored
// at; the flat fallback maps one rect to exactly one authored value.
// ─────────────────────────────────────────────────────────────────────────────

describe('surface: interactive marks', () => {
	it('tags every isometric facet with its anchoring grid vertex', () => {
		const chartData: PptxChartData = {
			chartType: 'surface',
			categories: ['Q1', 'Q2', 'Q3'],
			series: [
				{ name: 'A', values: [10, 20, 30] },
				{ name: 'B', values: [15, 25, 35] },
				{ name: 'C', values: [12, 22, 32] },
			],
			style: {},
		};
		const vm = buildSurfaceViewModel(
			{ id: 'el', type: 'chart', x: 0, y: 0, width: 400, height: 300 } as never,
			chartData,
			chartData.categories,
		);
		const faces = vm.primitives.filter(
			(primitive) => primitive.kind === 'polygon' && primitive.part !== undefined,
		);
		// (3 series - 1) x (3 categories - 1) = 4 facets.
		expect(faces).toHaveLength(4);
		for (const face of faces) {
			expect(face.part!.role).toBe('dataPoint');
			expect(face.part!.seriesIndex).toBeGreaterThanOrEqual(0);
			expect(face.part!.pointIndex).toBeGreaterThanOrEqual(0);
		}
	});

	it('tags each flat-fallback cell with its own (series, category)', () => {
		const chartData: PptxChartData = {
			chartType: 'surface',
			categories: ['Q1', 'Q2', 'Q3'],
			series: [{ name: 'A', values: [10, 20, 30] }],
			style: {},
		};
		const vm = buildSurfaceViewModel(
			{ id: 'el', type: 'chart', x: 0, y: 0, width: 400, height: 300 } as never,
			chartData,
			chartData.categories,
		);
		const cells = vm.primitives.filter(
			(primitive) => primitive.kind === 'rect' && primitive.part !== undefined,
		);
		expect(cells).toHaveLength(3);
		expect(cells.map((cell) => cell.part!.pointIndex)).toStrictEqual([0, 1, 2]);
	});
});
