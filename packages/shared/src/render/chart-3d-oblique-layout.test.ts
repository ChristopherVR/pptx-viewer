import { readFileSync } from 'node:fs';

import { PptxHandler } from 'pptx-viewer-core';
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	isObliqueBarDraggable,
	obliqueBarAtValue,
	obliqueDragValue,
	obliqueDraggedExtent,
} from './chart-3d-oblique-drag';
import { computeObliqueBarLayout, obliqueToScreen } from './chart-3d-oblique-layout';
import type { ObliqueChartLayout } from './chart-3d-oblique-layout';
import { buildChartViewModel } from './chart-view-model-build';

function barChart(chartData: Partial<PptxChartData> = {}): PptxElement {
	return {
		id: 'chart-1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 800,
		height: 450,
		chartData: {
			chartType: 'bar3D',
			grouping: 'clustered',
			categories: ['Q1', 'Q2', 'Q3'],
			series: [
				{ name: 'A', values: [1, 2, 3] },
				{ name: 'B', values: [2, 3, 4] },
			],
			view3D: { rotX: 15, rotY: 20, rAngAx: true },
			...chartData,
		},
	} as unknown as PptxElement;
}

function layoutOf(element: PptxElement): ObliqueChartLayout {
	const layout = computeObliqueBarLayout(element, buildChartViewModel(element));
	if (!layout) {
		throw new Error('expected a layout');
	}
	return layout;
}

describe('computeObliqueBarLayout', () => {
	it('gives each bar a depth equal to its width, centred in one row', () => {
		const layout = layoutOf(barChart());
		expect(layout.bars).toHaveLength(6);
		for (const bar of layout.bars) {
			expect(bar.d).toBeCloseTo(bar.w, 9);
			// gapDepth 150: row depth = 2.5 bar widths, the bar centred in it.
			expect(bar.z).toBeCloseTo(0.75 * bar.w, 9);
		}
		expect(layout.box.d).toBeCloseTo(2.5 * layout.bars[0].w, 9);
	});

	it('puts each standard series on its own depth row, series 1 in front', () => {
		const layout = layoutOf(barChart({ groupingStandard: true }));
		expect(layout.grouping).toBe('standard');
		const [a, b] = [layout.bars[0], layout.bars[1]];
		expect(a.seriesIndex).toBe(0);
		expect(b.seriesIndex).toBe(1);
		expect(b.z - a.z).toBeCloseTo(2.5 * a.w, 9);
		expect(a.x).toBeCloseTo(b.x, 9);
		expect(layout.labels.filter((l) => l.role === 'series').map((l) => l.text)).toStrictEqual([
			'A',
			'B',
		]);
	});

	it('stacks segments on a running sum and fills 0..1 for percentStacked', () => {
		const stacked = layoutOf(barChart({ grouping: 'stacked' }));
		const [a, b] = [stacked.bars[0], stacked.bars[1]];
		expect(b.y).toBeCloseTo(a.y + a.h, 9);
		const pct = layoutOf(barChart({ grouping: 'percentStacked' }));
		expect(pct.range).toStrictEqual({ min: 0, max: 1, majorUnit: 0.1 });
		expect(pct.bars[0].h + pct.bars[1].h).toBeCloseTo(pct.box.h, 9);
		expect(pct.labels.find((l) => l.role === 'value' && l.text === '50%')).toBeDefined();
	});

	it('uses no value-axis headroom (data topping at 4 gets a 0..4 axis)', () => {
		expect(layoutOf(barChart()).range.max).toBe(4);
	});

	it('honours explicit value-axis bounds', () => {
		const layout = layoutOf(
			barChart({
				axes: [{ axisType: 'valAx', min: 0, max: 10, majorUnit: 5 }],
			} as Partial<PptxChartData>),
		);
		expect(layout.range).toStrictEqual({ min: 0, max: 10, majorUnit: 5 });
	});

	it('lays a horizontal chart value-along-X with category labels on the left', () => {
		const layout = layoutOf(barChart({ barDirection: 'bar' }));
		expect(layout.horizontal).toBeTruthy();
		const bar = layout.bars[0];
		expect(bar.x).toBe(0);
		expect(bar.w).toBeCloseTo(layout.valueScale, 9);
		const category = layout.labels.find((l) => l.role === 'category');
		expect(category?.anchor).toBe('end');
		expect(category!.x).toBeLessThan(layout.origin.x);
	});

	it('shears depth up and to the right on screen', () => {
		const layout = layoutOf(barChart());
		const front = obliqueToScreen(layout, [0, 0, 0]);
		const back = obliqueToScreen(layout, [0, 0, 10]);
		expect(back.x - front.x).toBeCloseTo(10 * Math.sin(Math.PI / 9), 9);
		expect(back.y - front.y).toBeCloseTo(-10 * Math.sin(Math.PI / 12), 9);
	});

	it('matches PowerPoint on the ground-truth deck (gt/chart-01) within 3pt', async () => {
		const buf = readFileSync(
			new URL('../../../../e2e/fixtures/three-d-parity/three-d-charts.pptx', import.meta.url),
		);
		const data = await new PptxHandler().load(
			buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
		);
		const el = data.slides[0].elements.find((e) => e.type === 'chart');
		if (!el) {
			throw new Error('expected a chart on slide 1');
		}
		const vm = buildChartViewModel(el);
		const layout = computeObliqueBarLayout(el, vm);
		if (!layout) {
			throw new Error('expected a layout');
		}
		// Chart px -> slide pt (the element's px box is the chart frame).
		const toPt = (p: { x: number; y: number }): { x: number; y: number } => ({
			x: (el.x + (p.x * el.width) / vm.svgWidth) * 0.75,
			y: (el.y + (p.y * el.height) / vm.svgHeight) * 0.75,
		});
		const frontLeft = toPt(obliqueToScreen(layout, [0, 0, 0]));
		const backRight = toPt(obliqueToScreen(layout, [layout.box.w, 0, layout.box.d]));
		// Measured on gt/chart-01.webp (960x540, 1 px = 1 pt).
		expect(Math.abs(frontLeft.x - 110.5)).toBeLessThan(3);
		expect(Math.abs(frontLeft.y - 442.5)).toBeLessThan(3);
		expect(Math.abs(backRight.x - 870)).toBeLessThan(3);
	});
});

