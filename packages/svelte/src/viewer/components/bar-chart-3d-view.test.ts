import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BarChart3DContextKey } from '../state/bar-chart-3d-context';
import ElementRenderer from './ElementRenderer.svelte';

/**
 * Bar3DChartView tests: the `barChart3D` opt-in dispatch (ElementRenderer
 * only routes to the WebGL renderer when the flag is set via context, and
 * only for a `bar3D` chart's raw `chartType`, never a plain `bar` chart even
 * though `resolveChartKind` folds them together), the on-init WebGL mount
 * (success, `three`/mount unavailable, and the no-plottable-grid fallback),
 * and scene disposal on unmount. Mirrors `surface-chart-3d-view.test.ts`'s
 * mocking pattern for the shared three.js scene controller.
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
	return { ok: true, resize: vi.fn(), dispose: vi.fn() };
}

function unavailableHandle() {
	return { ok: false, resize: vi.fn(), dispose: vi.fn() };
}

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement, barChart3D: boolean): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 2 },
		context: new Map([[BarChart3DContextKey, () => barChart3D]]),
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function barChartElement(chartData: PptxChartData | undefined): PptxElement {
	return {
		type: 'chart',
		id: 'bc3d-1',
		x: 10,
		y: 20,
		width: 400,
		height: 240,
		chartData,
	} as PptxElement;
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

/**
 * Flush the mount promise chain plus the Svelte state-update scheduler.
 * `mountBarChart3D` is awaited across a `tick()`, which needs real event-loop
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
	mountBarChart3D.mockReset();
	mountBarChart3D.mockResolvedValue(okHandle());
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

describe('bar3DChartView', () => {
	it('renders the SVG ChartView when barChart3D is not enabled', async () => {
		const target = mountEl(barChartElement(BAR3D_DATA), false);
		await flushMount();
		expect(mountBarChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-bar-chart-3d')).toBeNull();
	});

	it('renders the SVG ChartView for a plain bar chart even when the flag is on', async () => {
		const target = mountEl(barChartElement(BAR_DATA), true);
		await flushMount();
		expect(mountBarChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-bar-chart-3d')).toBeNull();
	});

	it('mounts the WebGL scene on init for a bar3D chart when the flag is enabled', async () => {
		const target = mountEl(barChartElement(BAR3D_DATA), true);
		await flushMount();

		expect(mountBarChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ boxes: expect.any(Array) }),
		);
		const node = target.querySelector<HTMLElement>('[data-element-id="bc3d-1"]');
		expect(node?.getAttribute('style')).toContain('left: 10px');
		expect(node?.querySelector('.pptx-svelte-bar-chart-3d-scene')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-chart')).toBeNull();
	});

	it('falls back to the SVG ChartView when the mount resolves not-ok (three unavailable)', async () => {
		mountBarChart3D.mockResolvedValueOnce(unavailableHandle());
		const target = mountEl(barChartElement(BAR3D_DATA), true);
		await flushMount();

		expect(target.querySelector('.pptx-svelte-bar-chart-3d')).toBeNull();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
	});

	it('stays on the SVG fallback without mounting when the chart has no data', async () => {
		const target = mountEl(barChartElement(undefined), true);
		await flushMount();

		expect(mountBarChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart-placeholder')).toBeTruthy();
	});

	it('defaults to the SVG fallback when the flag is unset (no context provided)', async () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ElementRenderer, {
			target,
			props: {
				element: barChartElement(BAR3D_DATA),
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

		expect(mountBarChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-bar-chart-3d')).toBeNull();
	});

	it('disposes the scene handle on unmount', async () => {
		const handle = okHandle();
		mountBarChart3D.mockResolvedValue(handle);
		mountEl(barChartElement(BAR3D_DATA), true);
		await flushMount();

		cleanup?.();
		cleanup = undefined;
		expect(handle.dispose).toHaveBeenCalledOnce();
	});
});
