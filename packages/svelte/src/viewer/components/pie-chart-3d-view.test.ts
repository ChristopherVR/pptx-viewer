import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { ChartPartRef } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PieChart3DContextKey } from '../state/pie-chart-3d-context';
import ElementRenderer from './ElementRenderer.svelte';

/**
 * PieChart3DView tests: the `pieChart3D` opt-in dispatch (ElementRenderer
 * only routes to the WebGL renderer when the flag is set via context, and
 * only for a `pie3D` chart's raw `chartType`, never a plain `pie` chart even
 * though `resolveChartKind` folds them together), the on-init WebGL mount
 * (success, `three`/mount unavailable, and the no-plottable-series
 * fallback), and scene disposal on unmount. Mirrors
 * `bar-chart-3d-view.test.ts`'s mocking pattern for the shared three.js
 * scene controller.
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
	return { ok: true, resize: vi.fn(), setSelectedPart: vi.fn(), dispose: vi.fn() };
}

function unavailableHandle() {
	return { ok: false, resize: vi.fn(), dispose: vi.fn() };
}

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement, pieChart3D: boolean): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 2 },
		context: new Map([[PieChart3DContextKey, () => pieChart3D]]),
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function pieChartElement(chartData: PptxChartData | undefined): PptxElement {
	return {
		type: 'chart',
		id: 'pc3d-1',
		x: 10,
		y: 20,
		width: 400,
		height: 240,
		chartData,
	} as PptxElement;
}

const PIE3D_DATA: PptxChartData = {
	chartType: 'pie3D',
	categories: ['A', 'B'],
	series: [{ name: 'S1', values: [1, 2] }],
};

const PIE_DATA: PptxChartData = {
	chartType: 'pie',
	categories: ['A', 'B'],
	series: [{ name: 'S1', values: [1, 2] }],
};

/**
 * Flush the mount promise chain plus the Svelte state-update scheduler.
 * `mountPieChart3D` is awaited across a `tick()`, which needs real event-loop
 * turns (macrotasks) to settle, not just drained microtasks.
 */
async function flushMount(): Promise<void> {
	for (let i = 0; i < 100; i++) {
		flushSync();
		// eslint-disable-next-line no-await-in-loop -- polling real macrotask
		// ticks until the async mount + `tick()` both settle.
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});
	}
	flushSync();
}

beforeEach(() => {
	mountPieChart3D.mockReset();
	mountPieChart3D.mockResolvedValue(okHandle());
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

describe('pie3DChartView', () => {
	it('renders the SVG ChartView when pieChart3D is not enabled', async () => {
		const target = mountEl(pieChartElement(PIE3D_DATA), false);
		await flushMount();
		expect(mountPieChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-pie-chart-3d')).toBeNull();
	});

	it('renders the SVG ChartView for a plain pie chart even when the flag is on', async () => {
		const target = mountEl(pieChartElement(PIE_DATA), true);
		await flushMount();
		expect(mountPieChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-pie-chart-3d')).toBeNull();
	});

	it('mounts the WebGL scene on init for a pie3D chart when the flag is enabled', async () => {
		const target = mountEl(pieChartElement(PIE3D_DATA), true);
		await flushMount();

		expect(mountPieChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ wedges: expect.any(Array) }),
		);
		const node = target.querySelector<HTMLElement>('[data-element-id="pc3d-1"]');
		expect(node?.getAttribute('style')).toContain('left: 10px');
		expect(node?.querySelector('.pptx-svelte-pie-chart-3d-scene')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-chart')).toBeNull();
	});

	it('falls back to the SVG ChartView when the mount resolves not-ok (three unavailable)', async () => {
		mountPieChart3D.mockResolvedValueOnce(unavailableHandle());
		const target = mountEl(pieChartElement(PIE3D_DATA), true);
		await flushMount();

		expect(target.querySelector('.pptx-svelte-pie-chart-3d')).toBeNull();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
	});

	it('stays on the SVG fallback without mounting when the chart has no data', async () => {
		const target = mountEl(pieChartElement(undefined), true);
		await flushMount();

		expect(mountPieChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart-placeholder')).toBeTruthy();
	});

	it('defaults to the SVG fallback when the flag is unset (no context provided)', async () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ElementRenderer, {
			target,
			props: {
				element: pieChartElement(PIE3D_DATA),
				mediaDataUrls: new Map<string, string>(),
				zIndex: 2,
			},
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		await flushMount();

		expect(mountPieChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-pie-chart-3d')).toBeNull();
	});

	it('disposes the scene handle on unmount', async () => {
		const handle = okHandle();
		mountPieChart3D.mockResolvedValue(handle);
		mountEl(pieChartElement(PIE3D_DATA), true);
		await flushMount();

		cleanup?.();
		cleanup = undefined;
		expect(handle.dispose).toHaveBeenCalledOnce();
	});

	describe('on-canvas interaction', () => {
		function mountInteractiveEl(
			element: PptxElement,
			onchartpointcommit: (elementId: string, chartData: PptxChartData) => void,
		): HTMLElement {
			const target = document.createElement('div');
			document.body.appendChild(target);
			const instance = mount(ElementRenderer, {
				target,
				props: {
					element,
					mediaDataUrls: new Map<string, string>(),
					zIndex: 2,
					interactive: true,
					onchartpointcommit,
				},
				context: new Map([[PieChart3DContextKey, () => true]]),
			});
			flushSync();
			cleanup = () => {
				unmount(instance);
				target.remove();
			};
			return target;
		}

		it('wires onSelect/onValueDragPreview/onValueDragCommit when editable', async () => {
			mountInteractiveEl(pieChartElement(PIE3D_DATA), vi.fn());
			await flushMount();

			const interaction = mountPieChart3D.mock.calls[0]?.[2];
			expect(interaction?.onSelect).toBeInstanceOf(Function);
			expect(interaction?.onValueDragPreview).toBeInstanceOf(Function);
			expect(interaction?.onValueDragCommit).toBeInstanceOf(Function);
		});

		it('omits the interaction object when there is no commit handler (not editable)', async () => {
			mountEl(pieChartElement(PIE3D_DATA), true);
			await flushMount();

			expect(mountPieChart3D.mock.calls[0]).toHaveLength(2);
		});

		it('commits a dragged value through onchartpointcommit via withChartPointValue', async () => {
			const onchartpointcommit = vi.fn();
			mountInteractiveEl(pieChartElement(PIE3D_DATA), onchartpointcommit);
			await flushMount();

			const interaction = mountPieChart3D.mock.calls[0]?.[2];
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };
			interaction?.onValueDragCommit(part, 42);
			flushSync();

			expect(onchartpointcommit).toHaveBeenCalledExactlyOnceWith(
				'pc3d-1',
				expect.objectContaining({
					series: [expect.objectContaining({ values: [1, 42] })],
				}),
			);
		});

		it('shows a live drag badge while a value drag preview is active', async () => {
			const target = mountInteractiveEl(pieChartElement(PIE3D_DATA), vi.fn());
			await flushMount();

			const interaction = mountPieChart3D.mock.calls[0]?.[2];
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 };
			interaction?.onValueDragPreview(part, 7);
			flushSync();

			expect(target.querySelector('.pptx-svelte-pie-chart-3d-drag-badge')?.textContent).toBe('7');
		});
	});
});
