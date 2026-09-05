/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own locals; not intended as one statement */
import type { ChartPptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ChartDragController } from './chart-drag.svelte';

/**
 * Regression test for W4-H: direct on-canvas dragging of a pie slice (Svelte
 * port of chart-interaction-mark-drag.test.ts / the React and Vue
 * `ElementRenderer.chart-mark-drag.test` files), covering the Svelte wrapper's
 * contract for a mark kind that has no vertical value axis.
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

/** A chart root carrying one draggable pie-slice mark, square 1:1 client-to-view-box. */
function makeRoot(): { root: HTMLElement; slice: Element } {
	const root = document.createElement('div');
	root.innerHTML =
		'<svg><path data-chart-part="dataPoint" data-chart-series="0" data-chart-point="1"></path></svg>';
	const svg = root.querySelector('svg') as SVGSVGElement;
	vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
		left: 0,
		top: 0,
		width: 300,
		height: 300,
	} as DOMRect);
	document.body.appendChild(root);
	return { root, slice: root.querySelector('[data-chart-part]') as Element };
}

function press(
	controller: ChartDragController,
	target: Element,
	clientX: number,
	clientY: number,
): void {
	const event = new MouseEvent('pointerdown', {
		bubbles: true,
		clientX,
		clientY,
		cancelable: true,
	});
	Object.defineProperty(event, 'target', { value: target });
	controller.onpointerdown(event as unknown as PointerEvent);
}

function move(clientX: number, clientY: number): void {
	window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX, clientY }));
}

function release(): void {
	window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
}

describe('svelte chart on-canvas pie slice drag', () => {
	it('previews during the drag and commits ONCE on release, renormalising the slice', () => {
		const commit = vi.fn(),
			{ root, slice } = makeRoot(),
			controller = new ChartDragController({
				element: () => pieElement,
				root: () => root,
				commit,
			});

		// Slice 1's leading edge sits at (150, 150) (3 o'clock), its own current
		// trailing edge at (150, 200) (6 o'clock). Sweeping to (100, 150) (9
		// o'clock) is half the circle past the leading edge: slice 1 renormalises
		// to equal the other three slices combined (75).
		press(controller, slice, 150, 150);
		move(100, 150);
		expect(controller.preview).not.toBeNull();
		expect(controller.label).not.toBeNull();
		expect(commit).not.toHaveBeenCalled();
		release();

		expect(commit).toHaveBeenCalledOnce();
		const [id, chartData] = commit.mock.calls[0];
		expect(id).toBe('chart-pie');
		expect(chartData.series[0].values[1]).toBeCloseTo(75, 0);
		expect(chartData.series[0].values[0]).toBe(25);
		expect(controller.preview).toBeNull();
	});

	it('treats a press with no travel as a selection, not an edit', () => {
		const commit = vi.fn(),
			{ root, slice } = makeRoot(),
			controller = new ChartDragController({
				element: () => pieElement,
				root: () => root,
				commit,
			});

		press(controller, slice, 150, 150);
		move(151, 150);
		release();

		expect(commit).not.toHaveBeenCalled();
		expect(controller.selectedPart).toStrictEqual({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 1,
		});
	});
});
