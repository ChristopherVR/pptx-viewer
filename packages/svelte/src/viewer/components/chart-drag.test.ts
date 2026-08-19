/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own locals; not intended as one statement */
import type { ChartPptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ChartDragController } from './chart-drag.svelte';

/**
 * On-canvas chart value dragging (Svelte).
 *
 * The Svelte projector emitted the `data-chart-*` hit targets and nothing
 * listened to them, so a chart mark could not be selected or dragged at all -
 * the capability existed in React / Vue / Angular only. The state machine
 * itself lives in `pptx-viewer-shared`; these tests cover the Svelte wrapper's
 * contract (preview, single commit, Escape, threshold, teardown).
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

/**
 * A chart root carrying one draggable mark, standing in for the rendered SVG.
 * `findChartPartTarget` reads the `data-chart-*` attributes off the event
 * target, so the mark only needs those.
 */
function makeRoot(): { root: HTMLElement; mark: Element } {
	const root = document.createElement('div');
	root.innerHTML =
		'<svg><rect data-chart-part="dataPoint" data-chart-series="0" data-chart-point="0"></rect></svg>';
	const svg = root.querySelector('svg') as SVGSVGElement;
	// jsdom lays nothing out, so the drag scale has to be supplied.
	vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ height: 300 } as DOMRect);
	document.body.appendChild(root);
	return { root, mark: root.querySelector('[data-chart-part]') as Element };
}

function press(controller: ChartDragController, mark: Element, clientY: number): void {
	const event = new MouseEvent('pointerdown', { bubbles: true, clientY, cancelable: true });
	Object.defineProperty(event, 'target', { value: mark });
	controller.onpointerdown(event as unknown as PointerEvent);
}

function move(clientY: number): void {
	window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY }));
}

function release(): void {
	window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
}

function makeController(commit: ReturnType<typeof vi.fn>): {
	controller: ChartDragController;
	mark: Element;
	root: HTMLElement;
} {
	const { root, mark } = makeRoot();
	const controller = new ChartDragController({
		element: () => element,
		root: () => root,
		commit,
	});
	return { controller, mark, root };
}

describe('svelte chart on-canvas value drag', () => {
	it('previews during the drag and commits ONCE on release', () => {
		const commit = vi.fn();
		const { controller, mark } = makeController(commit);

		press(controller, mark, 100);
		move(140);
		expect(controller.preview).not.toBeNull();
		expect(controller.label).not.toBeNull();
		move(180);
		expect(commit).not.toHaveBeenCalled();
		release();

		expect(commit).toHaveBeenCalledOnce();
		const [id, chartData] = commit.mock.calls[0];
		expect(id).toBe('chart-1');
		// Dragged DOWN, so the first value fell and the rest are untouched.
		expect(chartData.series[0].values[0]).toBeLessThan(10);
		expect(chartData.series[0].values.slice(1)).toStrictEqual([20, 30]);
		// The preview is cleared, so the committed element is what renders.
		expect(controller.preview).toBeNull();
	});

	it('treats a press with no travel as a selection, not an edit', () => {
		const commit = vi.fn();
		const { controller, mark } = makeController(commit);

		press(controller, mark, 100);
		move(101);
		release();

		expect(commit).not.toHaveBeenCalled();
		expect(controller.selectedPart).toStrictEqual({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 0,
		});
	});

	it('cancels on Escape, discarding the preview', () => {
		const commit = vi.fn();
		const { controller, mark } = makeController(commit);

		press(controller, mark, 100);
		move(180);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		release();

		expect(commit).not.toHaveBeenCalled();
		expect(controller.preview).toBeNull();
	});

	it('stops listening once destroyed mid-drag', () => {
		const commit = vi.fn();
		const { controller, mark } = makeController(commit);

		press(controller, mark, 100);
		controller.destroy();
		move(180);
		release();

		expect(commit).not.toHaveBeenCalled();
	});

	it('highlights the selected mark inside its own root', () => {
		const commit = vi.fn();
		const { controller, mark, root } = makeController(commit);

		press(controller, mark, 100);
		controller.syncHighlight();

		expect(root.querySelectorAll('.pptx-chart-part-selected')).toHaveLength(1);
	});
});

/**
 * Double-clicking the chart title opens an inline editor; the commit routes
 * through the SAME `commit` callback a value drag uses (both are just a
 * `chartData` patch), so undo/redo and the save round-trip work identically.
 */
describe('svelte chart title double-click rename', () => {
	const titledElement: ChartPptxElement = {
		...element,
		chartData: { ...element.chartData!, title: 'Sales', style: { hasTitle: true } },
	};

	function dblclick(target: Element): MouseEvent {
		const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'target', { value: target });
		return event;
	}

	function makeTitleRoot(): { root: HTMLElement; title: Element } {
		const root = document.createElement('div');
		root.innerHTML = '<svg><text data-chart-part="title">Sales</text></svg>';
		document.body.appendChild(root);
		return { root, title: root.querySelector("[data-chart-part='title']") as Element };
	}

	it('opens the title draft with the current title on double-click', () => {
		const commit = vi.fn();
		const { root, title } = makeTitleRoot();
		const controller = new ChartDragController({
			element: () => titledElement,
			root: () => root,
			commit,
		});

		const event = dblclick(title);
		const stopPropagation = vi.spyOn(event, 'stopPropagation');
		controller.ondblclick(event);

		expect(controller.titleDraft).toBe('Sales');
		// The ARGUMENTS are not the point here; that it was called at all is.
		// oxlint-disable-next-line vitest/prefer-called-with
		expect(stopPropagation).toHaveBeenCalled();
	});

	it('commits the edited title through the commit callback', () => {
		const commit = vi.fn();
		const { root, title } = makeTitleRoot();
		const controller = new ChartDragController({
			element: () => titledElement,
			root: () => root,
			commit,
		});

		controller.ondblclick(dblclick(title));
		controller.setTitleDraft('Quarterly Sales');
		controller.commitTitle();

		expect(commit).toHaveBeenCalledOnce();
		const [id, chartData] = commit.mock.calls[0];
		expect(id).toBe('chart-1');
		expect(chartData.title).toBe('Quarterly Sales');
		expect(chartData.style?.hasTitle).toBeTruthy();
		expect(controller.titleDraft).toBeNull();
	});

	it('cancels on Escape without committing', () => {
		const commit = vi.fn();
		const { root, title } = makeTitleRoot();
		const controller = new ChartDragController({
			element: () => titledElement,
			root: () => root,
			commit,
		});

		controller.ondblclick(dblclick(title));
		controller.cancelTitle();

		expect(commit).not.toHaveBeenCalled();
		expect(controller.titleDraft).toBeNull();
	});

	it('stops a mark double-click from bubbling, without opening the title editor', () => {
		const commit = vi.fn();
		const { controller, mark } = makeController(commit);

		const event = dblclick(mark);
		const stopPropagation = vi.spyOn(event, 'stopPropagation');
		controller.ondblclick(event);

		// The ARGUMENTS are not the point here; that it was called at all is.
		// oxlint-disable-next-line vitest/prefer-called-with
		expect(stopPropagation).toHaveBeenCalled();
		expect(controller.titleDraft).toBeNull();
	});
});
