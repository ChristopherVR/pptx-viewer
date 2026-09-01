import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	BAR3D_SHAPE_OPTIONS,
	bar3DShapePatch,
	RADAR_STYLE_OPTIONS,
	radarStylePatch,
	SURFACE_WIREFRAME_OPTIONS,
	surfaceWireframePatch,
} from './chart-subtype-options';

function bar3DChart(): PptxChartData {
	return { chartType: 'bar3D', categories: ['A'], series: [{ name: 'S1', values: [1] }] };
}

function radarChart(): PptxChartData {
	return { chartType: 'radar', categories: ['A'], series: [{ name: 'S1', values: [1] }] };
}

function surfaceChart(): PptxChartData {
	return { chartType: 'surface', categories: ['A'], series: [{ name: 'S1', values: [1] }] };
}

function barChart(): PptxChartData {
	return { chartType: 'bar', categories: ['A'], series: [{ name: 'S1', values: [1] }] };
}

describe('option lists', () => {
	it('bar3d shape options list every ST_Shape value exactly once', () => {
		const values = BAR3D_SHAPE_OPTIONS.map((o) => o.value);
		expect(new Set(values).size).toBe(6);
		expect(values.sort()).toStrictEqual(
			['box', 'cone', 'coneToMax', 'cylinder', 'pyramid', 'pyramidToMax'].sort(),
		);
	});

	it('radar style options list standard/marker/filled', () => {
		expect(RADAR_STYLE_OPTIONS.map((o) => o.value)).toStrictEqual(['standard', 'marker', 'filled']);
	});

	it('surface wireframe options list true/false', () => {
		expect(SURFACE_WIREFRAME_OPTIONS.map((o) => o.value)).toStrictEqual(['true', 'false']);
	});

	it('every option carries a non-empty labelKey', () => {
		for (const opt of [
			...BAR3D_SHAPE_OPTIONS,
			...RADAR_STYLE_OPTIONS,
			...SURFACE_WIREFRAME_OPTIONS,
		]) {
			expect(opt.labelKey.length).toBeGreaterThan(0);
		}
	});
});

describe('bar3DShapePatch', () => {
	it('returns { barShape } for a bar3D chart', () => {
		expect(bar3DShapePatch(bar3DChart(), 'cylinder')).toStrictEqual({ barShape: 'cylinder' });
	});

	it('returns an empty patch for a plain (2-D) bar chart', () => {
		expect(bar3DShapePatch(barChart(), 'cylinder')).toStrictEqual({});
	});
});

describe('radarStylePatch', () => {
	it('returns { radarStyle } for a radar chart', () => {
		expect(radarStylePatch(radarChart(), 'filled')).toStrictEqual({ radarStyle: 'filled' });
	});

	it('returns an empty patch for a non-radar chart', () => {
		expect(radarStylePatch(barChart(), 'filled')).toStrictEqual({});
	});
});

describe('surfaceWireframePatch', () => {
	it('returns { wireframe } for a surface chart', () => {
		expect(surfaceWireframePatch(surfaceChart(), false)).toStrictEqual({ wireframe: false });
	});

	it('returns an empty patch for a non-surface chart', () => {
		expect(surfaceWireframePatch(barChart(), false)).toStrictEqual({});
	});
});
