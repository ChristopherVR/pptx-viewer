import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

import type {
	ChartCanvasEditContext,
	ChartPartSelection,
} from '../composables/chart-part-selection';
import { ChartCanvasEditKey } from '../composables/chart-part-selection';
import ElementRenderer from './ElementRenderer.vue';

/**
 * Regression tests for direct on-canvas chart editing wiring (the Vue port of
 * React's `ElementRenderer.chart.test.tsx`).
 *
 * These render THROUGH `ElementRenderer` (not the leaf composable) and assert
 * that: data marks carry the hit-testing attributes, dragging a bar vertically
 * commits a chart-data update through the injected element-update path,
 * double-clicking the title opens the inline title editor and commits, and the
 * whole surface is inert when the chart is not editable or has no context.
 */

function makeChartData(): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1', 'Q2', 'Q3'],
		series: [
			{ name: 'Revenue', values: [100, 150, 120] },
			{ name: 'Cost', values: [80, 90, 100] },
		],
		title: 'Sales',
		style: { hasTitle: true, hasLegend: true, legendPosition: 'b' },
	};
}

function makeChartElement(): ChartPptxElement {
	return {
		id: 'ch_1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: makeChartData(),
	} as ChartPptxElement;
}

interface MountResult {
	wrapper: VueWrapper;
	updateElement: ReturnType<typeof vi.fn<(id: string, patch: Partial<PptxElement>) => void>>;
	selection: ReturnType<typeof ref<ChartPartSelection | null>>;
}

function mountChart(options: { editable?: boolean; withContext?: boolean } = {}): MountResult {
	const { editable = true, withContext = true } = options;
	const updateElement = vi.fn<(id: string, patch: Partial<PptxElement>) => void>();
	const selection = ref<ChartPartSelection | null>(null);
	const ctx: ChartCanvasEditContext = {
		selection,
		setSelection: (next) => {
			selection.value = next;
		},
		canSelectCharts: () => editable,
		canEditChart: () => editable,
		updateElement,
	};
	const wrapper = mount(ElementRenderer, {
		props: {
			element: makeChartElement() as PptxElement,
			mediaDataUrls: new Map<string, string>(),
			zIndex: 1,
			interactive: true,
		},
		global: withContext ? { provide: { [ChartCanvasEditKey as symbol]: ctx } } : {},
	});
	return { wrapper, updateElement, selection };
}

/** Give the chart SVG a real box so client-Y -> view-box math works. */
function stubSvgRect(wrapper: VueWrapper): void {
	const svg = wrapper.element.querySelector('svg');
	if (!svg) {
		throw new Error('chart svg not rendered');
	}
	svg.getBoundingClientRect = () =>
		({ top: 0, left: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0 }) as DOMRect;
}

function pointer(type: string, target: Element, clientY: number): void {
	target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientY }));
}

function queryBar(wrapper: VueWrapper, seriesIndex: number, pointIndex: number): Element {
	const bar = wrapper.element.querySelector(
		`rect[data-chart-part='dataPoint'][data-chart-series='${seriesIndex}'][data-chart-point='${pointIndex}']`,
	);
	if (!bar) {
		throw new Error('tagged bar not rendered');
	}
	return bar;
}

