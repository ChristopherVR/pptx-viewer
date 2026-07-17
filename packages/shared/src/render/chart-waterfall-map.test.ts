/**
 * Unit tests for chart-waterfall-map.ts
 *
 * All tests exercise pure TypeScript helpers — no Angular, no DOM, no TestBed.
 * Follows the style of chart-renderer-helpers.test.ts.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildRegionMapViewModel,
	buildWaterfallViewModel,
	normalizeValue,
	resolveRegionCode,
	sequentialColorScale,
} from './chart-waterfall-map';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test fixtures
// ─────────────────────────────────────────────────────────────────────────────

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

function makeWaterfallData(values: number[]): PptxChartData {
	return {
		chartType: 'waterfall',
		categories: values.map((_, i) => `Cat${i + 1}`),
		series: [{ name: 'S', values }],
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveRegionCode
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveRegionCode', () => {
	it('resolves ISO-2 code "us" to "US"', () => {
		expect(resolveRegionCode('us')).toBe('US');
	});

	it('resolves full country name (case-insensitive)', () => {
		expect(resolveRegionCode('United States')).toBe('US');
		expect(resolveRegionCode('germany')).toBe('DE');
		expect(resolveRegionCode('FRANCE')).toBe('FR');
	});

	it('resolves ISO-3 codes', () => {
		expect(resolveRegionCode('deu')).toBe('DE');
		expect(resolveRegionCode('GBR')).toBe('GB');
	});

	it('returns undefined for an unknown label', () => {
		expect(resolveRegionCode('Atlantis')).toBeUndefined();
		expect(resolveRegionCode('')).toBeUndefined();
	});

	it('handles extra whitespace', () => {
		expect(resolveRegionCode('  US  ')).toBe('US');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// sequentialColorScale
// ─────────────────────────────────────────────────────────────────────────────

describe('sequentialColorScale', () => {
	it('returns a hex string', () => {
		expect(sequentialColorScale(0)).toMatch(/^#[0-9a-f]{6}$/iu);
		expect(sequentialColorScale(0.5)).toMatch(/^#[0-9a-f]{6}$/iu);
		expect(sequentialColorScale(1)).toMatch(/^#[0-9a-f]{6}$/iu);
	});

	it('returns #dbeafe (light blue) at t=0', () => {
		expect(sequentialColorScale(0).toLowerCase()).toBe('#dbeafe');
	});

	it('returns #1e3a5f (dark blue) at t=1', () => {
		expect(sequentialColorScale(1).toLowerCase()).toBe('#1e3a5f');
	});

	it('clamps values outside [0,1]', () => {
		expect(sequentialColorScale(-1)).toBe(sequentialColorScale(0));
		expect(sequentialColorScale(2)).toBe(sequentialColorScale(1));
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeValue
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeValue', () => {
	it('returns 0 for the minimum value', () => {
		expect(normalizeValue(10, 10, 100)).toBeCloseTo(0);
	});

	it('returns 1 for the maximum value', () => {
		expect(normalizeValue(100, 10, 100)).toBeCloseTo(1);
	});

	it('returns 0.5 when min === max', () => {
		expect(normalizeValue(5, 5, 5)).toBeCloseTo(0.5);
	});

	it('scales linearly', () => {
		expect(normalizeValue(55, 10, 100)).toBeCloseTo(0.5);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWaterfallViewModel — basic structure
// ─────────────────────────────────────────────────────────────────────────────

describe('buildWaterfallViewModel — basic structure', () => {
	const el = makeElement();
	const data = makeWaterfallData([10, 20, -5, 30]);
	const labels = data.categories;

	it('does not crash', () => {
		expect(() => buildWaterfallViewModel(el, data, labels)).not.toThrow();
	});

	it('returns a valid ChartViewModel shape', () => {
		const vm = buildWaterfallViewModel(el, data, labels);
		expect(vm).toHaveProperty('primitives');
		expect(vm).toHaveProperty('gridlines');
		expect(vm).toHaveProperty('axisLabels');
		expect(vm).toHaveProperty('categoryLabels');
	});

	it('produces exactly N bar rects for N values', () => {
		const vm = buildWaterfallViewModel(el, data, labels);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(4);
	});

	it('all bar rects have positive width and height', () => {
		const vm = buildWaterfallViewModel(el, data, labels);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		for (const r of rects) {
			if (r.kind === 'rect') {
				expect(r.w).toBeGreaterThan(0);
				expect(r.h).toBeGreaterThan(0);
			}
		}
	});

	it('produces N-1 connector lines between bars', () => {
		// 4 values → 3 connectors (between bar 0-1, 1-2, 2-3; NOT after the last bar).
		const vm = buildWaterfallViewModel(el, data, labels);
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(3);
	});

	it('includes cartesian gridlines and axis labels', () => {
		const vm = buildWaterfallViewModel(el, data, labels);
		expect(vm.gridlines.length).toBeGreaterThan(0);
		expect(vm.axisLabels.length).toBeGreaterThan(0);
	});

	it('includes category labels for each value', () => {
		const vm = buildWaterfallViewModel(el, data, labels);
		expect(vm.categoryLabels).toHaveLength(4);
		expect(vm.categoryLabels[0].text).toBe('Cat1');
	});

	it('includes a legend entry per series when hasLegend is true', () => {
		const withLegend: PptxChartData = {
			...data,
			style: { hasLegend: true },
		};
		const vm = buildWaterfallViewModel(el, withLegend, labels);
		expect(vm.legend).toHaveLength(1);
		expect(vm.legend[0].label).toBe('S');
	});

	it('produces no data labels when hasDataLabels is absent', () => {
		const vm = buildWaterfallViewModel(el, data, labels);
		expect(vm.dataLabels).toHaveLength(0);
	});

	it('produces data labels when hasDataLabels is true', () => {
		const withLabels: PptxChartData = {
			...data,
			style: { hasDataLabels: true },
		};
		const vm = buildWaterfallViewModel(el, withLabels, labels);
		expect(vm.dataLabels).toHaveLength(4);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWaterfallViewModel — running-total colouring
// ─────────────────────────────────────────────────────────────────────────────

describe('buildWaterfallViewModel — running-total colouring', () => {
	it('uses green fill for positive, red for negative, indigo for total bar', () => {
		const el = makeElement();
		const data = makeWaterfallData([10, -5, 20]);
		const vm = buildWaterfallViewModel(el, data, data.categories);
		const rects = vm.primitives
			.filter((p) => p.kind === 'rect')
			.map((p) => (p.kind === 'rect' ? p.fill : ''));

		// value[0] = 10 → green
		expect(rects[0]).toBe('#22c55e');
		// value[1] = -5 → red
		expect(rects[1]).toBe('#ef4444');
		// value[2] = 20, isLast → indigo total
		expect(rects[2]).toBe('#6366f1');
	});

	it('uses typed subtotal colors, preserves source indexes, and can hide connectors', () => {
		const data: PptxChartData = {
			chartType: 'waterfall',
			categories: ['Opening', 'Gain', 'Subtotal', 'Loss', 'Total'],
			series: [
				{
					name: 'S',
					values: [100, 25, 125, -20, 105],
					waterfallOptions: { subtotalIndices: [0, 2, 4], connectorLines: false },
				},
			],
			style: { hasDataLabels: true },
		};
		const vm = buildWaterfallViewModel(makeElement(), data, data.categories);
		const rects = vm.primitives.filter((primitive) => primitive.kind === 'rect');
		expect(rects.map((rect) => rect.fill)).toStrictEqual([
			'#6366f1',
			'#22c55e',
			'#6366f1',
			'#ef4444',
			'#6366f1',
		]);
		expect(rects.map((rect) => rect.part?.pointIndex)).toStrictEqual([0, 1, 2, 3, 4]);
		expect(vm.primitives.filter((primitive) => primitive.kind === 'line')).toHaveLength(0);
		expect(vm.dataLabels.map((label) => label.text)).toStrictEqual([
			'100',
			'25',
			'125',
			'-20',
			'105',
		]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWaterfallViewModel — running-total bar positions
// ─────────────────────────────────────────────────────────────────────────────

describe('buildWaterfallViewModel — running total produces correct bar count', () => {
	it('produces exactly 5 bars for 5 values', () => {
		const el = makeElement();
		const data = makeWaterfallData([5, 10, -3, 8, 2]);
		const vm = buildWaterfallViewModel(el, data, data.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(5);
	});

	it('produces N-1 connector lines for N values', () => {
		const el = makeElement();
		const data = makeWaterfallData([5, 10, -3, 8, 2]);
		const vm = buildWaterfallViewModel(el, data, data.categories);
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(4);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildWaterfallViewModel — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('buildWaterfallViewModel — edge cases', () => {
	it('does not crash on an empty series', () => {
		const el = makeElement();
		const data: PptxChartData = { chartType: 'waterfall', categories: [], series: [] };
		expect(() => buildWaterfallViewModel(el, data, [])).not.toThrow();
	});

	it('handles a single-value waterfall (just a total bar, no connectors)', () => {
		const el = makeElement();
		const data = makeWaterfallData([42]);
		const vm = buildWaterfallViewModel(el, data, data.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(rects).toHaveLength(1);
		expect(lines).toHaveLength(0);
	});

	it('bars with zero value still produce a non-zero-height rect (min h=1)', () => {
		const el = makeElement();
		const data = makeWaterfallData([0, 10, 0]);
		const vm = buildWaterfallViewModel(el, data, data.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		for (const r of rects) {
			if (r.kind === 'rect') {
				expect(r.h).toBeGreaterThanOrEqual(1);
			}
		}
	});

	it('svgWidth and svgHeight are at least 320x180', () => {
		const el = makeElement(10, 10);
		const data = makeWaterfallData([10, 20]);
		const vm = buildWaterfallViewModel(el, data, data.categories);
		expect(vm.svgWidth).toBeGreaterThanOrEqual(320);
		expect(vm.svgHeight).toBeGreaterThanOrEqual(180);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRegionMapViewModel — basic structure
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRegionMapViewModel — basic structure', () => {
	const el = makeElement(600, 400);
	const data: PptxChartData = {
		chartType: 'regionMap',
		categories: ['US', 'DE', 'GB', 'FR', 'JP'],
		series: [{ name: 'Values', values: [100, 80, 60, 40, 20] }],
	};
	const labels = data.categories;

	it('does not crash', () => {
		expect(() => buildRegionMapViewModel(el, data, labels)).not.toThrow();
	});

	it('returns a valid ChartViewModel shape', () => {
		const vm = buildRegionMapViewModel(el, data, labels);
		expect(vm).toHaveProperty('primitives');
		expect(vm).toHaveProperty('svgWidth');
		expect(vm).toHaveProperty('svgHeight');
	});

	it('produces SvgPath primitives for recognized regions', () => {
		const vm = buildRegionMapViewModel(el, data, labels);
		const paths = vm.primitives.filter((p) => p.kind === 'path');
		// All 22 world regions are always drawn (even if no data).
		expect(paths).toHaveLength(22);
	});

	it('has no cartesian gridlines, axisLabels, or zeroLine', () => {
		const vm = buildRegionMapViewModel(el, data, labels);
		expect(vm.gridlines).toHaveLength(0);
		expect(vm.axisLabels).toHaveLength(0);
		expect(vm.zeroLine).toBeUndefined();
	});

	it('produces inline data labels for matched regions', () => {
		const vm = buildRegionMapViewModel(el, data, labels);
		// Text primitives that come from data labels (value annotations on the map).
		const texts = vm.primitives.filter((p) => p.kind === 'text');
		// Should have at least one label per matched region.
		expect(texts.length).toBeGreaterThan(0);
	});

	it('svgWidth and svgHeight enforce minimum sizes', () => {
		const smallEl = makeElement(50, 50);
		const vm = buildRegionMapViewModel(smallEl, data, labels);
		expect(vm.svgWidth).toBeGreaterThanOrEqual(320);
		expect(vm.svgHeight).toBeGreaterThanOrEqual(200);
	});

	it('includes a legend colour bar (rect primitives) for the scale', () => {
		const vm = buildRegionMapViewModel(el, data, labels);
		// The background rect + the gradient bar segments all appear as rects.
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects.length).toBeGreaterThan(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRegionMapViewModel — unmatched regions
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRegionMapViewModel — unmatched regions', () => {
	it('does not crash when categories do not match any region', () => {
		const el = makeElement();
		const data: PptxChartData = {
			chartType: 'regionMap',
			categories: ['Narnia', 'Mordor', 'Hogwarts'],
			series: [{ name: 'S', values: [1, 2, 3] }],
		};
		expect(() => buildRegionMapViewModel(el, data, data.categories)).not.toThrow();
	});

	it('renders a fallback table label for unmatched regions', () => {
		const el = makeElement(400, 400);
		const data: PptxChartData = {
			chartType: 'regionMap',
			categories: ['Narnia'],
			series: [{ name: 'S', values: [99] }],
		};
		const vm = buildRegionMapViewModel(el, data, data.categories);
		// The "Additional regions" header text should be present.
		const texts = [...vm.primitives.filter((p) => p.kind === 'text'), ...vm.dataLabels].map((p) =>
			p.kind === 'text' ? p.text : '',
		);
		expect(texts.some((t) => t.includes('Additional regions'))).toBeTruthy();
	});

	it('renders "+N more regions" when more than 5 unmatched', () => {
		const el = makeElement(400, 600);
		const manyUnmatched = Array.from({ length: 8 }, (_, i) => `Place${i}`);
		const data: PptxChartData = {
			chartType: 'regionMap',
			categories: manyUnmatched,
			series: [{ name: 'S', values: manyUnmatched.map((_, i) => i + 1) }],
		};
		const vm = buildRegionMapViewModel(el, data, data.categories);
		const texts = vm.primitives
			.filter((p) => p.kind === 'text')
			.map((p) => (p.kind === 'text' ? p.text : ''));
		expect(texts.some((t) => t.includes('more regions'))).toBeTruthy();
	});
});

describe('buildRegionMapViewModel — ChartEx geography options', () => {
	const el = makeElement(600, 400);
	const regionData = (
		regionLabelLayout: 'none' | 'bestFitOnly' | 'showAll',
		viewedRegionType: 'world' | 'dataOnly' = 'world',
	): PptxChartData => ({
		chartType: 'regionMap',
		categories: ['Opaque provider category'],
		series: [
			{
				name: 'Values',
				values: [1234.5],
				regionMapOptions: {
					entityIds: ['country:AU'],
					categorySourceIndices: [7],
					valueSourceIndices: [7],
					entityIdSourceIndices: [7],
					regionLabelLayout,
					viewedRegionType,
					cultureLanguage: 'de-DE',
					attribution: 'Bing',
				},
			},
		],
	});

	it('matches entity IDs and retains the source index on the map path', () => {
		const data = regionData('showAll');
		const vm = buildRegionMapViewModel(el, data, data.categories);
		const matched = vm.primitives.find(
			(primitive) =>
				primitive.kind === 'path' &&
				primitive.part?.role === 'dataPoint' &&
				primitive.part.pointIndex === 7,
		);
		expect(matched).toBeDefined();
		expect(
			vm.primitives.some((item) => item.kind === 'text' && item.text === '1.234,5'),
		).toBeTruthy();
		expect(vm.primitives.some((item) => item.kind === 'text' && item.text === 'Bing')).toBeTruthy();
	});

	it('suppresses region labels when regionLabelLayout is none', () => {
		const data = regionData('none');
		const vm = buildRegionMapViewModel(el, data, data.categories);
		expect(
			vm.primitives.some((item) => item.kind === 'text' && item.text === '1.234,5'),
		).toBeFalsy();
	});

	it('zooms dataOnly to the authored data regions instead of the whole world', () => {
		const world = regionData('showAll', 'world');
		const dataOnly = regionData('showAll', 'dataOnly');
		const matchedPath = (data: PptxChartData) =>
			buildRegionMapViewModel(el, data, data.categories).primitives.find(
				(item) => item.kind === 'path' && item.part?.pointIndex === 7,
			);
		expect(matchedPath(dataOnly)).not.toStrictEqual(matchedPath(world));
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRegionMapViewModel — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRegionMapViewModel — edge cases', () => {
	it('does not crash on an empty series', () => {
		const el = makeElement();
		const data: PptxChartData = { chartType: 'regionMap', categories: [], series: [] };
		expect(() => buildRegionMapViewModel(el, data, [])).not.toThrow();
	});

	it('returns a well-formed view-model for an empty chart', () => {
		const el = makeElement();
		const data: PptxChartData = { chartType: 'regionMap', categories: [], series: [] };
		const vm = buildRegionMapViewModel(el, data, []);
		expect(vm.svgWidth).toBeGreaterThan(0);
		expect(vm.svgHeight).toBeGreaterThan(0);
		// All world regions still drawn, just with default colour.
		const paths = vm.primitives.filter((p) => p.kind === 'path');
		expect(paths).toHaveLength(22);
	});

	it('renders chart title in dataLabels when hasTitle/title are present', () => {
		const el = makeElement();
		const data: PptxChartData = {
			chartType: 'regionMap',
			categories: ['US'],
			series: [{ name: 'S', values: [50] }],
			title: 'World Sales',
			style: { hasTitle: true },
		};
		const vm = buildRegionMapViewModel(el, data, data.categories);
		const allTexts = vm.dataLabels.map((t) => t.text);
		expect(allTexts).toContain('World Sales');
	});
});
