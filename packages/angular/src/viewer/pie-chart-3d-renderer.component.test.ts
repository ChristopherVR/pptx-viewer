/**
 * Contract tests for the interactive 3D pie3D-chart wiring.
 *
 * `PieChart3DRendererComponent` itself dynamically imports the vendored scene
 * runtime (which pulls the optional `three` peer) and mounts a WebGL scene,
 * which needs a real WebGL context happy-dom does not provide; no other
 * Angular 3D renderer (`Model3DRendererComponent`, `SmartArt3DRendererComponent`,
 * `SurfaceChart3DRendererComponent`, `BarChart3DRendererComponent`) has a
 * TestBed mount/dispose test either, only pure-helper and module-contract
 * coverage. This file follows the same pattern (mirrors
 * `bar-chart-3d-renderer.component.test.ts`): assert the pure data adapter is
 * reachable through the barrel every Angular source imports from, and that
 * the vendored scene module exposes the shape the component relies on.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildPieChart3DDataForElement } from '../internal/shared';

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

describe('buildPieChart3DDataForElement (via the ../internal/shared barrel)', () => {
	it('is reachable through the vendored shared barrel Angular imports from', () => {
		expect(buildPieChart3DDataForElement).toBeTypeOf('function');
	});

	it('returns null for a plain (non-3D) pie chart', () => {
		const data: PptxChartData = {
			chartType: 'pie',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
		};
		expect(
			buildPieChart3DDataForElement(chartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns a mountable wedge-mesh layout for a pie3D chart with data', () => {
		const data: PptxChartData = {
			chartType: 'pie3D',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
		};
		const result = buildPieChart3DDataForElement(chartElement(data), { width: 400, height: 300 });
		expect(result).not.toBeNull();
		expect(result!.wedges).toHaveLength(2);
	});
});

describe('shared pie-chart-3d-scene contract (vendored path)', () => {
	it('exports mountPieChart3D and a no-op PIE_CHART_THREE_UNAVAILABLE sentinel', async () => {
		const mod = await import('../internal/shared-src/render/pie-chart-3d-scene');
		expect(mod.mountPieChart3D).toBeTypeOf('function');
		expect(mod.PIE_CHART_THREE_UNAVAILABLE.ok).toBeFalsy();
		expect(() => mod.PIE_CHART_THREE_UNAVAILABLE.dispose()).not.toThrow();
	});
});
