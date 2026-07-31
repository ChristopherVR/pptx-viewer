import type { PptxChartData } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChartAxisFormatSection from './ChartAxisFormatSection.svelte';

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
		axes: [
			{ axisType: 'catAx', axPos: 'b' },
			{ axisType: 'valAx', axPos: 'l' },
		],
		...overrides,
	};
}

function mountSection(
	data: PptxChartData,
	canEdit = true,
): { target: HTMLElement; onpatch: ReturnType<typeof vi.fn> } {
	const onpatch = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartAxisFormatSection, { target, props: { data, canEdit, onpatch } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onpatch };
}

function setValue(control: HTMLSelectElement | HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('chartAxisFormatSection', () => {
	it('renders nothing when the chart has no axes', () => {
		const { target } = mountSection(chartData({ axes: undefined }));

		expect(target.querySelector('.pptx-svelte-chart-axis-format')).toBeNull();
	});

	it('labels each axis from the shared catalogue', () => {
		const { target } = mountSection(chartData());
		const legends = Array.from(target.querySelectorAll('legend')).map((el) => el.textContent);

		expect(legends).toStrictEqual(['Category axis', 'Value axis']);
	});

	it('writes a number format code onto the right axis', () => {
		const { target, onpatch } = mountSection(chartData());
		const inputs = target.querySelectorAll<HTMLInputElement>('input[type="text"]');

		setValue(inputs[1], '#,##0.00');

		expect(onpatch).toHaveBeenCalledWith({
			axes: [
				{ axisType: 'catAx', axPos: 'b' },
				{ axisType: 'valAx', axPos: 'l', numFmt: { formatCode: '#,##0.00', sourceLinked: false } },
			],
		});
	});

	it('clears c:numFmt outright when the box is emptied, not saving a blank code', () => {
		const { target, onpatch } = mountSection(
			chartData({
				axes: [
					{ axisType: 'valAx', axPos: 'l', numFmt: { formatCode: '0%', sourceLinked: false } },
				],
			}),
		);

		setValue(target.querySelector<HTMLInputElement>('input[type="text"]')!, '');

		expect(onpatch).toHaveBeenCalledWith({
			axes: [{ axisType: 'valAx', axPos: 'l', numFmt: undefined }],
		});
	});

	it('offers display units on scaled axes only', () => {
		const { target } = mountSection(chartData());

		// catAx carries no numeric scale, so only the valAx row gets the select.
		expect(target.querySelectorAll('select')).toHaveLength(1);
	});

	it('offers the shared, translated display-unit list', () => {
		const { target } = mountSection(chartData());
		const options = Array.from(target.querySelectorAll<HTMLOptionElement>('select option')).map(
			(option) => option.textContent,
		);

		expect(options).toStrictEqual([
			'None',
			'Hundreds',
			'Thousands',
			'Ten Thousands',
			'Hundred Thousands',
			'Millions',
			'Ten Millions',
			'Hundred Millions',
			'Billions',
			'Trillions',
		]);
	});

	it('sets the display units on the value axis', () => {
		const { target, onpatch } = mountSection(chartData());

		setValue(target.querySelector<HTMLSelectElement>('select')!, 'millions');

		expect(onpatch).toHaveBeenCalledWith({
			axes: [
				{ axisType: 'catAx', axPos: 'b' },
				{ axisType: 'valAx', axPos: 'l', displayUnits: 'millions' },
			],
		});
	});

	it('clears the display units back to none', () => {
		const { target, onpatch } = mountSection(
			chartData({ axes: [{ axisType: 'valAx', axPos: 'l', displayUnits: 'thousands' }] }),
		);

		setValue(target.querySelector<HTMLSelectElement>('select')!, '');

		expect(onpatch).toHaveBeenCalledWith({
			axes: [{ axisType: 'valAx', axPos: 'l', displayUnits: undefined }],
		});
	});

	it('disables every control in read-only mode', () => {
		const { target } = mountSection(chartData(), false);
		const controls = target.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select');

		expect(controls.length).toBeGreaterThan(0);
		expect(Array.from(controls).every((control) => control.disabled)).toBeTruthy();
	});
});
