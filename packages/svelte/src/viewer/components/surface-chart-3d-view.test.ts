import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { ChartPartRef, ElementAnimationState } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PresentationElementStatesKey } from '../state/presentation-element-states-context';
import { SurfaceChart3DContextKey } from '../state/surface-chart-3d-context';
import ElementRenderer from './ElementRenderer.svelte';

/**
 * SurfaceChart3DView tests: the `surfaceChart3D` opt-in dispatch
 * (ElementRenderer only routes to the WebGL renderer when the flag is set via
 * context, and only for chart kinds that resolve to `surface`), the on-init
 * WebGL mount (success, `three`/mount unavailable, and the no-plottable-grid
 * fallback), and scene disposal on unmount. Mirrors `smart-art-3d-view.test.ts`'s
 * mocking pattern for the shared three.js scene controller.
 */

// Mock only `mountSurfaceChart3D` on the shared module so the optional `three`
// peer dep is never loaded; `buildSurfaceChart3DDataForElement` stays the real
// implementation so the gate-on-chart-kind behaviour is genuinely exercised.
// Defined via vi.hoisted so the hoisted vi.mock factory can reference it.
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
	return { ok: false, resize: vi.fn(), dispose: vi.fn() };
}

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement, surfaceChart3D: boolean): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 2 },
		context: new Map([[SurfaceChart3DContextKey, () => surfaceChart3D]]),
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function surfaceChartElement(chartData: PptxChartData | undefined): PptxElement {
	return {
		type: 'chart',
		id: 'sc3d-1',
		x: 10,
		y: 20,
		width: 400,
		height: 240,
		chartData,
	} as PptxElement;
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

/**
 * Flush the mount promise chain plus the Svelte state-update scheduler.
 * `mountSurfaceChart3D` is awaited across a `tick()`, which needs real
 * event-loop turns (macrotasks) to settle, not just drained microtasks.
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
	mountSurfaceChart3D.mockReset();
	mountSurfaceChart3D.mockResolvedValue(okHandle());
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

describe('surfaceChart3DView', () => {
	it('renders the SVG ChartView when surfaceChart3D is not enabled', async () => {
		const target = mountEl(surfaceChartElement(SURFACE_DATA), false);
		await flushMount();
		expect(mountSurfaceChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-surface-chart-3d')).toBeNull();
	});

	it('renders the SVG ChartView for a non-surface chart kind even when the flag is on', async () => {
		const target = mountEl(surfaceChartElement(BAR_DATA), true);
		await flushMount();
		expect(mountSurfaceChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-surface-chart-3d')).toBeNull();
	});

	it('mounts the WebGL scene on init for a surface chart when the flag is enabled', async () => {
		const target = mountEl(surfaceChartElement(SURFACE_DATA), true);
		await flushMount();

		expect(mountSurfaceChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ cols: 2, rows: 2 }),
		);
		const node = target.querySelector<HTMLElement>('[data-element-id="sc3d-1"]');
		expect(node?.getAttribute('style')).toContain('left: 10px');
		expect(node?.querySelector('.pptx-svelte-surface-chart-3d-scene')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-chart')).toBeNull();
	});

	it('falls back to the SVG ChartView when the mount resolves not-ok (three unavailable)', async () => {
		mountSurfaceChart3D.mockResolvedValueOnce(unavailableHandle());
		const target = mountEl(surfaceChartElement(SURFACE_DATA), true);
		await flushMount();

		expect(target.querySelector('.pptx-svelte-surface-chart-3d')).toBeNull();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
	});

	it('stays on the SVG fallback without mounting when the chart has no data', async () => {
		const target = mountEl(surfaceChartElement(undefined), true);
		await flushMount();

		expect(mountSurfaceChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart-placeholder')).toBeTruthy();
	});

	it('disposes the scene handle on unmount', async () => {
		const handle = okHandle();
		mountSurfaceChart3D.mockResolvedValue(handle);
		mountEl(surfaceChartElement(SURFACE_DATA), true);
		await flushMount();

		cleanup?.();
		cleanup = undefined;
		expect(handle.dispose).toHaveBeenCalledOnce();
	});

	describe('on-canvas interaction', () => {
		function mountInteractiveEl(
			element: PptxElement,
			onchartpointcommit: (elementId: string, chartData: PptxChartData) => void,
			animationState?: ElementAnimationState,
		): HTMLElement {
			const target = document.createElement('div');
			document.body.appendChild(target);
			const context = new Map<symbol, unknown>([[SurfaceChart3DContextKey, () => true]]);
			if (animationState) {
				context.set(PresentationElementStatesKey, () => new Map([[element.id, animationState]]));
			}
			const instance = mount(ElementRenderer, {
				target,
				props: {
					element,
					mediaDataUrls: new Map<string, string>(),
					zIndex: 2,
					interactive: true,
					onchartpointcommit,
				},
				context,
			});
			flushSync();
			cleanup = () => {
				unmount(instance);
				target.remove();
			};
			return target;
		}

		it('wires onSelect/onValueDragPreview/onValueDragCommit when editable', async () => {
			mountInteractiveEl(surfaceChartElement(SURFACE_DATA), vi.fn());
			await flushMount();

			const interaction = mountSurfaceChart3D.mock.calls[0]?.[2];
			expect(interaction?.onSelect).toBeInstanceOf(Function);
			expect(interaction?.onValueDragPreview).toBeInstanceOf(Function);
			expect(interaction?.onValueDragCommit).toBeInstanceOf(Function);
		});

		it('commits a dragged value through onchartpointcommit via withChartPointValue', async () => {
			const onchartpointcommit = vi.fn();
			mountInteractiveEl(surfaceChartElement(SURFACE_DATA), onchartpointcommit);
			await flushMount();

			const interaction = mountSurfaceChart3D.mock.calls[0]?.[2];
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 1, pointIndex: 0 };
			interaction?.onValueDragCommit(part, 42);
			flushSync();

			expect(onchartpointcommit).toHaveBeenCalledExactlyOnceWith(
				'sc3d-1',
				expect.objectContaining({
					series: [
						expect.objectContaining({ values: [1, 2] }),
						expect.objectContaining({ values: [42, 4] }),
					],
				}),
			);
		});

		it('shows a live drag badge while a value drag preview is active', async () => {
			const target = mountInteractiveEl(surfaceChartElement(SURFACE_DATA), vi.fn());
			await flushMount();

			const interaction = mountSurfaceChart3D.mock.calls[0]?.[2];
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 };
			interaction?.onValueDragPreview(part, 7);
			flushSync();

			expect(target.querySelector('.pptx-svelte-surface-chart-3d-drag-badge')?.textContent).toBe(
				'7',
			);
		});

		it('omits the interaction object when there is no commit handler (not editable)', async () => {
			mountEl(surfaceChartElement(SURFACE_DATA), true);
			await flushMount();

			expect(mountSurfaceChart3D.mock.calls[0]).toHaveLength(2);
		});

		it('arms the wrapper (pptx-chart-interactive) only while editable', async () => {
			// The shared 3D pointer wiring asks `isChartInteractionArmed` before
			// it owns a mark press; without the class the press bubbled to the
			// stage and a value drag moved the whole chart element instead.
			const editable = mountInteractiveEl(surfaceChartElement(SURFACE_DATA), vi.fn());
			await flushMount();
			expect(
				editable
					.querySelector('[data-element-id="sc3d-1"]')
					?.classList.contains('pptx-chart-interactive'),
			).toBeTruthy();
			cleanup?.();
			cleanup = undefined;

			const readOnly = mountEl(surfaceChartElement(SURFACE_DATA), true);
			await flushMount();
			expect(
				readOnly
					.querySelector('[data-element-id="sc3d-1"]')
					?.classList.contains('pptx-chart-interactive'),
			).toBeFalsy();
		});

		it('passes the active text-style override to the scene at mount', async () => {
			mountInteractiveEl(surfaceChartElement(SURFACE_DATA), vi.fn(), {
				visible: true,
				cssAnimation: undefined,
				textStyle: { bold: true },
			});
			await flushMount();

			expect(mountSurfaceChart3D).toHaveBeenCalledExactlyOnceWith(
				expect.anything(),
				expect.objectContaining({ textStyle: { bold: true } }),
				expect.anything(),
			);
		});
	});
});
