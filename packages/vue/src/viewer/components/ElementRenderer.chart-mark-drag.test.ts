import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type {
	ChartCanvasEditContext,
	ChartPartSelection,
} from '../composables/chart-part-selection';
import { ChartCanvasEditKey } from '../composables/chart-part-selection';
import ElementRenderer from './ElementRenderer.vue';

/**
 * Regression test for W4-H: direct on-canvas dragging of a pie slice through
 * `ElementRenderer` (the Vue port of React's
 * `ElementRenderer.chart-mark-drag.test.tsx`), mirroring the existing bar-drag
 * coverage in ElementRenderer.chart.test.ts but for a mark kind that has no
 * vertical value axis (see chart-interaction-pie.ts).
 */

function makePieChartData(): PptxChartData {
	return {
		chartType: 'pie',
		categories: ['A', 'B', 'C', 'D'],
		series: [{ name: 'S', values: [25, 25, 25, 25] }],
	};
}

function makePieChartElement(): ChartPptxElement {
	return {
		id: 'ch_pie',
		type: 'chart',
		x: 0,
		y: 0,
		width: 300,
		height: 300,
		chartData: makePieChartData(),
	} as ChartPptxElement;
}

function mountChart(): {
	wrapper: VueWrapper;
	updateElement: ReturnType<typeof vi.fn<(id: string, patch: Partial<PptxElement>) => void>>;
} {
	const updateElement = vi.fn<(id: string, patch: Partial<PptxElement>) => void>();
	const selection = ref<ChartPartSelection | null>(null);
	const ctx: ChartCanvasEditContext = {
		selection,
		setSelection: (next) => {
			selection.value = next;
		},
		canSelectCharts: () => true,
		canEditChart: () => true,
		updateElement,
	};
	const wrapper = mount(ElementRenderer, {
		props: {
			element: makePieChartElement() as PptxElement,
			mediaDataUrls: new Map<string, string>(),
			zIndex: 1,
			interactive: true,
		},
		global: { provide: { [ChartCanvasEditKey as symbol]: ctx } },
	});
	return { wrapper, updateElement };
}

/** A square 300x300 SVG at the origin: client coordinates equal view-box units. */
function stubSvgRect(wrapper: VueWrapper): void {
	const svg = wrapper.element.querySelector('svg');
	if (!svg) {
		throw new Error('chart svg not rendered');
	}
	svg.getBoundingClientRect = () =>
		({ top: 0, left: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0 }) as DOMRect;
}

function pointer(type: string, target: Element, clientX: number, clientY: number): void {
	target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }));
}

function querySlice(wrapper: VueWrapper, pointIndex: number): Element {
	const slice = wrapper.element.querySelector(
		`path[data-chart-part='dataPoint'][data-chart-series='0'][data-chart-point='${pointIndex}']`,
	);
	if (!slice) {
		throw new Error('tagged pie slice not rendered');
	}
	return slice;
}

describe('elementRenderer - pie slice drag (W4-H)', () => {
	it('commits a dragged pie slice value through the element-update handler', () => {
		const { wrapper, updateElement } = mountChart();
		stubSvgRect(wrapper);

		// Slice 1 (equal quarters, starting at 12 o'clock) spans [0, 90deg): its
		// leading edge sits at the centre-right (150, 150), its trailing edge at
		// the bottom (150, 200). Dragging the trailing edge out to the centre-left
		// (100, 150) sweeps it to 180deg past the leading edge: half the circle,
		// which renormalises slice 1 to equal the OTHER three slices combined (75).
		const slice = querySlice(wrapper, 1);
		pointer('pointerdown', slice, 150, 150);
		pointer('pointermove', slice, 100, 150);
		pointer('pointerup', slice, 100, 150);

		expect(updateElement).toHaveBeenCalledExactlyOnceWith('ch_pie', expect.anything());
		const [id, updates] = updateElement.mock.calls.at(-1)!;
		expect(id).toBe('ch_pie');
		const data = (updates as { chartData: PptxChartData }).chartData;
		expect(data.series[0].values[1]).toBeCloseTo(75, 0);
		expect(data.series[0].values[0]).toBe(25);
		expect(data.series[0].values[2]).toBe(25);
		expect(data.series[0].values[3]).toBe(25);
	});

	it('treats a press without movement as a click, not a value change', () => {
		const { wrapper, updateElement } = mountChart();
		stubSvgRect(wrapper);

		const slice = querySlice(wrapper, 1);
		pointer('pointerdown', slice, 150, 150);
		pointer('pointerup', slice, 150, 150);

		expect(updateElement).not.toHaveBeenCalled();
	});
});
