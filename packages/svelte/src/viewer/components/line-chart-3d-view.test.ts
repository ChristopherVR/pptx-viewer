import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { ChartPartRef, ElementAnimationState } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LineChart3DContextKey } from '../state/line-chart-3d-context';
import { PresentationElementStatesKey } from '../state/presentation-element-states-context';
import ElementRenderer from './ElementRenderer.svelte';

/**
 * Line3DChartView tests: mirrors `bar-chart-3d-view.test.ts` exactly, swapped
 * onto the `lineChart3D` opt-in / `mountLineChart3D` / `line3D` chart type.
 */

const { mountLineChart3D } = vi.hoisted(() => ({ mountLineChart3D: vi.fn() }));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountLineChart3D: (...args: Parameters<typeof actual.mountLineChart3D>) =>
			mountLineChart3D(...args),
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

function mountEl(element: PptxElement, lineChart3D: boolean): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 2 },
		context: new Map([[LineChart3DContextKey, () => lineChart3D]]),
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function lineChartElement(chartData: PptxChartData | undefined): PptxElement {
	return {
		type: 'chart',
		id: 'lc3d-1',
		x: 10,
		y: 20,
		width: 400,
		height: 240,
		chartData,
	} as PptxElement;
}

const LINE3D_DATA: PptxChartData = {
	chartType: 'line3D',
	categories: ['A', 'B'],
	series: [
		{ name: 'S1', values: [1, 2] },
		{ name: 'S2', values: [3, 4] },
	],
};

const LINE_DATA: PptxChartData = {
	chartType: 'line',
	categories: ['A', 'B'],
	series: [{ name: 'S1', values: [1, 2] }],
};

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
	mountLineChart3D.mockReset();
	mountLineChart3D.mockResolvedValue(okHandle());
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

describe('line3DChartView', () => {
	it('renders the SVG ChartView when lineChart3D is not enabled', async () => {
		const target = mountEl(lineChartElement(LINE3D_DATA), false);
		await flushMount();
		expect(mountLineChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-line-chart-3d')).toBeNull();
	});

	it('renders the SVG ChartView for a plain line chart even when the flag is on', async () => {
		const target = mountEl(lineChartElement(LINE_DATA), true);
		await flushMount();
		expect(mountLineChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-line-chart-3d')).toBeNull();
	});

	it('mounts the WebGL scene on init for a line3D chart when the flag is enabled', async () => {
		const target = mountEl(lineChartElement(LINE3D_DATA), true);
		await flushMount();

		expect(mountLineChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ series: expect.any(Array) }),
		);
		const node = target.querySelector<HTMLElement>('[data-element-id="lc3d-1"]');
		expect(node?.getAttribute('style')).toContain('left: 10px');
		expect(node?.querySelector('.pptx-svelte-line-chart-3d-scene')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-chart')).toBeNull();
	});

	it('falls back to the SVG ChartView when the mount resolves not-ok (three unavailable)', async () => {
		mountLineChart3D.mockResolvedValueOnce(unavailableHandle());
		const target = mountEl(lineChartElement(LINE3D_DATA), true);
		await flushMount();

		expect(target.querySelector('.pptx-svelte-line-chart-3d')).toBeNull();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
	});

	it('stays on the SVG fallback without mounting when the chart has no data', async () => {
		const target = mountEl(lineChartElement(undefined), true);
		await flushMount();

		expect(mountLineChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart-placeholder')).toBeTruthy();
	});

	it('defaults to the SVG fallback when the flag is unset (no context provided)', async () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ElementRenderer, {
			target,
			props: {
				element: lineChartElement(LINE3D_DATA),
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

		expect(mountLineChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-line-chart-3d')).toBeNull();
	});

	it('disposes the scene handle on unmount', async () => {
		const handle = okHandle();
		mountLineChart3D.mockResolvedValue(handle);
		mountEl(lineChartElement(LINE3D_DATA), true);
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
			const context = new Map<symbol, unknown>([[LineChart3DContextKey, () => true]]);
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
			mountInteractiveEl(lineChartElement(LINE3D_DATA), vi.fn());
			await flushMount();

			const interaction = mountLineChart3D.mock.calls[0]?.[2];
			expect(interaction?.onSelect).toBeInstanceOf(Function);
			expect(interaction?.onValueDragPreview).toBeInstanceOf(Function);
			expect(interaction?.onValueDragCommit).toBeInstanceOf(Function);
		});

		it('omits the interaction object when there is no commit handler (not editable)', async () => {
			mountEl(lineChartElement(LINE3D_DATA), true);
			await flushMount();

			expect(mountLineChart3D.mock.calls[0]).toHaveLength(2);
		});

		it('commits a dragged value through onchartpointcommit via withChartPointValue', async () => {
			const onchartpointcommit = vi.fn();
			mountInteractiveEl(lineChartElement(LINE3D_DATA), onchartpointcommit);
			await flushMount();

			const interaction = mountLineChart3D.mock.calls[0]?.[2];
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 1, pointIndex: 0 };
			interaction?.onValueDragCommit(part, 42);
			flushSync();

			expect(onchartpointcommit).toHaveBeenCalledExactlyOnceWith(
				'lc3d-1',
				expect.objectContaining({
					series: [
						expect.objectContaining({ values: [1, 2] }),
						expect.objectContaining({ values: [42, 4] }),
					],
				}),
			);
		});

		it('shows a live drag badge while a value drag preview is active', async () => {
			const target = mountInteractiveEl(lineChartElement(LINE3D_DATA), vi.fn());
			await flushMount();

			const interaction = mountLineChart3D.mock.calls[0]?.[2];
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 };
			interaction?.onValueDragPreview(part, 7);
			flushSync();

			expect(target.querySelector('.pptx-svelte-line-chart-3d-drag-badge')?.textContent).toBe('7');
		});

		it('passes the active text-style override to the scene at mount', async () => {
			mountInteractiveEl(lineChartElement(LINE3D_DATA), vi.fn(), {
				visible: true,
				cssAnimation: undefined,
				textStyle: { bold: true },
			});
			await flushMount();

			expect(mountLineChart3D).toHaveBeenCalledExactlyOnceWith(
				expect.anything(),
				expect.objectContaining({ textStyle: { bold: true } }),
				expect.anything(),
			);
		});
	});
});
