import { readFileSync } from 'node:fs';

import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computePerspChartLayout } from './chart-3d-persp-layout';
import { buildPerspPrisms, perspRowSpan } from './chart-3d-persp-marks';
import { perspToScreen } from './chart-3d-persp-view';
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

function layoutOf(el: PptxElement) {
	const vm = buildChartViewModel(el);
	const layout = computePerspChartLayout(el, vm);
	if (!layout) {
		throw new Error('expected a layout');
	}
	return { vm, layout };
}

describe('computePerspChartLayout', () => {
	it('matches PowerPoint on gt/chart-10 (3-D Line) within 12pt', async () => {
		const el = await deckChart(10);
		const { vm, layout } = layoutOf(el);
		const toPt = (p: { x: number; y: number }) => ({
			x: (el.x + (p.x * el.width) / vm.svgWidth) * 0.75,
			y: (el.y + (p.y * el.height) / vm.svgHeight) * 0.75,
		});
		const { w, h, d } = layout.view.box;
		const check = (p: readonly [number, number, number], x: number, y: number) => {
			const at = toPt(perspToScreen(layout.view, p));
			expect(Math.abs(at.x - x)).toBeLessThan(12);
			expect(Math.abs(at.y - y)).toBeLessThan(12);
		};
		check([0, 0, 0], 139, 361.5);
		check([0, h, 0], 125, 147);
		check([0, h, d], 328, 88);
		check([w, h, d], 817, 112.5);
		check([w, 0, 0], 745, 438.5);
		expect(layout.range).toStrictEqual({ min: 0, max: 5, majorUnit: 0.5 });
		expect(layout.rows).toBe(3);
	});

	it('puts area points on the walls (midCat) and each standard series on its own row', async () => {
		const { layout } = layoutOf(await deckChart(11));
		expect(layout.categoryX[0]).toBe(0);
		expect(layout.categoryX.at(-1)).toBe(1);
		expect(layout.rows).toBe(2);
		expect(layout.markDepth).toBeCloseTo(layout.rowDepth / 2.5, 9);
	});

	it('stacks stacked areas on one row, percent normalised to the box height', async () => {
		const el = await deckChart(13);
		const { layout } = layoutOf(el);
		expect(layout.rows).toBe(1);
		expect(layout.grouping).toBe('percentStacked');
		const prisms = buildPerspPrisms(el.type === 'chart' ? el.chartData! : ({} as never), layout);
		const top = Math.max(...prisms[1].outline.map(([, y]) => y));
		expect(top).toBeCloseTo(layout.view.box.h, 6);
		expect(prisms[0].z0).toBe(prisms[1].z0);
		expect(perspRowSpan(layout, 0)).toStrictEqual([prisms[0].z0, prisms[0].z1]);
	});

	it('labels values, categories and (standard) series rows', async () => {
		const { layout } = layoutOf(await deckChart(10));
		const roles = (r: string) => layout.labels.filter((l) => l.role === r).map((l) => l.text);
		expect(roles('value')).toHaveLength(11);
		expect(roles('category')).toStrictEqual([
			'Category 1',
			'Category 2',
			'Category 3',
			'Category 4',
		]);
		expect(roles('series')).toStrictEqual(['Series 1', 'Series 2', 'Series 3']);
	});
});
