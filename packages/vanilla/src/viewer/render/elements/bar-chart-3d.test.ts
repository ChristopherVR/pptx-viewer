import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderChartElement } from './chart';
import { registerTableChartRenderers } from './register-table-chart';

/**
 * The `barChart3D` opt-in dispatch (`renderChartElement` only routes to the
 * WebGL renderer when the flag is set on context AND the chart's raw
 * `chartType` is `bar3D`, checked directly rather than via `resolveChartKind`
 * which folds plain `bar` and `bar3D` together), the on-init WebGL mount
 * (success and `three`/mount unavailable), and the empty-grid / non-bar3D-kind
 * SVG fallback paths. Mirrors `surface-chart-3d.test.ts`'s mocking pattern for
 * the shared three.js scene controller.
 */

// Mock only `mountBarChart3D` on the shared module so the optional `three`
// peer dep is never loaded; `buildBarChart3DDataForElement` stays the real
// implementation so the gate-on-chart-type behaviour is genuinely exercised.
// Defined via vi.hoisted so the hoisted vi.mock factory can reference it.
const { mountBarChart3D } = vi.hoisted(() => ({ mountBarChart3D: vi.fn() }));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountBarChart3D: (...args: Parameters<typeof actual.mountBarChart3D>) =>
			mountBarChart3D(...args),
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
	barChart3D: boolean,
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
		surfaceChart3D: false,
		barChart3D,
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
	return { type: 'chart', id: 'bc3d-1', x: 10, y: 20, width: 400, height: 240, chartData };
}

const BAR3D_DATA: PptxChartData = {
	chartType: 'bar3D',
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

/** Flush the mount promise chain (mountBarChart3D is awaited once). */
async function flushMount(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

beforeEach(() => {
	mountBarChart3D.mockReset();
	mountBarChart3D.mockResolvedValue(okHandle());
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('renderChartElement - barChart3D opt-in', () => {
	it('renders the SVG chart synchronously when barChart3D is not enabled', () => {
		const container = renderChartElement(
			buildChartElement(BAR3D_DATA),
			0,
			buildContext(false),
		) as HTMLElement;
		expect(mountBarChart3D).not.toHaveBeenCalled();
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('renders the SVG chart for a plain (non-3D) bar chart even when the flag is on', () => {
		const container = renderChartElement(
			buildChartElement(BAR_DATA),
			0,
			buildContext(true),
		) as HTMLElement;
		expect(mountBarChart3D).not.toHaveBeenCalled();
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('paints a loading spinner synchronously, then upgrades to the WebGL scene once the mount resolves', async () => {
		const container = renderChartElement(
			buildChartElement(BAR3D_DATA),
			0,
			buildContext(true),
		) as HTMLElement;
		// Synchronous return: a lightweight spinner stands in, not the SVG chart
		// (which would otherwise flash on screen before the WebGL scene mounts).
		expect(container.querySelector('.pptxv-chart3d-loading')).toBeTruthy();
		expect(container.querySelector('svg')).toBeNull();

		await flushMount();

		expect(mountBarChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ cols: 2, rows: 2, grouping: 'clustered' }),
			// Not interactive in this context: no interaction hooks are wired.
			undefined,
		);
		expect(container.querySelector('.pptxv-bar-chart-3d-scene')).toBeTruthy();
		expect(container.querySelector('svg')).toBeNull();
	});

	it('wires click-to-select + drag-to-value on the interactive canvas, seeded from the store selection', async () => {
		const onChartPartSelect = vi.fn();
		const onChartPointChange = vi.fn();
		const element = buildChartElement(BAR3D_DATA);
		const context = buildContext(true, {
			interactive: true,
			onChartPointChange,
			onChartPartSelect,
			chartPartSelection: { elementId: element.id, part: { role: 'dataPoint', seriesIndex: 0 } },
		});
		renderChartElement(element, 0, context);

		await flushMount();

		expect(mountBarChart3D).toHaveBeenCalledOnce();
		const interaction = mountBarChart3D.mock.calls[0]?.[2];
		expect(interaction).toBeDefined();

		interaction.onSelect({ role: 'dataPoint', seriesIndex: 1, pointIndex: 0 });
		expect(onChartPartSelect).toHaveBeenCalledExactlyOnceWith(element, {
			role: 'dataPoint',
			seriesIndex: 1,
			pointIndex: 0,
		});

		interaction.onValueDragCommit({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 }, 42);
		expect(onChartPointChange).toHaveBeenCalledExactlyOnceWith(
			element,
			expect.objectContaining({
				series: [
					{ name: 'S1', values: [1, 42] },
					{ name: 'S2', values: [3, 4] },
				],
			}),
		);

		// Seeded from `context.chartPartSelection` once the scene is mounted.
		const handle = await mountBarChart3D.mock.results[0]?.value;
		expect(handle.setSelectedPart).toHaveBeenCalledExactlyOnceWith({
			role: 'dataPoint',
			seriesIndex: 0,
		});
	});

	it('threads the active font-style emphasis into the mount options', async () => {
		const element = buildChartElement(BAR3D_DATA);
		const presentationStates = new Map([
			[element.id, { visible: true, cssAnimation: undefined, textStyle: { bold: true } }],
		]);
		const context = buildContext(true, { presentationStates });
		renderChartElement(element, 0, context);

		await flushMount();

		expect(mountBarChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ textStyle: { bold: true } }),
			undefined,
		);
	});

	it('keeps the SVG in place when the mount resolves not-ok (three unavailable)', async () => {
		mountBarChart3D.mockResolvedValueOnce(unavailableHandle());
		const container = renderChartElement(
			buildChartElement(BAR3D_DATA),
			0,
			buildContext(true),
		) as HTMLElement;

		await flushMount();

		expect(container.querySelector('.pptxv-bar-chart-3d-scene')).toBeNull();
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('does not attempt a mount when the chart has no data (placeholder)', async () => {
		const container = renderChartElement(
			buildChartElement(undefined),
			0,
			buildContext(true),
		) as HTMLElement;

		await flushMount();

		expect(mountBarChart3D).not.toHaveBeenCalled();
		expect(container.querySelector('.pptxv-chart-placeholder')).toBeTruthy();
	});

	// A horizontal 3-D Bar (`c:barDir="bar"`) used to fall back to the SVG chart;
	// shared's `buildBarChart3DScene` now remaps the boxes into the horizontal
	// frame, so it mounts the same WebGL scene as the vertical variant.
	it('mounts the WebGL scene for a horizontal (barDir=bar) 3-D Bar chart', async () => {
		const container = renderChartElement(
			buildChartElement({ ...BAR3D_DATA, barDirection: 'bar' }),
			0,
			buildContext(true),
		) as HTMLElement;

		await flushMount();

		expect(mountBarChart3D).toHaveBeenCalledOnce();
		expect(container.querySelector('svg')).toBeNull();
	});
});
