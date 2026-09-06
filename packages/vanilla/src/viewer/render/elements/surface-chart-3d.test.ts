import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderChartElement } from './chart';
import { registerTableChartRenderers } from './register-table-chart';

/**
 * The `surfaceChart3D` opt-in dispatch (`renderChartElement` only routes to
 * the WebGL renderer when the flag is set on context AND the chart resolves
 * to `surface`), the on-init WebGL mount (success and `three`/mount
 * unavailable), and the empty-grid / non-surface-kind SVG fallback paths.
 * Mirrors `smartart.test.ts`'s mocking pattern for the shared three.js scene
 * controller.
 */

// Mock only `mountSurfaceChart3D` on the shared module so the optional
// `three` peer dep is never loaded; `buildSurfaceChart3DDataForElement` stays
// the real implementation so the gate-on-chart-kind behaviour is genuinely
// exercised. Defined via vi.hoisted so the hoisted vi.mock factory can
// reference it.
const { mountSurfaceChart3D } = vi.hoisted(() => ({ mountSurfaceChart3D: vi.fn() }));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountSurfaceChart3D: (...args: Parameters<typeof actual.mountSurfaceChart3D>) =>
			mountSurfaceChart3D(...args),
	};
});

function okHandle() {
	return {
		ok: true,
		resize: vi.fn(),
		setSelectedPart: vi.fn(),
		setTextStyle: vi.fn(),
		dispose: vi.fn(),
	};
}

function unavailableHandle() {
	return {
		ok: false,
		resize: vi.fn(),
		setSelectedPart: vi.fn(),
		setTextStyle: vi.fn(),
		dispose: vi.fn(),
	};
}

function buildContext(
	surfaceChart3D: boolean,
	overrides: Partial<ElementRenderContext> = {},
): ElementRenderContext {
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
		surfaceChart3D,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting: false,
		registry,
		renderElement(element, zIndex) {
			return registry.resolve(element.type)(element, zIndex, context);
		},
		...overrides,
	};
	return context;
}

function buildChartElement(chartData: PptxChartData | undefined): PptxElement {
	return { type: 'chart', id: 'sc3d-1', x: 10, y: 20, width: 400, height: 240, chartData };
}

const SURFACE_DATA: PptxChartData = {
	chartType: 'surface',
	categories: ['A', 'B'],
	series: [
		{ name: 'S1', values: [1, 2] },
		{ name: 'S2', values: [3, 4] },
	],
};

const BAR_DATA: PptxChartData = {
	chartType: 'bar',
	categories: ['A', 'B'],
	series: [{ name: 'S1', values: [1, 2] }],
};

/** Flush the mount promise chain (mountSurfaceChart3D is awaited once). */
async function flushMount(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

beforeEach(() => {
	mountSurfaceChart3D.mockReset();
	mountSurfaceChart3D.mockResolvedValue(okHandle());
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('renderChartElement - surfaceChart3D opt-in', () => {
	it('renders the SVG chart synchronously when surfaceChart3D is not enabled', () => {
		const container = renderChartElement(
			buildChartElement(SURFACE_DATA),
			0,
			buildContext(false),
		) as HTMLElement;
		expect(mountSurfaceChart3D).not.toHaveBeenCalled();
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('renders the SVG chart for a non-surface chart kind even when the flag is on', () => {
		const container = renderChartElement(
			buildChartElement(BAR_DATA),
			0,
			buildContext(true),
		) as HTMLElement;
		expect(mountSurfaceChart3D).not.toHaveBeenCalled();
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('paints a loading spinner synchronously, then upgrades to the WebGL scene once the mount resolves', async () => {
		const container = renderChartElement(
			buildChartElement(SURFACE_DATA),
			0,
			buildContext(true),
		) as HTMLElement;
		// Synchronous return: a lightweight spinner stands in, not the SVG chart
		// (which would otherwise flash on screen before the WebGL scene mounts).
		expect(container.querySelector('.pptxv-chart3d-loading')).toBeTruthy();
		expect(container.querySelector('svg')).toBeNull();

		await flushMount();

		expect(mountSurfaceChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ cols: 2, rows: 2 }),
			// Not interactive in this context: no interaction hooks are wired.
			undefined,
		);
		expect(container.querySelector('.pptxv-surface-chart-3d-scene')).toBeTruthy();
		expect(container.querySelector('svg')).toBeNull();
	});

	it('wires click-to-select + drag-to-value on the interactive canvas, seeded from the store selection', async () => {
		const onChartPartSelect = vi.fn();
		const onChartPointChange = vi.fn();
		const element = buildChartElement(SURFACE_DATA);
		const context = buildContext(true, {
			interactive: true,
			onChartPointChange,
			onChartPartSelect,
			chartPartSelection: { elementId: element.id, part: { role: 'dataPoint', seriesIndex: 0 } },
		});
		renderChartElement(element, 0, context);

		await flushMount();

		expect(mountSurfaceChart3D).toHaveBeenCalledOnce();
		const interaction = mountSurfaceChart3D.mock.calls[0]?.[2];
		expect(interaction).toBeDefined();

		interaction.onSelect({ role: 'dataPoint', seriesIndex: 1, pointIndex: 0 });
		expect(onChartPartSelect).toHaveBeenCalledExactlyOnceWith(element, {
			role: 'dataPoint',
			seriesIndex: 1,
			pointIndex: 0,
		});

		interaction.onValueDragCommit({ role: 'dataPoint', seriesIndex: 1, pointIndex: 0 }, 42);
		expect(onChartPointChange).toHaveBeenCalledExactlyOnceWith(
			element,
			expect.objectContaining({
				series: [
					{ name: 'S1', values: [1, 2] },
					{ name: 'S2', values: [42, 4] },
				],
			}),
		);

		const handle = await mountSurfaceChart3D.mock.results[0]?.value;
		expect(handle.setSelectedPart).toHaveBeenCalledExactlyOnceWith({
			role: 'dataPoint',
			seriesIndex: 0,
		});
	});

	it('threads the active font-style emphasis into the mount options', async () => {
		const element = buildChartElement(SURFACE_DATA);
		const presentationStates = new Map([
			[element.id, { visible: true, cssAnimation: undefined, textStyle: { bold: true } }],
		]);
		const context = buildContext(true, { presentationStates });
		renderChartElement(element, 0, context);

		await flushMount();

		expect(mountSurfaceChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ textStyle: { bold: true } }),
			undefined,
		);
	});

	it('keeps the SVG in place when the mount resolves not-ok (three unavailable)', async () => {
		mountSurfaceChart3D.mockResolvedValueOnce(unavailableHandle());
		const container = renderChartElement(
			buildChartElement(SURFACE_DATA),
			0,
			buildContext(true),
		) as HTMLElement;

		await flushMount();

		expect(container.querySelector('.pptxv-surface-chart-3d-scene')).toBeNull();
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('does not attempt a mount when the chart has no data (placeholder)', async () => {
		const container = renderChartElement(
			buildChartElement(undefined),
			0,
			buildContext(true),
		) as HTMLElement;

		await flushMount();

		expect(mountSurfaceChart3D).not.toHaveBeenCalled();
		expect(container.querySelector('.pptxv-chart-placeholder')).toBeTruthy();
	});
});
