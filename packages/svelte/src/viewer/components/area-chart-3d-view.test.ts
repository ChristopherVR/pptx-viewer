import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { ChartPartRef, ElementAnimationState } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AreaChart3DContextKey } from '../state/area-chart-3d-context';
import { PresentationElementStatesKey } from '../state/presentation-element-states-context';
import ElementRenderer from './ElementRenderer.svelte';

/**
 * Area3DChartView tests: mirrors `bar-chart-3d-view.test.ts` /
 * `line-chart-3d-view.test.ts` exactly, swapped onto the `areaChart3D`
 * opt-in / `mountAreaChart3D` / `area3D` chart type.
 */

const { mountAreaChart3D } = vi.hoisted(() => ({ mountAreaChart3D: vi.fn() }));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountAreaChart3D: (...args: Parameters<typeof actual.mountAreaChart3D>) =>
			mountAreaChart3D(...args),
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

function mountEl(element: PptxElement, areaChart3D: boolean): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 2 },
		context: new Map([[AreaChart3DContextKey, () => areaChart3D]]),
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function areaChartElement(chartData: PptxChartData | undefined): PptxElement {
	return {
		type: 'chart',
		id: 'ac3d-1',
		x: 10,
		y: 20,
		width: 400,
		height: 240,
		chartData,
	} as PptxElement;
}

const AREA3D_DATA: PptxChartData = {
	chartType: 'area3D',
	categories: ['A', 'B'],
	series: [
		{ name: 'S1', values: [1, 2] },
		{ name: 'S2', values: [3, 4] },
	],
};

const AREA_DATA: PptxChartData = {
	chartType: 'area',
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
	mountAreaChart3D.mockReset();
	mountAreaChart3D.mockResolvedValue(okHandle());
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

describe('area3DChartView', () => {
	it('renders the SVG ChartView when areaChart3D is not enabled', async () => {
		const target = mountEl(areaChartElement(AREA3D_DATA), false);
		await flushMount();
		expect(mountAreaChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-area-chart-3d')).toBeNull();
	});

	it('renders the SVG ChartView for a plain area chart even when the flag is on', async () => {
		const target = mountEl(areaChartElement(AREA_DATA), true);
		await flushMount();
		expect(mountAreaChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-area-chart-3d')).toBeNull();
	});

	it('mounts the WebGL scene on init for an area3D chart when the flag is enabled', async () => {
		const target = mountEl(areaChartElement(AREA3D_DATA), true);
		await flushMount();

		expect(mountAreaChart3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ series: expect.any(Array) }),
		);
		const node = target.querySelector<HTMLElement>('[data-element-id="ac3d-1"]');
		expect(node?.getAttribute('style')).toContain('left: 10px');
		expect(node?.querySelector('.pptx-svelte-area-chart-3d-scene')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-chart')).toBeNull();
	});

	it('falls back to the SVG ChartView when the mount resolves not-ok (three unavailable)', async () => {
		mountAreaChart3D.mockResolvedValueOnce(unavailableHandle());
		const target = mountEl(areaChartElement(AREA3D_DATA), true);
		await flushMount();

		expect(target.querySelector('.pptx-svelte-area-chart-3d')).toBeNull();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
	});

	it('stays on the SVG fallback without mounting when the chart has no data', async () => {
		const target = mountEl(areaChartElement(undefined), true);
		await flushMount();

		expect(mountAreaChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart-placeholder')).toBeTruthy();
	});

	it('defaults to the SVG fallback when the flag is unset (no context provided)', async () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ElementRenderer, {
			target,
			props: {
				element: areaChartElement(AREA3D_DATA),
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

		expect(mountAreaChart3D).not.toHaveBeenCalled();
		expect(target.querySelector('.pptx-svelte-chart')).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-area-chart-3d')).toBeNull();
	});

	it('disposes the scene handle on unmount', async () => {
		const handle = okHandle();
		mountAreaChart3D.mockResolvedValue(handle);
		mountEl(areaChartElement(AREA3D_DATA), true);
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
			const context = new Map<symbol, unknown>([[AreaChart3DContextKey, () => true]]);
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
			mountInteractiveEl(areaChartElement(AREA3D_DATA), vi.fn());
			await flushMount();

			const interaction = mountAreaChart3D.mock.calls[0]?.[2];
			expect(interaction?.onSelect).toBeInstanceOf(Function);
			expect(interaction?.onValueDragPreview).toBeInstanceOf(Function);
			expect(interaction?.onValueDragCommit).toBeInstanceOf(Function);
		});

		it('omits the interaction object when there is no commit handler (not editable)', async () => {
			mountEl(areaChartElement(AREA3D_DATA), true);
			await flushMount();

			expect(mountAreaChart3D.mock.calls[0]).toHaveLength(2);
		});

		it('commits a dragged value through onchartpointcommit via withChartPointValue', async () => {
			const onchartpointcommit = vi.fn();
			mountInteractiveEl(areaChartElement(AREA3D_DATA), onchartpointcommit);
			await flushMount();

			const interaction = mountAreaChart3D.mock.calls[0]?.[2];
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };
			interaction?.onValueDragCommit(part, 42);
			flushSync();

			expect(onchartpointcommit).toHaveBeenCalledExactlyOnceWith(
				'ac3d-1',
				expect.objectContaining({
					series: [
						expect.objectContaining({ values: [1, 42] }),
						expect.objectContaining({ values: [3, 4] }),
					],
				}),
			);
		});

		it('shows a live drag badge while a value drag preview is active', async () => {
			const target = mountInteractiveEl(areaChartElement(AREA3D_DATA), vi.fn());
			await flushMount();

			const interaction = mountAreaChart3D.mock.calls[0]?.[2];
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 };
			interaction?.onValueDragPreview(part, 7);
			flushSync();

			expect(target.querySelector('.pptx-svelte-area-chart-3d-drag-badge')?.textContent).toBe('7');
		});

		it('passes the active text-style override to the scene at mount', async () => {
			mountInteractiveEl(areaChartElement(AREA3D_DATA), vi.fn(), {
				visible: true,
				cssAnimation: undefined,
				textStyle: { bold: true },
			});
			await flushMount();

			expect(mountAreaChart3D).toHaveBeenCalledExactlyOnceWith(
				expect.anything(),
				expect.objectContaining({ textStyle: { bold: true } }),
				expect.anything(),
			);
		});
	});
});
