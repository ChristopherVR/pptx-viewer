import type { PptxChartData } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChartDataGrid from './ChartDataGrid.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function chartData(): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'Revenue', values: [10, 20] },
			{ name: 'Cost', values: [5, 6] },
		],
	};
}

function mountGrid(
	canEdit = true,
	data: PptxChartData = chartData(),
): {
	target: HTMLElement;
	onreplace: ReturnType<typeof vi.fn>;
	onrenameseries: ReturnType<typeof vi.fn>;
} {
	const onreplace = vi.fn();
	const onrenameseries = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartDataGrid, {
		target,
		props: { data, canEdit, onreplace, onrenameseries },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onreplace, onrenameseries };
}

function byLabel(target: HTMLElement, label: string): HTMLInputElement {
	return target.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
}

function setValue(control: HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('chartDataGrid', () => {
	it('renders a value cell per category x series with React-compatible labels', () => {
		const { target } = mountGrid();

		expect(target.querySelectorAll('tbody tr')).toHaveLength(2);
		expect(byLabel(target, 'Revenue value 1')).not.toBeNull();
		expect(byLabel(target, 'Cost value 2')).not.toBeNull();
	});

	it('writes a single cell without disturbing the rest of the row', () => {
		const { target, onreplace } = mountGrid();

		setValue(byLabel(target, 'Revenue value 2'), '42');

		const next = onreplace.mock.calls[0][0] as PptxChartData;
		expect(next.series[0].values).toStrictEqual([10, 42]);
		expect(next.series[1].values).toStrictEqual([5, 6]);
	});

	it('ignores a cleared cell rather than writing zero', () => {
		const { target, onreplace } = mountGrid();

		setValue(byLabel(target, 'Revenue value 1'), '');

		expect(onreplace).not.toHaveBeenCalled();
	});

	it('adds a category and a series through the header buttons', () => {
		const { target, onreplace } = mountGrid();

		target.querySelector<HTMLButtonElement>('[aria-label="Add category"]')?.click();
		flushSync();
		expect((onreplace.mock.calls[0][0] as PptxChartData).categories).toStrictEqual([
			'Q1',
			'Q2',
			'Cat 3',
		]);

		target.querySelector<HTMLButtonElement>('[aria-label="Add series"]')?.click();
		flushSync();
		expect((onreplace.mock.calls[1][0] as PptxChartData).series).toHaveLength(3);
	});

	it('renames a series through the dedicated callback (keeps series styling)', () => {
		const { target, onrenameseries } = mountGrid();

		setValue(byLabel(target, 'Series 1'), 'Net revenue');

		expect(onrenameseries).toHaveBeenCalledWith(0, 'Net revenue');
	});

	it('hides the remove button when only one series or category is left', () => {
		const single: PptxChartData = {
			chartType: 'bar',
			categories: ['Only'],
			series: [{ name: 'Solo', values: [1] }],
		};
		const { target } = mountGrid(true, single);

		expect(target.querySelector('.pptx-svelte-chart-grid-remove')).toBeNull();
	});

	it('hides add/remove and disables every input in a read-only viewer', () => {
		const { target } = mountGrid(false);

		expect(target.querySelector('.pptx-svelte-chart-grid-actions')).toBeNull();
		expect(target.querySelector('.pptx-svelte-chart-grid-remove')).toBeNull();
		expect(
			Array.from(target.querySelectorAll<HTMLInputElement>('input')).every(
				(input) => input.disabled,
			),
		).toBeTruthy();
	});
});
