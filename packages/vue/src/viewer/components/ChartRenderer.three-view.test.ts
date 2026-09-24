/**
 * Regression tests for `ChartRenderer`'s `<pptx-three-view>` wiring (replaces
 * the five per-kind `ChartRenderer.*3d.test.ts` files). The element is real
 * shared infrastructure, harmless without WebGL (its scene mount fails and it
 * keeps the slotted SVG), so these assert the DECISION `ChartRenderer` makes
 * (does a `<pptx-three-view>` mount, with which spec / interactive state) and
 * that its select/drag events reach the SAME `ChartCanvasEditContext` path the
 * 2D mark interaction uses. Mirrors React's `ChartElementView.three-view.test.tsx`.
 */
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { PptxThreeViewElement, Rendering3DFlags } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { computed, nextTick, ref } from 'vue';

import type {
	ChartCanvasEditContext,
	ChartPartSelection,
} from '../composables/chart-part-selection';
import { ChartCanvasEditKey } from '../composables/chart-part-selection';
import { DEFAULT_RENDERING_3D_FLAGS, Rendering3DFlagsKey } from '../composables/rendering-3d-flags';
import ChartRenderer from './ChartRenderer.vue';

function makeElement(chartType: string, id = `ch_${chartType}`): PptxElement {
	const chartData: PptxChartData = {
		chartType,
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [15, 25] },
		],
		...(chartType === 'surface' ? { view3D: { rotX: 15, rotY: 20 } } : {}),
	};
	return { id, type: 'chart', x: 0, y: 0, width: 400, height: 300, chartData } as PptxElement;
}

function makeCtx() {
	const selection = ref<ChartPartSelection | null>(null);
	const updateElement = vi.fn<(id: string, patch: Partial<PptxElement>) => void>();
	const ctx: ChartCanvasEditContext = {
		selection,
		setSelection: (next) => {
			selection.value = next;
		},
		canSelectCharts: () => true,
		canEditChart: () => true,
		updateElement,
	};
	return { ctx, selection, updateElement };
}

function mountChart(
	element: PptxElement,
	flags: Partial<Rendering3DFlags>,
	options: { interactive?: boolean; ctx?: ChartCanvasEditContext } = {},
): VueWrapper {
	return mount(ChartRenderer, {
		props: { element, zIndex: 0, interactive: options.interactive ?? false },
		global: {
			provide: {
				[Rendering3DFlagsKey as symbol]: computed(() => ({
					...DEFAULT_RENDERING_3D_FLAGS,
					...flags,
				})),
				...(options.ctx ? { [ChartCanvasEditKey as symbol]: options.ctx } : {}),
			},
		},
		attachTo: document.body,
	});
}

function threeView(wrapper: VueWrapper): PptxThreeViewElement | null {
	return wrapper.element.querySelector<PptxThreeViewElement>('pptx-three-view');
}

const cases: Array<{ flag: keyof Rendering3DFlags; chartType: string }> = [
	{ flag: 'barChart3D', chartType: 'bar3D' },
	{ flag: 'lineChart3D', chartType: 'line3D' },
	{ flag: 'areaChart3D', chartType: 'area3D' },
	{ flag: 'pieChart3D', chartType: 'pie3D' },
	{ flag: 'surfaceChart3D', chartType: 'surface' },
];

describe('chartRenderer - <pptx-three-view> opt-in gating', () => {
	it.each(cases)(
		'mounts the view for a $chartType chart when $flag is on',
		({ flag, chartType }) => {
			const wrapper = mountChart(makeElement(chartType), { [flag]: true });
			const view = threeView(wrapper);
			expect(view).not.toBeNull();
			expect(view?.spec?.kind).toBe('chart');
			// The shared SVG render is slotted in as the fallback.
			expect(view?.querySelector('svg')).not.toBeNull();
			wrapper.unmount();
		},
	);

	it.each(cases)(
		'stays on the SVG path for a $chartType chart when $flag is off',
		({ chartType }) => {
			const wrapper = mountChart(makeElement(chartType), {});
			expect(threeView(wrapper)).toBeNull();
			expect(wrapper.find('svg').exists()).toBeTruthy();
			wrapper.unmount();
		},
	);

	it.each(cases)(
		'leaves a plain 2D bar chart on the SVG path even when $flag is on',
		({ flag }) => {
			const wrapper = mountChart(makeElement('bar', 'ch_bar_2d'), { [flag]: true });
			expect(threeView(wrapper)).toBeNull();
			wrapper.unmount();
		},
	);

	it('defaults to the SVG path with no flags provider', () => {
		const wrapper = mount(ChartRenderer, { props: { element: makeElement('bar3D'), zIndex: 0 } });
		expect(threeView(wrapper)).toBeNull();
		wrapper.unmount();
	});
});

describe('chartRenderer - <pptx-three-view> wiring', () => {
	it('sets interactive from the editable canvas and forwards the text style', async () => {
		const wrapper = mountChart(
			makeElement('bar3D'),
			{ barChart3D: true },
			{ interactive: true, ctx: makeCtx().ctx },
		);
		await wrapper.setProps({
			animationState: { visible: true, cssAnimation: undefined, textStyle: { bold: true } },
		});
		await nextTick();
		const view = threeView(wrapper);
		expect(view?.interactive).toBeTruthy();
		expect(view?.textStyle).toStrictEqual({ bold: true });
		wrapper.unmount();
	});

	it('a pptx-three-select event selects the chart part, and the scene mirrors it', async () => {
		const { ctx, selection } = makeCtx();
		const wrapper = mountChart(
			makeElement('bar3D'),
			{ barChart3D: true },
			{ interactive: true, ctx },
		);
		const part = { role: 'dataPoint' as const, seriesIndex: 0, pointIndex: 1 };
		threeView(wrapper)!.dispatchEvent(new CustomEvent('pptx-three-select', { detail: { part } }));
		await nextTick();
		expect(selection.value).toStrictEqual({ elementId: 'ch_bar3D', part });
		expect(threeView(wrapper)?.selectedPart).toStrictEqual(part);
		wrapper.unmount();
	});

	it('a pptx-three-drag commit writes the value through the edit context', () => {
		const { ctx, updateElement } = makeCtx();
		const element = makeElement('bar3D');
		const wrapper = mountChart(element, { barChart3D: true }, { interactive: true, ctx });
		threeView(wrapper)!.dispatchEvent(
			new CustomEvent('pptx-three-drag', {
				detail: {
					part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
					value: 99,
					phase: 'commit',
				},
			}),
		);
		expect(updateElement).toHaveBeenCalledWith('ch_bar3D', {
			chartData: {
				...(element.type === 'chart' ? element.chartData : {}),
				series: [
					{ name: 'A', values: [10, 99] },
					{ name: 'B', values: [15, 25] },
				],
			},
		});
		wrapper.unmount();
	});

	it('a read-only mount ignores pptx-three-select', () => {
		const { ctx, selection } = makeCtx();
		const wrapper = mountChart(
			makeElement('bar3D'),
			{ barChart3D: true },
			{ interactive: false, ctx },
		);
		threeView(wrapper)!.dispatchEvent(
			new CustomEvent('pptx-three-select', {
				detail: { part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 } },
			}),
		);
		expect(selection.value).toBeNull();
		wrapper.unmount();
	});
});
