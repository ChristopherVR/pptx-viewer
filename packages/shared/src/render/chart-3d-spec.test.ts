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

	it('returns a perspective surface spec for a 2D c:surfaceChart too (the surfaceChart3D opt-in covers both)', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'surface',
				categories: ['A', 'B'],
				series: [{ name: 'S1', values: [1, 2] }],
			}),
		);
		expect(spec?.geometry).toBeNull();
		expect(spec?.perspective?.kind).toBe('surface');
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
		expect(spec?.geometry).toBeNull(); // no oblique surface geometry
		expect(spec?.perspective?.kind).toBe('surface');
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

	it('lays a clustered bar3D chart out as one depth row, each bar as deep as it is wide', () => {
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
		expect(spec?.geometry?.kind).toBe('oblique');
		const layout = spec?.geometry?.kind === 'oblique' ? spec.geometry.layout : undefined;
		expect(layout?.bars).toHaveLength(4);
		for (const bar of layout?.bars ?? []) {
			expect(bar.d).toBeCloseTo(bar.w, 6);
			// Centred in the one row, which is barWidth * (1 + gapDepth 150%) deep.
			expect(bar.z).toBeCloseTo(0.75 * bar.w, 6);
			expect(layout?.box.d).toBeCloseTo(2.5 * bar.w, 6);
		}
	});

	it('puts each series of a standard bar3D chart on its own depth row', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'bar3D',
				grouping: 'clustered',
				groupingStandard: true,
				categories: ['Q1', 'Q2'],
				series: [
					{ name: 'Revenue', values: [100, 150] },
					{ name: 'Cost', values: [80, 90] },
				],
			}),
		);
		const layout = spec?.geometry?.kind === 'oblique' ? spec.geometry.layout : undefined;
		expect(layout?.grouping).toBe('standard');
		const front = layout?.bars.find((b) => b.seriesIndex === 0 && b.categoryIndex === 0);
		const back = layout?.bars.find((b) => b.seriesIndex === 1 && b.categoryIndex === 0);
		// Same category position, one row (2.5 bar widths) further back.
		expect(back?.x).toBeCloseTo(front?.x ?? Number.NaN, 6);
		expect((back?.z ?? 0) - (front?.z ?? 0)).toBeCloseTo(2.5 * (front?.w ?? 0), 6);
		expect(layout?.labels.filter((l) => l.role === 'series').map((l) => l.text)).toStrictEqual([
			'Revenue',
			'Cost',
		]);
	});

	it('lays a horizontal bar3D chart out along the value axis on X', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'bar3D',
				barDirection: 'bar',
				categories: ['Q1', 'Q2'],
				series: [{ name: 'Revenue', values: [100, 150] }],
			}),
		);
		const layout = spec?.geometry?.kind === 'oblique' ? spec.geometry.layout : undefined;
		expect(layout?.horizontal).toBeTruthy();
		const [q1, q2] = layout?.bars ?? [];
		expect(q1.x).toBe(0);
		expect(q2.w / q1.w).toBeCloseTo(1.5, 6);
		// Category 1 at the bottom.
		expect(q1.y).toBeLessThan(q2.y);
		// Back-wall gridlines are vertical.
		const back = layout?.gridlines[0];
		expect(back?.from[0]).toBe(back?.to[0]);
	});

	it('uses the oblique geometry when every series is a box, via c:ser/c:shape or the chart level', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'bar3D',
				categories: ['Q1'],
				series: [{ name: 'A', values: [1], shape: 'box' }],
			}),
		);
		expect(spec?.geometry?.kind).toBe('oblique');
	});

	it('lays round and pointed c:shape bars out on the oblique box, per-series shape winning', () => {
		for (const shape of ['cylinder', 'cone', 'pyramid', 'coneToMax'] as const) {
			const spec = buildChart3DSpecForElement(
				chartEl({
					chartType: 'bar3D',
					barShape: shape,
					categories: ['Q1'],
					series: [
						{ name: 'A', values: [1] },
						{ name: 'B', values: [2], shape: 'box' },
					],
				}),
			);
			expect(spec?.perspective).toBeNull();
			if (spec?.geometry?.kind !== 'oblique') {
				throw new Error('expected oblique geometry');
			}
			expect(spec.geometry.layout.bars.map((b) => b.shape)).toStrictEqual([shape, 'box']);
		}
	});

	it('gives an oblique bar spec no perspective scene, and each bar its authored value', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({
				chartType: 'bar3D',
				categories: ['Q1', 'Q2'],
				series: [{ name: 'Revenue', values: [100, 150] }],
			}),
		);
		expect(spec?.perspective).toBeNull();
		const bars = spec?.geometry?.kind === 'oblique' ? spec.geometry.layout.bars : [];
		expect(bars.map((b) => b.value)).toStrictEqual([100, 150]);
		expect(spec?.categoryLabels).toStrictEqual(['Q1', 'Q2']);
	});

	it('routes line3D / area3D / pie3D to their perspective scenes', () => {
		for (const [chartType, kind] of [
			['line3D', 'line'],
			['area3D', 'area'],
			['pie3D', 'pie'],
		] as const) {
			const spec = buildChart3DSpecForElement(
				chartEl({
					chartType,
					categories: ['A', 'B'],
					series: [{ name: 'S1', values: [1, 2] }],
				}),
			);
			expect(spec?.geometry).toBeNull();
			expect(spec?.perspective?.kind).toBe(kind);
		}
	});

	it('numbers the categories 1..n when the chart has none', () => {
		const spec = buildChart3DSpecForElement(
			chartEl({ chartType: 'line3D', categories: [], series: [{ name: 'S1', values: [1, 2, 3] }] }),
		);
		expect(spec?.categoryLabels).toStrictEqual(['1', '2', '3']);
	});
});
