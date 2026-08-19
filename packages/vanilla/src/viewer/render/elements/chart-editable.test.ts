/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own locals; not intended as one statement */
import type { ChartPptxElement } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ElementRenderContext } from '../types';
import { renderChartElement } from './chart';

/**
 * On-canvas chart value dragging (vanilla).
 *
 * Before this landed the vanilla projector emitted the `data-chart-*` hit
 * targets and nothing listened to them, so a chart mark could not be selected
 * or dragged at all - the capability existed in React / Vue / Angular only.
 */
const element: ChartPptxElement = {
	id: 'chart-1',
	type: 'chart',
	x: 0,
	y: 0,
	width: 400,
	height: 300,
	chartData: {
		chartType: 'bar',
		categories: ['A', 'B', 'C'],
		series: [{ name: 'S1', values: [10, 20, 30] }],
	},
};

function makeContext(overrides: Partial<ElementRenderContext> = {}): ElementRenderContext {
	return {
		document,
		t: (key: string) => key,
		smartArt3D: false,
		presenting: false,
		interactive: true,
		registry: {} as ElementRenderContext['registry'],
		renderChild: () => null,
		...overrides,
	} as ElementRenderContext;
}

/** Dispatch a pointer event the jsdom way (PointerEvent is not implemented). */
function pointer(target: EventTarget, type: string, clientY: number): void {
	const event = new MouseEvent(type, { bubbles: true, clientY, cancelable: true });
	target.dispatchEvent(event);
}

/**
 * Continue a gesture from the window, which is where the rest of a real drag
 * arrives from: each preview repaint replaces the `<svg>`, so the node the
 * pointer went down on is detached before the second frame and a browser routes
 * the remaining events by hit test (or pointer capture), never through it.
 */
function drag(clientY: number, type: 'pointermove' | 'pointerup'): void {
	pointer(window, type, clientY);
}

describe('vanilla chart on-canvas value drag', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('does not arm the marks without an editable context', () => {
		const container = renderChartElement(element, 1, makeContext({ interactive: false }));
		expect(container?.classList.contains('pptx-chart-interactive')).toBeFalsy();
	});

	it('arms the marks when the stage supplies a commit handler', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(element, 1, makeContext({ onChartPointChange }));
		expect(container?.classList.contains('pptx-chart-interactive')).toBeTruthy();
		expect(container?.querySelectorAll('[data-chart-part="dataPoint"]').length).toBe(3);
	});

	it('commits ONCE on release, with the dragged value applied', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(element, 1, makeContext({ onChartPointChange }));
		document.body.appendChild(container as HTMLElement);
		const bar = container?.querySelector('[data-chart-part="dataPoint"]') as SVGElement;
		const svg = container?.querySelector('svg') as SVGSVGElement;
		// jsdom lays nothing out, so the drag scale has to be supplied.
		vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ height: 300 } as DOMRect);

		pointer(bar, 'pointerdown', 100);
		drag(140, 'pointermove');
		drag(180, 'pointermove');
		drag(180, 'pointerup');

		expect(onChartPointChange).toHaveBeenCalledOnce();
		const [, chartData] = onChartPointChange.mock.calls[0];
		// Dragged DOWN, so the first point's value fell from 10 and the other two
		// are untouched.
		expect(chartData.series[0].values[0]).toBeLessThan(10);
		expect(chartData.series[0].values.slice(1)).toStrictEqual([20, 30]);
	});

	it('treats a press with no travel as a selection, not an edit', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(element, 1, makeContext({ onChartPointChange }));
		document.body.appendChild(container as HTMLElement);
		const bar = container?.querySelector('[data-chart-part="dataPoint"]') as SVGElement;
		const svg = container?.querySelector('svg') as SVGSVGElement;
		vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ height: 300 } as DOMRect);

		pointer(bar, 'pointerdown', 100);
		drag(101, 'pointermove');
		drag(101, 'pointerup');

		expect(onChartPointChange).not.toHaveBeenCalled();
		// The mark is still highlighted as the current selection.
		expect(container?.querySelectorAll('.pptx-chart-part-selected').length).toBe(1);
	});

	it('cancels the drag on Escape without committing', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(element, 1, makeContext({ onChartPointChange }));
		document.body.appendChild(container as HTMLElement);
		const bar = container?.querySelector('[data-chart-part="dataPoint"]') as SVGElement;
		const svg = container?.querySelector('svg') as SVGSVGElement;
		vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ height: 300 } as DOMRect);

		pointer(bar, 'pointerdown', 100);
		drag(180, 'pointermove');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		drag(180, 'pointerup');

		expect(onChartPointChange).not.toHaveBeenCalled();
	});
});

/**
 * Double-clicking the chart title opens an inline `<input>` editor; the
 * commit routes through the SAME `onChartPointChange` path a dragged data
 * point uses, since both are just a `chartData` patch.
 */
describe('vanilla chart title double-click rename', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	const titled: ChartPptxElement = {
		...element,
		chartData: { ...element.chartData!, title: 'Sales', style: { hasTitle: true } },
	};

	function dblclick(target: EventTarget): void {
		target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
	}

	it('opens an input pre-filled with the current title on double-click', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(titled, 1, makeContext({ onChartPointChange }));
		document.body.appendChild(container as HTMLElement);
		const titleNode = container?.querySelector('[data-chart-part="title"]') as SVGElement;

		dblclick(titleNode);

		const input = container?.querySelector('.pptxv-chart-title-input') as HTMLInputElement | null;
		expect(input).not.toBeNull();
		expect(input?.value).toBe('Sales');
	});

	it('commits the edited title on Enter, through onChartPointChange', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(titled, 1, makeContext({ onChartPointChange }));
		document.body.appendChild(container as HTMLElement);
		const titleNode = container?.querySelector('[data-chart-part="title"]') as SVGElement;

		dblclick(titleNode);
		const input = container?.querySelector('.pptxv-chart-title-input') as HTMLInputElement;
		input.value = 'Quarterly Sales';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		expect(onChartPointChange).toHaveBeenCalledOnce();
		const [, chartData] = onChartPointChange.mock.calls[0];
		expect(chartData.title).toBe('Quarterly Sales');
		expect(chartData.style?.hasTitle).toBeTruthy();
		expect(container?.querySelector('.pptxv-chart-title-input')).toBeNull();
	});

	it('cancels on Escape without committing', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(titled, 1, makeContext({ onChartPointChange }));
		document.body.appendChild(container as HTMLElement);
		const titleNode = container?.querySelector('[data-chart-part="title"]') as SVGElement;

		dblclick(titleNode);
		const input = container?.querySelector('.pptxv-chart-title-input') as HTMLInputElement;
		input.value = 'Discarded';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(onChartPointChange).not.toHaveBeenCalled();
		expect(container?.querySelector('.pptxv-chart-title-input')).toBeNull();
	});

	it('does not open the title editor for a mark double-click', () => {
		const onChartPointChange = vi.fn();
		const container = renderChartElement(element, 1, makeContext({ onChartPointChange }));
		document.body.appendChild(container as HTMLElement);
		const bar = container?.querySelector('[data-chart-part="dataPoint"]') as SVGElement;

		dblclick(bar);

		expect(container?.querySelector('.pptxv-chart-title-input')).toBeNull();
	});
});
