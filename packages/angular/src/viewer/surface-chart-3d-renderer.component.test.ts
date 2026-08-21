/**
 * Contract tests for the interactive 3D surface-chart wiring.
 *
 * `SurfaceChart3DRendererComponent` itself dynamically imports the vendored
 * scene runtime (which pulls the optional `three` peer) and mounts a WebGL
 * scene, which needs a real WebGL context happy-dom does not provide; no
 * other Angular 3D renderer (`Model3DRendererComponent`,
 * `SmartArt3DRendererComponent`) has a TestBed mount/dispose test either, only
 * pure-helper and module-contract coverage. This file follows the same
 * pattern: assert the pure data adapter is reachable through the barrel every
 * Angular source imports from, and that the vendored scene module exposes the
 * shape the component relies on.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSurfaceChart3DDataForElement } from '../internal/shared';

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

describe('buildSurfaceChart3DDataForElement (via the ../internal/shared barrel)', () => {
	it('is reachable through the vendored shared barrel Angular imports from', () => {
		expect(buildSurfaceChart3DDataForElement).toBeTypeOf('function');
	});

	it('returns null for a non-surface chart', () => {
		const data: PptxChartData = {
			chartType: 'bar',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
		};
		expect(
			buildSurfaceChart3DDataForElement(chartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns a mountable grid for a surface chart with data', () => {
		const data: PptxChartData = {
			chartType: 'surface',
			categories: ['A', 'B'],
			series: [
				{ name: 'S1', values: [1, 2] },
				{ name: 'S2', values: [3, 4] },
			],
		};
		const result = buildSurfaceChart3DDataForElement(chartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result).not.toBeNull();
		expect(result!.cols).toBe(2);
		expect(result!.rows).toBe(2);
	});
});

describe('shared surface-chart-3d-scene contract (vendored path)', () => {
	it('exports mountSurfaceChart3D and a no-op SURFACE_THREE_UNAVAILABLE sentinel', async () => {
		const mod = await import('../internal/shared-src/render/surface-chart-3d-scene');
		expect(mod.mountSurfaceChart3D).toBeTypeOf('function');
		expect(mod.SURFACE_THREE_UNAVAILABLE.ok).toBeFalsy();
		expect(() => mod.SURFACE_THREE_UNAVAILABLE.dispose()).not.toThrow();
	});
});
