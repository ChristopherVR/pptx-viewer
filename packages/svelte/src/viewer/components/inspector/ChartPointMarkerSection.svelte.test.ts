import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ChartPointMarkerSection from './ChartPointMarkerSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartElement(overrides: Partial<PptxChartData> = {}): ChartPptxElement {
	return {
		id: 'chart-1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'line',
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [10, 20] }],
			...overrides,
		},
	} as ChartPptxElement;
}

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	return editor;
}

function mountSection(
	element: ChartPptxElement,
	canEdit = true,
): { target: HTMLElement; editor: EditorState; onsetpointmarker: ReturnType<typeof vi.fn> } {
	const onsetpointmarker = vi.fn();
	const editor = makeEditor();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartPointMarkerSection, {
		target,
		props: { editor, element, canEdit, onsetpointmarker },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, editor, onsetpointmarker };
}

function setValue(control: HTMLSelectElement | HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

function check(control: HTMLInputElement, next: boolean): void {
	control.checked = next;
	control.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

const WITH_OVERRIDE: Partial<PptxChartData> = {
	series: [
		{
			name: 'Revenue',
			values: [10, 20],
			dataPoints: [{ idx: 1, marker: { symbol: 'star', size: 12 } }],
		},
	],
};

describe('chartPointMarkerSection', () => {
	it('hides itself on chart types that do not draw markers', () => {
		const { target } = mountSection(chartElement({ chartType: 'bar' }));

		expect(target.querySelector('.pptx-svelte-chart-point-markers')).toBeNull();
	});

	it('offers one override toggle per category', () => {
		const { target } = mountSection(chartElement());

		expect(target.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
	});

	it('hides the series picker for a single-series chart', () => {
		const { target } = mountSection(chartElement());

		expect(target.querySelector('.picker')).toBeNull();
	});

	it('shows the series picker once there is more than one series', () => {
		const { target } = mountSection(
			chartElement({
				series: [
					{ name: 'Revenue', values: [10, 20] },
					{ name: 'Cost', values: [5, 6] },
				],
			}),
		);

		expect(target.querySelector('.picker')).not.toBeNull();
	});

	it('seeds a circle override when a point is toggled on', () => {
		const { target, onsetpointmarker } = mountSection(chartElement());

		check(target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1], true);

		expect(onsetpointmarker).toHaveBeenCalledWith(0, 1, { symbol: 'circle' });
	});

	it('clears the override when the point is toggled off', () => {
		const { target, onsetpointmarker } = mountSection(chartElement(WITH_OVERRIDE));

		check(target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1], false);

		expect(onsetpointmarker).toHaveBeenCalledWith(0, 1, null);
	});

	it('reveals symbol, size and fill only for the overridden point', () => {
		const { target } = mountSection(chartElement(WITH_OVERRIDE));

		expect(target.querySelectorAll('.overrides')).toHaveLength(1);
		expect(target.querySelector<HTMLSelectElement>('.overrides select')!.value).toBe('star');
		expect(target.querySelector<HTMLInputElement>('.overrides input[type="number"]')!.value).toBe(
			'12',
		);
	});

	it('omits the auto sentinel from the symbol list', () => {
		const { target } = mountSection(chartElement(WITH_OVERRIDE));
		const options = Array.from(
			target.querySelectorAll<HTMLOptionElement>('.overrides select option'),
		).map((option) => option.value);

		expect(options).not.toContain('');
		expect(options[0]).toBe('none');
	});

	it('emits the chosen symbol for the right point', () => {
		const { target, onsetpointmarker } = mountSection(chartElement(WITH_OVERRIDE));

		setValue(target.querySelector<HTMLSelectElement>('.overrides select')!, 'diamond');

		expect(onsetpointmarker).toHaveBeenCalledWith(0, 1, { symbol: 'diamond' });
	});

	it('emits the marker size and fill, and pushes the fill into the recent-colours list', () => {
		const { target, editor, onsetpointmarker } = mountSection(chartElement(WITH_OVERRIDE));

		setValue(target.querySelector<HTMLInputElement>('.overrides input[type="number"]')!, '9');
		expect(onsetpointmarker).toHaveBeenCalledWith(0, 1, { size: 9 });

		setValue(target.querySelector<HTMLInputElement>('.overrides input[type="color"]')!, '#ff0000');
		expect(onsetpointmarker).toHaveBeenCalledWith(0, 1, { fillColor: '#ff0000' });
		// The shared MRU list normalises hex to upper-case (`normalizeRecentColor`).
		expect(editor.mruColors).toContain('#FF0000');
	});

	it('disables every control in read-only mode', () => {
		const { target } = mountSection(chartElement(WITH_OVERRIDE), false);
		const controls = target.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select');

		expect(controls.length).toBeGreaterThan(0);
		expect(Array.from(controls).every((control) => control.disabled)).toBeTruthy();
	});
});
