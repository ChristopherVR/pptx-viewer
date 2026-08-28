import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderChartElement } from './chart';
import { registerTableChartRenderers } from './register-table-chart';

/**
 * The `pieChart3D` opt-in dispatch (`renderChartElement` only routes to the
 * WebGL renderer when the flag is set on context AND the chart's raw
 * `chartType` is `pie3D`, checked directly rather than via `resolveChartKind`
 * which folds plain `pie`/`doughnut` and `pie3D` together), the on-init
 * WebGL mount (success and `three`/mount unavailable), and the empty-grid /
 * non-pie3D-kind SVG fallback paths. Mirrors `bar-chart-3d.test.ts`'s mocking
 * pattern for the shared three.js scene controller.
 */

// Mock only `mountPieChart3D` on the shared module so the optional `three`
// peer dep is never loaded; `buildPieChart3DDataForElement` stays the real
// implementation so the gate-on-chart-type behaviour is genuinely exercised.
// Defined via vi.hoisted so the hoisted vi.mock factory can reference it.
const { mountPieChart3D } = vi.hoisted(() => ({ mountPieChart3D: vi.fn() }));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountPieChart3D: (...args: Parameters<typeof actual.mountPieChart3D>) =>
			mountPieChart3D(...args),
	};
});

function okHandle() {
	return { ok: true, resize: vi.fn(), dispose: vi.fn() };
}

function unavailableHandle() {
	return { ok: false, resize: vi.fn(), dispose: vi.fn() };
}

function buildContext(pieChart3D: boolean): ElementRenderContext {
	const registry = createElementRendererRegistry();
	registerTableChartRenderers(registry);
	const context: ElementRenderContext = {
		document,
		slide: { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		pieChart3D,
		lineChart3D: false,
		areaChart3D: false,
		presenting: false,
		registry,
		renderElement(element, zIndex) {
			return registry.resolve(element.type)(element, zIndex, context);
		},
	};
	return context;
}

function buildChartElement(chartData: PptxChartData | undefined): PptxElement {
	return { type: 'chart', id: 'pc3d-1', x: 10, y: 20, width: 400, height: 240, chartData };
}

const PIE3D_DATA: PptxChartData = {
	chartType: 'pie3D',
	categories: ['A', 'B', 'C'],
	series: [{ name: 'S1', values: [1, 2, 3] }],
};

const PIE_DATA: PptxChartData = {
	chartType: 'pie',
	categories: ['A', 'B', 'C'],
	series: [{ name: 'S1', values: [1, 2, 3] }],
};

/** Flush the mount promise chain (mountPieChart3D is awaited once). */
async function flushMount(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

beforeEach(() => {
	mountPieChart3D.mockReset();
	mountPieChart3D.mockResolvedValue(okHandle());
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('renderChartElement - pieChart3D opt-in', () => {
	it('renders the SVG chart synchronously when pieChart3D is not enabled', () => {
		const container = renderChartElement(
			buildChartElement(PIE3D_DATA),
			0,
			buildContext(false),
		) as HTMLElement;
		expect(mountPieChart3D).not.toHaveBeenCalled();
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('renders the SVG chart for a plain (non-3D) pie chart even when the flag is on', () => {
		const container = renderChartElement(
			buildChartElement(PIE_DATA),
			0,
			buildContext(true),
		) as HTMLElement;
		expect(mountPieChart3D).not.toHaveBeenCalled();
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('paints the SVG synchronously, then upgrades to the WebGL scene once the mount resolves', async () => {
		const container = renderChartElement(
			buildChartElement(PIE3D_DATA),
			0,
			buildContext(true),
		) as HTMLElement;
		// Synchronous return: the SVG fallback is already painted.
		expect(container.querySelector('svg')).toBeTruthy();

		await flushMount();

		expect(mountPieChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ wedges: expect.any(Array) }),
		);
		expect(container.querySelector('.pptxv-pie-chart-3d-scene')).toBeTruthy();
		expect(container.querySelector('svg')).toBeNull();
	});

	it('keeps the SVG in place when the mount resolves not-ok (three unavailable)', async () => {
		mountPieChart3D.mockResolvedValueOnce(unavailableHandle());
		const container = renderChartElement(
			buildChartElement(PIE3D_DATA),
			0,
			buildContext(true),
		) as HTMLElement;

		await flushMount();

		expect(container.querySelector('.pptxv-pie-chart-3d-scene')).toBeNull();
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('does not attempt a mount when the chart has no data (placeholder)', async () => {
		const container = renderChartElement(
			buildChartElement(undefined),
			0,
			buildContext(true),
		) as HTMLElement;

		await flushMount();

		expect(mountPieChart3D).not.toHaveBeenCalled();
		expect(container.querySelector('.pptxv-chart-placeholder')).toBeTruthy();
	});
});
