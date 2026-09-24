import { readFileSync } from 'node:fs';

import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { perspToScreen } from './chart-3d-persp-view';
import { computePieChartLayout, widenPieViewModel } from './chart-3d-pie-layout';
import { pieFaceShade } from './chart-3d-pie-marks';
import { buildChartViewModel } from './chart-view-model-build';

async function deckChart(slide: number): Promise<PptxElement> {
	const buf = readFileSync(
		new URL('../../../../e2e/fixtures/three-d-parity/three-d-charts.pptx', import.meta.url),
	);
	const data = await new PptxHandler().load(
		buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
	);
	const el = data.slides[slide - 1].elements.find((e) => e.type === 'chart');
	if (!el) {
		throw new Error(`no chart on slide ${slide}`);
	}
	return el;
}

async function layoutOf(slide: number) {
	const el = await deckChart(slide);
	const vm = widenPieViewModel(buildChartViewModel(el), el);
	const layout = computePieChartLayout(el, vm);
	if (!layout) {
		throw new Error('expected a layout');
	}
	const toPt = (p: { x: number; y: number }) => ({
		x: (el.x + (p.x * el.width) / vm.svgWidth) * 0.75,
		y: (el.y + (p.y * el.height) / vm.svgHeight) * 0.75,
	});
	return { el, vm, layout, toPt };
}

describe('computePieChartLayout', () => {
	it('widens the square pie view model to the frame', async () => {
		const { el, vm } = await layoutOf(14);
		expect(vm.svgWidth / vm.svgHeight).toBeCloseTo(el.width / el.height, 6);
	});

	it('matches PowerPoint on gt/chart-14 within 12pt', async () => {
		const { layout, toPt } = await layoutOf(14);
		const { x, y, z } = layout.center;
		const near = (p: { x: number; y: number }, px: number, py: number) => {
			const at = toPt(p);
			expect(Math.abs(at.x - px)).toBeLessThan(12);
			expect(Math.abs(at.y - py)).toBeLessThan(12);
		};
		near(perspToScreen(layout.view, [x, y, z]), 480, 208);
		near(perspToScreen(layout.view, [x, y, z + 1]), 480, 87);
		near(perspToScreen(layout.view, [x, y, z - 1]), 480, 383);
		near(perspToScreen(layout.view, [x, 0, z - 1]), 480, 455);
	});

	it('starts at 12 o clock, runs clockwise and covers the full turn', async () => {
		const { layout } = await layoutOf(14);
		expect(layout.slices[0].startAngle).toBe(0);
		expect(layout.slices.at(-1)?.endAngle).toBeCloseTo(Math.PI * 2, 9);
		expect(Math.hypot(layout.slices[0].offset.x, layout.slices[0].offset.z)).toBe(0);
	});

	it('shrinks an exploded pie and moves each slice out along its bisector', async () => {
		const { layout } = await layoutOf(15);
		expect(layout.radius).toBeCloseTo(1 / 1.25, 9);
		for (const s of layout.slices) {
			const mid = (s.startAngle + s.endAngle) / 2;
			expect(Math.hypot(s.offset.x, s.offset.z)).toBeCloseTo(0.25 * layout.radius, 9);
			expect(Math.atan2(s.offset.x, s.offset.z)).toBeCloseTo(
				Math.atan2(Math.sin(mid), Math.cos(mid)),
				9,
			);
		}
	});
});

describe('pieFaceShade', () => {
	it('keeps the top face and darkens the rim from left to right', () => {
		expect(pieFaceShade(0, 1, 0)).toBe(1);
		const left = pieFaceShade(-0.9, 0, -0.4);
		const front = pieFaceShade(0, 0, -1);
		const right = pieFaceShade(0.9, 0, -0.4);
		expect(left).toBeGreaterThan(front);
		expect(front).toBeGreaterThan(right);
		expect(right).toBeCloseTo(0.385, 9);
	});
});
