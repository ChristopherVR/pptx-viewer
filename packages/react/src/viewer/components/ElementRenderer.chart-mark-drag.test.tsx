// @vitest-environment happy-dom
/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in the sibling
   chart-editing test file; kept consistent here */
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
/**
 * Regression test for W4-H: direct on-canvas dragging of a pie slice through
 * {@link ElementRenderer} (not the leaf ChartElementView), mirroring the
 * existing bar-drag coverage in ElementRenderer.chart.test.tsx but for a mark
 * kind that has no vertical value axis (see chart-interaction-pie.ts).
 */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElementRenderer } from './ElementRenderer';
import type { ElementRendererProps } from './elements/element-renderer-types';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

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

function makeProps(overrides: Partial<ElementRendererProps>): ElementRendererProps {
	return {
		element: makePieChartElement(),
		isSelected: true,
		isInlineEditing: false,
		inlineEditingText: '',
		canInteract: true,
		spellCheckEnabled: false,
		mediaDataUrls: new Map(),
		selectionColorClass: 'blue-500',
		showHoverBorder: true,
		imageAltText: 'Slide element',
		showResizeHandles: false,
		renderInk: true,
		renderGroups: true,
		adjustmentHandles: [],
		onResizePointerDown: vi.fn<() => void>(),
		onAdjustmentPointerDown: vi.fn<() => void>(),
		onInlineEditChange: vi.fn<() => void>(),
		onInlineEditCommit: vi.fn<() => void>(),
		onInlineEditCancel: vi.fn<() => void>(),
		...overrides,
	};
}

function mount(props: ElementRendererProps): void {
	act(() => {
		root.render(<ElementRenderer {...props} />);
	});
}

/** A square 300x300 SVG at the origin: client coordinates equal view-box units. */
function stubSvgRect(): void {
	const svg = container.querySelector('svg');
	if (!svg) {
		throw new Error('chart svg not rendered');
	}
	svg.getBoundingClientRect = () =>
		({ top: 0, left: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0 }) as DOMRect;
}

function pointer(type: string, target: Element, clientX: number, clientY: number): void {
	act(() => {
		target.dispatchEvent(
			new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }),
		);
	});
}

function querySlice(pointIndex: number): Element {
	const slice = container.querySelector(
		`path[data-chart-part='dataPoint'][data-chart-series='0'][data-chart-point='${pointIndex}']`,
	);
	if (!slice) {
		throw new Error('tagged pie slice not rendered');
	}
	return slice;
}

describe('elementRenderer - pie slice drag (W4-H)', () => {
	it('commits a dragged pie slice value through the element-update handler', () => {
		const onUpdateSmartArtElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount(makeProps({ onUpdateSmartArtElement }));
		stubSvgRect();

		// Slice 1 (equal quarters, starting at 12 o'clock) spans [0, 90deg): its
		// leading edge sits at the centre-right (150, 150), its trailing edge at
		// the bottom (150, 200). Dragging the trailing edge out to the centre-left
		// (100, 150) sweeps it to 180deg past the leading edge: half the circle,
		// which renormalises slice 1 to equal the OTHER three slices combined (75).
		const slice = querySlice(1);
		pointer('pointerdown', slice, 150, 150);
		pointer('pointermove', slice, 100, 150);
		pointer('pointerup', slice, 100, 150);

		expect(onUpdateSmartArtElement).toHaveBeenCalledWith('ch_pie', expect.anything());
		const [id, updates] = onUpdateSmartArtElement.mock.calls.at(-1)!;
		expect(id).toBe('ch_pie');
		const data = (updates as { chartData: PptxChartData }).chartData;
		expect(data.series[0].values[1]).toBeCloseTo(75, 0);
		// The other slices are untouched.
		expect(data.series[0].values[0]).toBe(25);
		expect(data.series[0].values[2]).toBe(25);
		expect(data.series[0].values[3]).toBe(25);
	});

	it('treats a press without movement as a click, not a value change', () => {
		const onUpdateSmartArtElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount(makeProps({ onUpdateSmartArtElement }));
		stubSvgRect();

		const slice = querySlice(1);
		pointer('pointerdown', slice, 150, 150);
		pointer('pointerup', slice, 150, 150);

		expect(onUpdateSmartArtElement).not.toHaveBeenCalled();
	});
});
