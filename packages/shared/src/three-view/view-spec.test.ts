/**
 * Unit tests for view-spec.ts: which `<pptx-three-view>` spec (if any) a
 * chart or SmartArt element resolves to, and that specs are memoised by
 * element identity so a re-render with the same element never remounts the
 * view.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	chartThreeViewSpec,
	differsOnlyInPosition,
	isChart3DViewEnabled,
	resolveChartThreeViewSpec,
	resolveSmartArtThreeViewSpec,
} from './view-spec';

function chartElement(chartType: string): PptxElement {
	return {
		id: 'el-1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: { chartType, categories: ['A'], series: [{ name: 'S', values: [1] }] },
	} as unknown as PptxElement;
}

function shapeElement(): PptxElement {
	return {
		id: 'el-2',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as unknown as PptxElement;
}

describe('isChart3DViewEnabled', () => {
	it('gates each raw chart type on its own flag', () => {
		expect(isChart3DViewEnabled({ barChart3D: true }, 'bar3D')).toBeTruthy();
		expect(isChart3DViewEnabled({ barChart3D: false }, 'bar3D')).toBeFalsy();
		expect(isChart3DViewEnabled({ lineChart3D: true }, 'line3D')).toBeTruthy();
		expect(isChart3DViewEnabled({ areaChart3D: true }, 'area3D')).toBeTruthy();
		expect(isChart3DViewEnabled({ pieChart3D: true }, 'pie3D')).toBeTruthy();
		expect(isChart3DViewEnabled({ surfaceChart3D: true }, 'surface')).toBeTruthy();
	});

	it('never enables a plain 2D chart type even with every flag on', () => {
		expect(
			isChart3DViewEnabled(
				{
					barChart3D: true,
					lineChart3D: true,
					areaChart3D: true,
					pieChart3D: true,
					surfaceChart3D: true,
				},
				'bar',
			),
		).toBeFalsy();
	});

	it('is false with no flags or no chart type', () => {
		expect(isChart3DViewEnabled(null, 'bar3D')).toBeFalsy();
		expect(isChart3DViewEnabled({ barChart3D: true }, undefined)).toBeFalsy();
	});
});

describe('chartThreeViewSpec', () => {
	it('builds a chart view spec for a 3D chart type', () => {
		const el = chartElement('bar3D');
		const spec = chartThreeViewSpec(el);
		expect(spec?.kind).toBe('chart');
	});

	it('is null for a non-3D chart type', () => {
		expect(chartThreeViewSpec(chartElement('bar'))).toBeNull();
	});

	it('memoises by element identity: the same element yields the same spec object', () => {
		const el = chartElement('pie3D');
		const first = chartThreeViewSpec(el);
		const second = chartThreeViewSpec(el);
		expect(first).toBe(second);
	});

	it('a different element object yields a different spec object', () => {
		const first = chartThreeViewSpec(chartElement('pie3D'));
		const second = chartThreeViewSpec(chartElement('pie3D'));
		expect(first).not.toBe(second);
	});

	it('keeps the spec when a move only changes x/y, so the scene is not rebuilt', () => {
		const el = chartElement('bar3D');
		const first = chartThreeViewSpec(el);
		const moved = { ...el, x: 40, y: 25 } as PptxElement;
		expect(chartThreeViewSpec(moved)).toBe(first);
	});

	it('rebuilds the spec when a resize changes more than the position', () => {
		const el = chartElement('bar3D');
		const first = chartThreeViewSpec(el);
		const resized = { ...el, width: 500 } as PptxElement;
		expect(chartThreeViewSpec(resized)).not.toBe(first);
	});
});

describe('differsOnlyInPosition', () => {
	it('ignores x and y and compares every other field by identity', () => {
		const el = chartElement('bar3D');
		expect(differsOnlyInPosition(el, { ...el, x: 9, y: 9 } as PptxElement)).toBeTruthy();
		expect(differsOnlyInPosition(el, { ...el, rotation: 5 } as PptxElement)).toBeFalsy();
	});
});

describe('resolveChartThreeViewSpec', () => {
	it('is null when the flag for this chart type is off', () => {
		expect(resolveChartThreeViewSpec(chartElement('bar3D'), { barChart3D: false })).toBeNull();
	});

	it('is null for a non-chart element', () => {
		expect(resolveChartThreeViewSpec(shapeElement(), { barChart3D: true })).toBeNull();
	});

	it('resolves the spec when the matching flag is on', () => {
		expect(resolveChartThreeViewSpec(chartElement('bar3D'), { barChart3D: true })?.kind).toBe(
			'chart',
		);
	});
});

describe('resolveSmartArtThreeViewSpec', () => {
	it('is null when smartArt3D is off', () => {
		expect(resolveSmartArtThreeViewSpec(shapeElement(), false)).toBeNull();
	});

	it('is null for a non-SmartArt element even when the flag is on', () => {
		expect(resolveSmartArtThreeViewSpec(chartElement('bar3D'), true)).toBeNull();
	});
});
