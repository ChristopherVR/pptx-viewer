// @vitest-environment happy-dom
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
/**
 * Regression tests for direct on-canvas chart editing wiring.
 *
 * These render THROUGH {@link ElementRenderer} (not the leaf ChartElementView)
 * and assert that: data marks carry the hit-testing attributes, dragging a bar
 * vertically commits a chart-data update through the element-update handler,
 * double-clicking the title opens the inline title editor and commits, and the
 * whole surface is inert when the chart is not selected or has no handler.
 */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

function makeProps(overrides: Partial<ElementRendererProps>): ElementRendererProps {
	return {
		element: makeChartElement(),
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
		adjustmentHandleDescriptor: null,
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

/** Give the chart SVG a real box so client-Y -> view-box math works. */
function stubSvgRect(): void {
	const svg = container.querySelector('svg');
	if (!svg) {
		throw new Error('chart svg not rendered');
	}
	svg.getBoundingClientRect = () =>
		({ top: 0, left: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0 }) as DOMRect;
}

function pointer(type: string, target: Element, clientY: number): void {
	act(() => {
		target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientY }));
	});
}

function queryBar(seriesIndex: number, pointIndex: number): Element {
	const bar = container.querySelector(
		`rect[data-chart-part='dataPoint'][data-chart-series='${seriesIndex}'][data-chart-point='${pointIndex}']`,
	);
	if (!bar) {
		throw new Error('tagged bar not rendered');
	}
	return bar;
}

describe('elementRenderer - on-canvas chart editing wiring', () => {
	it('emits hit-testing attributes on data marks and the title', () => {
		mount(makeProps({}));
		const marks = container.querySelectorAll('[data-chart-part]');
		// 6 bars + title.
		expect(marks).toHaveLength(7);
		expect(container.querySelector("[data-chart-part='title']")?.textContent).toBe('Sales');
	});

	it('commits a dragged bar value through the element-update handler', () => {
		const onUpdateSmartArtElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount(makeProps({ onUpdateSmartArtElement }));
		stubSvgRect();

		const bar = queryBar(0, 1);
		pointer('pointerdown', bar, 200);
		pointer('pointermove', bar, 100);
		pointer('pointerup', bar, 100);

		expect(onUpdateSmartArtElement).toHaveBeenCalledWith('ch_1', expect.anything());
		const [id, updates] = onUpdateSmartArtElement.mock.calls.at(-1)!;
		expect(id).toBe('ch_1');
		const data = (updates as { chartData: PptxChartData }).chartData;
		// Dragged upward: the value must increase, other points stay untouched.
		expect(data.series[0].values[1]).toBeGreaterThan(150);
		expect(data.series[0].values[0]).toBe(100);
		expect(data.series[1].values).toStrictEqual([80, 90, 100]);
	});

	it('treats a press without movement as a click, not a value change', () => {
		const onUpdateSmartArtElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount(makeProps({ onUpdateSmartArtElement }));
		stubSvgRect();

		const bar = queryBar(1, 2);
		pointer('pointerdown', bar, 200);
		pointer('pointerup', bar, 200);

		expect(onUpdateSmartArtElement).not.toHaveBeenCalled();
	});

	it('edits the title in place on double-click', () => {
		const onUpdateSmartArtElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount(makeProps({ onUpdateSmartArtElement }));

		const title = container.querySelector("[data-chart-part='title']")!;
		act(() => {
			title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		});

		const input = container.querySelector('input[type="text"]') as HTMLInputElement;
		expect(input).not.toBeNull();
		expect(input.value).toBe('Sales');

		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
		act(() => {
			setter?.call(input, 'FY26 Sales');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
		act(() => {
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		});

		expect(onUpdateSmartArtElement).toHaveBeenCalledOnce();
		const [, updates] = onUpdateSmartArtElement.mock.calls[0];
		const data = (updates as { chartData: PptxChartData }).chartData;
		expect(data.title).toBe('FY26 Sales');
		expect(data.style?.hasTitle).toBeTruthy();
	});

	it('is inert when the chart is not selected', () => {
		const onUpdateSmartArtElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount(makeProps({ isSelected: false, onUpdateSmartArtElement }));
		stubSvgRect();

		const bar = queryBar(0, 0);
		pointer('pointerdown', bar, 200);
		pointer('pointermove', bar, 100);
		pointer('pointerup', bar, 100);

		expect(onUpdateSmartArtElement).not.toHaveBeenCalled();
		expect(container.querySelector('.pptx-chart-interactive')).toBeNull();
	});

	it('is inert without an update handler', () => {
		mount(makeProps({ onUpdateSmartArtElement: undefined }));
		expect(container.querySelector('.pptx-chart-interactive')).toBeNull();
	});
});