describe('elementRenderer - on-canvas chart editing wiring', () => {
	it('emits hit-testing attributes on data marks and the title', () => {
		const { wrapper } = mountChart();
		const marks = wrapper.element.querySelectorAll('[data-chart-part]');
		// 6 bars + title.
		expect(marks).toHaveLength(7);
		expect(wrapper.element.querySelector("[data-chart-part='title']")?.textContent).toContain(
			'Sales',
		);
	});

	it('selects the pressed part and highlights its mark', async () => {
		const { wrapper, selection } = mountChart();
		stubSvgRect(wrapper);

		const bar = queryBar(wrapper, 0, 1);
		pointer('pointerdown', bar, 200);
		pointer('pointerup', bar, 200);
		await nextTick();

		expect(selection.value).toStrictEqual({
			elementId: 'ch_1',
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
		});
		expect(bar.classList.contains('pptx-chart-part-selected')).toBeTruthy();
	});

	it('commits a dragged bar value through the element-update handler', () => {
		const { wrapper, updateElement } = mountChart();
		stubSvgRect(wrapper);

		const bar = queryBar(wrapper, 0, 1);
		pointer('pointerdown', bar, 200);
		pointer('pointermove', bar, 100);
		pointer('pointerup', bar, 100);

		// A single commit on release: exactly one history-tracked update, so the
		// drag lands as ONE undo step (Vue's ops.updateElement snapshots history
		// before every commit; there is no cheap-hash gate to bypass here).
		expect(updateElement).toHaveBeenCalledExactlyOnceWith('ch_1', expect.anything());
		const [id, updates] = updateElement.mock.calls.at(-1)!;
		expect(id).toBe('ch_1');
		const data = (updates as { chartData: PptxChartData }).chartData;
		// Dragged upward: the value must increase, other points stay untouched.
		expect(data.series[0].values[1]).toBeGreaterThan(150);
		expect(data.series[0].values[0]).toBe(100);
		expect(data.series[1].values).toStrictEqual([80, 90, 100]);
	});

	it('treats a press without movement as a click, not a value change', () => {
		const { wrapper, updateElement } = mountChart();
		stubSvgRect(wrapper);

		const bar = queryBar(wrapper, 1, 2);
		pointer('pointerdown', bar, 200);
		pointer('pointerup', bar, 200);

		expect(updateElement).not.toHaveBeenCalled();
	});

	it('cancels an in-flight drag with Escape', () => {
		const { wrapper, updateElement } = mountChart();
		stubSvgRect(wrapper);

		const bar = queryBar(wrapper, 0, 0);
		pointer('pointerdown', bar, 200);
		pointer('pointermove', bar, 120);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		pointer('pointerup', bar, 120);

		expect(updateElement).not.toHaveBeenCalled();
	});

	it('edits the title in place on double-click', async () => {
		const { wrapper, updateElement } = mountChart();

		const title = wrapper.element.querySelector("[data-chart-part='title']")!;
		title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		await nextTick();

		const input = wrapper.find('input.pptx-vue-chart-title-input');
		expect(input.exists()).toBeTruthy();
		expect((input.element as HTMLInputElement).value).toBe('Sales');

		await input.setValue('FY26 Sales');
		await input.trigger('keydown', { key: 'Enter' });

		expect(updateElement).toHaveBeenCalledOnce();
		const [, updates] = updateElement.mock.calls[0];
		const data = (updates as { chartData: PptxChartData }).chartData;
		expect(data.title).toBe('FY26 Sales');
		expect(data.style?.hasTitle).toBeTruthy();
	});

	it('is inert when the chart is not editable', () => {
		const { wrapper, updateElement, selection } = mountChart({ editable: false });
		stubSvgRect(wrapper);

		const bar = queryBar(wrapper, 0, 0);
		pointer('pointerdown', bar, 200);
		pointer('pointermove', bar, 100);
		pointer('pointerup', bar, 100);

		expect(updateElement).not.toHaveBeenCalled();
		expect(selection.value).toBeNull();
		expect(wrapper.element.querySelector('.pptx-chart-interactive')).toBeNull();
	});

	it('renders inert marks without an editing context', () => {
		const { wrapper, updateElement } = mountChart({ withContext: false });
		stubSvgRect(wrapper);

		const bar = queryBar(wrapper, 0, 0);
		pointer('pointerdown', bar, 200);
		pointer('pointermove', bar, 100);
		pointer('pointerup', bar, 100);

		expect(updateElement).not.toHaveBeenCalled();
		expect(wrapper.element.querySelectorAll('[data-chart-part]')).toHaveLength(7);
		expect(wrapper.element.querySelector('.pptx-chart-interactive')).toBeNull();
	});
});
