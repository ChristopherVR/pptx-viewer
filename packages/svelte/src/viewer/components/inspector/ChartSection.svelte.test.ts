import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ChartSection from './ChartSection.svelte';

/**
 * Chart subtype pickers (wave 4 #1): bar3D shape, radar style, surface
 * wireframe. Each select is gated on the selected chart's `chartType` and
 * writes back through the shared pure patch function, so a bar3D chart never
 * offers the radar/surface controls and vice versa.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartElement(overrides: Partial<ChartPptxElement['chartData']> = {}): PptxElement {
	return {
		type: 'chart',
		id: 'chart-1',
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		chartData: {
			chartType: 'bar3D',
			categories: ['Q1'],
			series: [{ name: 'Revenue', values: [10] }],
			...overrides,
		},
	} as PptxElement;
}

function editorWith(element: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }]);
	editor.select(element.id);
	return editor;
}

function render(element: PptxElement): { editor: EditorState; target: HTMLElement } {
	const editor = editorWith(element);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartSection, { target, props: { editor } });
	cleanup = () => {
		void unmount(instance);
		target.remove();
	};
	flushSync();
	return { editor, target };
}

function setValue(select: HTMLSelectElement, value: string): void {
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('chartSection chart subtype pickers', () => {
	it('offers the bar3D shape select only for a bar3D chart', () => {
		const { target } = render(chartElement({ chartType: 'bar3D' }));

		expect(target.querySelector('[data-testid="pptx-chart-bar3d-shape"]')).not.toBeNull();
		expect(target.querySelector('[data-testid="pptx-chart-radar-style"]')).toBeNull();
		expect(target.querySelector('[data-testid="pptx-chart-surface-wireframe"]')).toBeNull();
	});

	it('offers the radar style select only for a radar chart', () => {
		const { target } = render(chartElement({ chartType: 'radar' }));

		expect(target.querySelector('[data-testid="pptx-chart-bar3d-shape"]')).toBeNull();
		expect(target.querySelector('[data-testid="pptx-chart-radar-style"]')).not.toBeNull();
		expect(target.querySelector('[data-testid="pptx-chart-surface-wireframe"]')).toBeNull();
	});

	it('offers the surface wireframe select only for a surface chart', () => {
		const { target } = render(chartElement({ chartType: 'surface' }));

		expect(target.querySelector('[data-testid="pptx-chart-bar3d-shape"]')).toBeNull();
		expect(target.querySelector('[data-testid="pptx-chart-radar-style"]')).toBeNull();
		expect(target.querySelector('[data-testid="pptx-chart-surface-wireframe"]')).not.toBeNull();
	});

	it('offers none of the three for a plain bar chart', () => {
		const { target } = render(chartElement({ chartType: 'bar' }));

		expect(target.querySelector('[data-testid="pptx-chart-bar3d-shape"]')).toBeNull();
		expect(target.querySelector('[data-testid="pptx-chart-radar-style"]')).toBeNull();
		expect(target.querySelector('[data-testid="pptx-chart-surface-wireframe"]')).toBeNull();
	});

	it('writes barShape onto the chart data through the shared patch', () => {
		const { editor, target } = render(chartElement({ chartType: 'bar3D' }));
		const select = target.querySelector<HTMLSelectElement>(
			'[data-testid="pptx-chart-bar3d-shape"]',
		)!;

		setValue(select, 'cylinder');

		const chart = editor.selectedElement;
		expect(chart?.type === 'chart' && chart.chartData?.barShape).toBe('cylinder');
	});

	it('writes radarStyle onto the chart data through the shared patch', () => {
		const { editor, target } = render(chartElement({ chartType: 'radar' }));
		const select = target.querySelector<HTMLSelectElement>(
			'[data-testid="pptx-chart-radar-style"]',
		)!;

		setValue(select, 'filled');

		const chart = editor.selectedElement;
		expect(chart?.type === 'chart' && chart.chartData?.radarStyle).toBe('filled');
	});

	it('writes wireframe onto the chart data through the shared patch', () => {
		const { editor, target } = render(chartElement({ chartType: 'surface', wireframe: false }));
		const select = target.querySelector<HTMLSelectElement>(
			'[data-testid="pptx-chart-surface-wireframe"]',
		)!;

		setValue(select, 'true');

		const chart = editor.selectedElement;
		expect(chart?.type === 'chart' && chart.chartData?.wireframe).toBeTruthy();
	});
});

// W4-D: a multi-run title collapses to one run in the dominant style instead
// of leaving a stale second run's text behind.
describe('chartSection title field', () => {
	it('collapses a multi-run title to one run in the dominant style on edit', () => {
		const { editor, target } = render(
			chartElement({
				title: 'Sales Q1',
				titleRuns: [
					{ text: 'Sales ', bold: true },
					{ text: 'Q1 Numbers', italic: true, color: '#FF0000' },
				],
			}),
		);
		const input = target.querySelector<HTMLInputElement>('input')!;
		input.value = 'New Title';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		const chart = editor.selectedElement;
		const chartData = chart?.type === 'chart' ? chart.chartData : undefined;
		expect(chartData?.title).toBe('New Title');
		expect(chartData?.titleRuns).toStrictEqual([
			{ text: 'New Title', italic: true, color: '#FF0000' },
		]);
	});
});
