/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own locals; not intended as one statement */
import type { ChartPptxElement } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ElementRenderContext } from '../types';
import { renderChartElement } from './chart';

/**
 * Regression test for W4-H: direct on-canvas dragging of a pie slice (vanilla
 * port of chart-interaction-mark-drag.test.ts / the other bindings'
 * `chart-mark-drag` tests), covering a mark kind that has no vertical value
 * axis (see chart-interaction-pie.ts).
 */
const pieElement: ChartPptxElement = {
	id: 'chart-pie',
	type: 'chart',
	x: 0,
	y: 0,
	width: 300,
	height: 300,
	chartData: {
		chartType: 'pie',
		categories: ['A', 'B', 'C', 'D'],
		series: [{ name: 'S1', values: [25, 25, 25, 25] }],
	},
};

function makeContext(overrides: Partial<ElementRenderContext> = {}): ElementRenderContext {
	return {
		document,
		t: (key: string) => key,
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting: false,
		interactive: true,
		selectedElementIds: new Set([pieElement.id]),
		registry: {} as ElementRenderContext['registry'],
		renderChild: () => null,
		...overrides,
	} as ElementRenderContext;
}

/** Dispatch a pointer event the jsdom way (PointerEvent is not implemented). */
function pointer(target: EventTarget, type: string, clientX: number, clientY: number): void {
	const event = new MouseEvent(type, { bubbles: true, clientX, clientY, cancelable: true });
	target.dispatchEvent(event);
}

/**
 * Continue a gesture from the window, which is where the rest of a real drag
 * arrives from (see chart-editable.test.ts's identical helper).
 */
function drag(clientX: number, clientY: number, type: 'pointermove' | 'pointerup'): void {
	pointer(window, type, clientX, clientY);
}

describe('vanilla chart on-canvas pie slice drag', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('commits ONCE on release, renormalising the dragged slice', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(pieElement, 1, makeContext({ onChartPointChange }));
		document.body.appendChild(container as HTMLElement);
		const slice = container?.querySelectorAll('[data-chart-part="dataPoint"]')[1] as SVGElement;
		const svg = container?.querySelector('svg') as SVGSVGElement;
		// A square 1:1 client-to-view-box rect.
		vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			width: 300,
			height: 300,
		} as DOMRect);

		// Slice 1's leading edge sits at (150, 150) (3 o'clock), its own current
		// trailing edge at (150, 200) (6 o'clock). Sweeping to (100, 150) (9
		// o'clock) is half the circle past the leading edge: slice 1 renormalises
		// to equal the other three slices combined (75).
		pointer(slice, 'pointerdown', 150, 150);
		drag(100, 150, 'pointermove');
		drag(100, 150, 'pointerup');

		expect(onChartPointChange).toHaveBeenCalledOnce();
		const [, chartData] = onChartPointChange.mock.calls[0];
		expect(chartData.series[0].values[1]).toBeCloseTo(75, 0);
		expect(chartData.series[0].values[0]).toBe(25);
	});

	it('treats a press with no travel as a selection, not an edit', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(pieElement, 1, makeContext({ onChartPointChange }));
		document.body.appendChild(container as HTMLElement);
		const slice = container?.querySelectorAll('[data-chart-part="dataPoint"]')[1] as SVGElement;
		const svg = container?.querySelector('svg') as SVGSVGElement;
		vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			width: 300,
			height: 300,
		} as DOMRect);

		pointer(slice, 'pointerdown', 150, 150);
		drag(151, 150, 'pointermove');
		drag(151, 150, 'pointerup');

		expect(onChartPointChange).not.toHaveBeenCalled();
		expect(container?.querySelectorAll('.pptx-chart-part-selected').length).toBe(1);
	});
});
