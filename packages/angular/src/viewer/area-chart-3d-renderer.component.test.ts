/**
 * Contract tests for the interactive 3D area3D-chart wiring. Mirrors
 * `line-chart-3d-renderer.component.test.ts` / `bar-chart-3d-renderer.component.test.ts`.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildAreaChart3DDataForElement } from '../internal/shared';

function chartElement(chartData: PptxChartData | undefined): PptxElement {
	return {
		id: 'ch-1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as unknown as PptxElement;
}

describe('buildAreaChart3DDataForElement (via the ../internal/shared barrel)', () => {
	it('is reachable through the vendored shared barrel Angular imports from', () => {
		expect(buildAreaChart3DDataForElement).toBeTypeOf('function');
	});

	it('returns null for a plain (non-3D) area chart', () => {
		const data: PptxChartData = {
			chartType: 'area',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
		};
		expect(
			buildAreaChart3DDataForElement(chartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns a mountable per-series path/ribbon layout for an area3D chart with data', () => {
		const data: PptxChartData = {
			chartType: 'area3D',
			categories: ['A', 'B'],
			series: [
				{ name: 'S1', values: [1, 2] },
				{ name: 'S2', values: [3, 4] },
			],
		};
		const result = buildAreaChart3DDataForElement(chartElement(data), { width: 400, height: 300 });
		expect(result).not.toBeNull();
		expect(result!.cols).toBe(2);
		expect(result!.rows).toBe(2);
		expect(result!.series).toHaveLength(2);
	});
});

describe('shared area-chart-3d-scene contract (vendored path)', () => {
	it('exports mountAreaChart3D and a no-op AREA_CHART_THREE_UNAVAILABLE sentinel', async () => {
		const mod = await import('../internal/shared-src/render/area-chart-3d-scene');
		expect(mod.mountAreaChart3D).toBeTypeOf('function');
		expect(mod.AREA_CHART_THREE_UNAVAILABLE.ok).toBeFalsy();
		expect(() => mod.AREA_CHART_THREE_UNAVAILABLE.dispose()).not.toThrow();
	});
});
