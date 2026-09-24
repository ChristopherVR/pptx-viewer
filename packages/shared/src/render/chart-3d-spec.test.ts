import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChart3DSpecForElement } from './chart-3d-spec';

function chartEl(chartData: PptxChartData, width = 400, height = 300): PptxElement {
	return {
		id: 'el-3d',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width,
		height,
		chartData,
	} as unknown as PptxElement;
}

describe('buildChart3DSpecForElement', () => {
	it('returns null for a non-chart element', () => {
		expect(
			buildChart3DSpecForElement({
				id: 'el-shape',
				type: 'shape',
				x: 0,
				y: 0,
				width: 10,
				height: 10,
			} as unknown as PptxElement),
		).toBeNull();
	});

	it('returns null for a flat (non-3D) bar chart', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({ chartType: 'bar', categories: ['A'], series: [{ name: 'S1', values: [1] }] }),
		);
		expect(spec).toBeNull();
	});

	it('returns null for a surface chart with no c:view3D (the 2D top-view variant)', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'surface',
				categories: ['A', 'B'],
				series: [{ name: 'S1', values: [1, 2] }],
			}),
		);
		expect(spec).toBeNull();
	});

	it('returns a spec for a surface chart that DOES carry c:view3D (surface3D)', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'surface',
				categories: ['A', 'B'],
				series: [{ name: 'S1', values: [1, 2] }],
				view3D: { rotX: 15, rotY: 20, rAngAx: false },
			}),
		);
		expect(spec).not.toBeNull();
		expect(spec?.geometry).toBeNull(); // surface geometry not yet implemented
	});

	it('resolves an oblique projection for a default bar3D chart', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'bar3D',
				categories: ['Q1', 'Q2'],
				series: [{ name: 'Revenue', values: [100, 150] }],
			}),
		);
		expect(spec).not.toBeNull();
		expect(spec?.projection.mode).toBe('oblique');
	});

	it('builds one box per data point for a clustered bar3D chart, positions matching the flat rects', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'bar3D',
				grouping: 'clustered',
				categories: ['Q1', 'Q2'],
				series: [
					{ name: 'Revenue', values: [100, 150] },
					{ name: 'Cost', values: [80, 90] },
				],
			}),
		);
		expect(spec?.geometry?.kind).toBe('bar');
		const boxes = spec?.geometry?.kind === 'bar' ? spec.geometry.boxes : [];
		expect(boxes).toHaveLength(4);
		// Every box in a clustered chart shares the SAME depth magnitude (one
		// coplanar Z plane), matching gt/chart-01.webp (no visible per-series
		// depth separation).
		const magnitudes = new Set(boxes.map((b) => b.depthMagnitude));
		expect(magnitudes.size).toBe(1);
		// Box x/y/w/h must equal the flat 2D fallback's own front-face rects
		// (the same underlying cartesian bar layout), so chrome and geometry
		// never disagree about where a bar sits.
		const flatRects = spec!.vm.primitives.filter(
			(p) => p.kind === 'rect' && p.part?.role === 'dataPoint',
		);
		expect(flatRects).toHaveLength(4);
		for (const rect of flatRects) {
			const box = boxes.find(
				(b) =>
					b.seriesIndex === rect.part?.seriesIndex && b.categoryIndex === rect.part?.pointIndex,
			);
			expect(box).toBeDefined();
			expect(box?.x).toBe((rect as { x: number }).x);
			expect(box?.w).toBe((rect as { w: number }).w);
		}
	});

	it('returns null geometry (falls back to the 2D render) for standard grouping', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'bar3D',
				// The core type only declares clustered/stacked/percentStacked;
				// "standard" flows through from the raw XML value untyped.
				grouping: 'standard' as PptxChartData['grouping'],
				categories: ['Q1', 'Q2'],
				series: [{ name: 'Revenue', values: [100, 150] }],
			}),
		);
		expect(spec).not.toBeNull();
		expect(spec?.geometry).toBeNull();
	});

	it('returns null geometry (falls back to the 2D render) for a horizontal bar3D chart', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'bar3D',
				barDirection: 'bar',
				categories: ['Q1', 'Q2'],
				series: [{ name: 'Revenue', values: [100, 150] }],
			}),
		);
		expect(spec?.geometry).toBeNull();
	});

	it('resolves each box shape from c:ser/c:shape, falling back to the chart-level c:shape', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'bar3D',
				barShape: 'cylinder',
				categories: ['Q1'],
				series: [
					{ name: 'A', values: [1] },
					{ name: 'B', values: [2], shape: 'cone' },
				],
			}),
		);
		const boxes = spec?.geometry?.kind === 'bar' ? spec.geometry.boxes : [];
		expect(boxes.find((b) => b.seriesIndex === 0)?.shape).toBe('cylinder');
		expect(boxes.find((b) => b.seriesIndex === 1)?.shape).toBe('cone');
	});
});
