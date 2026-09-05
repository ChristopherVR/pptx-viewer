import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChartUserShapeSection from './ChartUserShapeSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1'],
		series: [{ name: 'Revenue', values: [10] }],
		...overrides,
	};
}

const textBoxShape: PptxChartUserShape = {
	kind: 'sp',
	anchor: 'rel',
	from: { x: 0.1, y: 0.1 },
	to: { x: 0.3, y: 0.2 },
	paragraphs: [{ text: 'Note' }],
};

function mountSection(
	data: PptxChartData,
	canEdit = true,
): { target: HTMLElement; onpatch: ReturnType<typeof vi.fn> } {
	const onpatch = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartUserShapeSection, {
		target,
		props: { data, canEdit, onpatch },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onpatch };
}

describe('chartUserShapeSection', () => {
	it('shows the empty state with no overlay shapes', () => {
		const { target } = mountSection(chartData());
		expect(target.textContent).toContain('No overlay shapes on this chart.');
	});

	it('renders one row per overlay shape', () => {
		const { target } = mountSection(chartData({ userShapes: [textBoxShape] }));
		expect(target.textContent).toContain('Note');
	});

	it('calls onpatch with an appended shape when the add button is clicked', () => {
		const { target, onpatch } = mountSection(chartData());
		const addButton = Array.from(target.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('Add text box'),
		)!;
		addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(onpatch).toHaveBeenCalledOnce();
		const patch = onpatch.mock.calls[0][0] as Partial<PptxChartData>;
		expect(patch.userShapes).toHaveLength(1);
		expect(patch.userShapes![0].kind).toBe('sp');
	});

	it('calls onpatch with the shape removed when delete is clicked', () => {
		const { target, onpatch } = mountSection(chartData({ userShapes: [textBoxShape] }));
		const deleteButton = target.querySelector('button[aria-label="Delete overlay shape"]')!;
		deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(onpatch).toHaveBeenCalledWith({ userShapes: [] });
	});

	it('disables add/delete controls in read-only mode', () => {
		const { target } = mountSection(chartData({ userShapes: [textBoxShape] }), false);
		const buttons = target.querySelectorAll<HTMLButtonElement>('button');
		expect(Array.from(buttons).every((b) => b.disabled)).toBeTruthy();
	});
});
