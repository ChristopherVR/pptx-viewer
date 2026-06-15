import { mount } from '@vue/test-utils';
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import SurfaceChart from './SurfaceChart.vue';

// ── Fixtures ─────────────────────────────────────────────────────

const BASE_LAYOUT: PlotLayout = {
	plotLeft: 48,
	plotTop: 8,
	plotRight: 312,
	plotBottom: 256,
	plotWidth: 264,
	plotHeight: 248,
	svgWidth: 320,
	svgHeight: 264,
};

const BASE_RANGE: ValueRange = { min: 0, max: 100, span: 100 };

/** Build a PptxChartData with `seriesCount` series, each with `catCount` values. */
function makeData(seriesCount: number, catCount: number, baseValue = 50): PptxChartData {
	const series = Array.from({ length: seriesCount }, (_, si) => ({
		name: `Series ${si + 1}`,
		values: Array.from({ length: catCount }, (__, ci) => baseValue + si * 10 + ci * 5),
	}));
	const categories = Array.from({ length: catCount }, (_, i) => `Cat${i + 1}`);
	return {
		chartType: 'surface',
		categories,
		series,
	};
}

// ── Tests ─────────────────────────────────────────────────────────

describe('surfaceChart', () => {
	it('renders isometric mesh polygons for a 3×3 grid (2 series × 3 categories → 2 cells)', () => {
		// 2 series × 3 categories → cols=2, rows=1 → 2 cells, each with a fill+edge polygon
		const wrapper = mount(SurfaceChart, {
			props: {
				chartData: makeData(2, 3),
				layout: BASE_LAYOUT,
				range: BASE_RANGE,
				categories: ['A', 'B', 'C'],
			},
		});
		const polygons = wrapper.findAll('polygon');
		// 2 cells × 2 polygons each (fill + edge wireframe) = 4
		expect(polygons.length).toBeGreaterThanOrEqual(4);
		// No flat rects in isometric mode
		expect(wrapper.findAll('rect')).toHaveLength(0);
	});

	it('renders a 3×3 grid (3 series × 4 categories) producing 6 cells with 12 polygons', () => {
		// 3 series × 4 categories → cols=3, rows=2 → 6 cells × 2 polygons each = 12
		const wrapper = mount(SurfaceChart, {
			props: {
				chartData: makeData(3, 4),
				layout: BASE_LAYOUT,
				range: BASE_RANGE,
				categories: ['A', 'B', 'C', 'D'],
			},
		});
		const polygons = wrapper.findAll('polygon');
		expect(polygons).toHaveLength(12); // 6 cells × 2 (fill + edge)
	});

	it('renders nothing (no error) for empty series', () => {
		const wrapper = mount(SurfaceChart, {
			props: {
				chartData: makeData(0, 0),
				layout: BASE_LAYOUT,
				range: BASE_RANGE,
				categories: [],
			},
		});
		expect(wrapper.findAll('polygon')).toHaveLength(0);
		expect(wrapper.findAll('rect')).toHaveLength(0);
	});

	it('falls back to flat rects for a single series (degenerate grid)', () => {
		// Single series → cannot form isometric quads → flat heat grid
		const wrapper = mount(SurfaceChart, {
			props: {
				chartData: makeData(1, 3),
				layout: BASE_LAYOUT,
				range: BASE_RANGE,
				categories: ['A', 'B', 'C'],
			},
		});
		expect(wrapper.findAll('polygon')).toHaveLength(0);
		// 1 series × 3 categories = 3 flat rects
		expect(wrapper.findAll('rect')).toHaveLength(3);
	});

	it('colours vary by value: fill attributes differ across quads', () => {
		// Use a wide value spread so the colour ramp produces visibly different fills.
		const data = makeData(3, 4, 0);
		// Override to produce a clear low/high contrast.
		data.series[0]!.values = [0, 0, 0, 0];
		data.series[1]!.values = [50, 50, 50, 50];
		data.series[2]!.values = [100, 100, 100, 100];

		const wrapper = mount(SurfaceChart, {
			props: {
				chartData: data,
				layout: BASE_LAYOUT,
				range: { min: 0, max: 100, span: 100 },
				categories: ['A', 'B', 'C', 'D'],
			},
		});

		// Collect fill attribute values from the face polygons (every other polygon
		// is the edge overlay with fill="none").
		const polygons = wrapper.findAll('polygon');
		const fills = new Set(
			polygons
				.map((p) => p.attributes('fill'))
				.filter((f): f is string => f !== undefined && f !== 'none'),
		);
		// With value spread 0→100 across rows, at least 2 distinct fills must appear.
		expect(fills.size).toBeGreaterThanOrEqual(2);
	});

	it('renders with a zero-span range (all values equal) without throwing', () => {
		const data = makeData(3, 3, 42);
		// All values the same → span = 0 → every t = 0
		const flatRange: ValueRange = { min: 42, max: 42, span: 0 };
		const wrapper = mount(SurfaceChart, {
			props: {
				chartData: data,
				layout: BASE_LAYOUT,
				range: flatRange,
				categories: ['X', 'Y', 'Z'],
			},
		});
		// Still renders the mesh (degenerate heights but no crash)
		const polygons = wrapper.findAll('polygon');
		expect(polygons.length).toBeGreaterThanOrEqual(4); // 2×2 grid → 4 cells × 2 = 8
	});
});