describe('oblique bar drag', () => {
	it('drags clustered and standard bars only', () => {
		expect(isObliqueBarDraggable({ grouping: 'clustered' })).toBeTruthy();
		expect(isObliqueBarDraggable({ grouping: 'standard' })).toBeTruthy();
		expect(isObliqueBarDraggable({ grouping: 'stacked' })).toBeFalsy();
		expect(isObliqueBarDraggable({ grouping: 'percentStacked' })).toBeFalsy();
	});

	it('maps pointer px to value along the value axis, up or right = larger', () => {
		const range = { min: 0, max: 10, majorUnit: 2 };
		const column = { horizontal: false, range, valueScale: 20 };
		expect(obliqueDragValue(column, 4, 0, -40)).toBeCloseTo(6, 9);
		expect(obliqueDragValue(column, 4, 100, 0)).toBeCloseTo(4, 9);
		const bar = { horizontal: true, range, valueScale: 20 };
		expect(obliqueDragValue(bar, 4, 40, 0)).toBeCloseTo(6, 9);
	});

	it('keeps the baseline end fixed and clips to the axis', () => {
		const layout = { horizontal: false, range: { min: 0, max: 10, majorUnit: 2 }, valueScale: 20 };
		expect(obliqueDraggedExtent(layout, 5)).toStrictEqual({ from: 0, length: 100 });
		expect(obliqueDraggedExtent(layout, 50)).toStrictEqual({ from: 0, length: 200 });
		const bar = {
			x: 1,
			y: 0,
			z: 2,
			w: 10,
			h: 40,
			d: 10,
			color: '#000',
			seriesIndex: 0,
			categoryIndex: 0,
			value: 2,
		};
		expect(obliqueBarAtValue(layout, bar, 3)).toMatchObject({ x: 1, y: 0, h: 60, w: 10 });
	});
});
