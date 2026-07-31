import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createChartAdvancedSection } from './chart-advanced-section';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [{ name: 'Sales', values: [1, 2] }],
		axes: [{ axisType: 'valAx', axisId: 1, axPos: 'l', titleText: 'Value' }],
		...overrides,
	};
}

function mountSection(data: PptxChartData) {
	const onChange = vi.fn();
	const section = createChartAdvancedSection(document, (key) => key, onChange);
	section.update(data);
	const labels = Array.from(section.el.querySelectorAll('label'));
	const control = <T extends HTMLInputElement | HTMLSelectElement>(key: string): T =>
		labels.find((label) => label.textContent?.startsWith(key))!.querySelector('input,select') as T;
	return { onChange, control };
}

describe('chart advanced section', () => {
	it('offers the shared display-unit catalogue on the axis scale group', () => {
		const { control } = mountSection(chart());
		const units = control<HTMLSelectElement>('pptx.chart.displayUnits');

		expect(Array.from(units.options).map((option) => option.value)).toStrictEqual([
			'',
			'hundreds',
			'thousands',
			'tenThousands',
			'hundredThousands',
			'millions',
			'tenMillions',
			'hundredMillions',
			'billions',
			'trillions',
		]);
	});

	it('writes the chosen display units onto the selected axis', () => {
		const { control, onChange } = mountSection(chart());
		const units = control<HTMLSelectElement>('pptx.chart.displayUnits');

		units.value = 'millions';
		units.dispatchEvent(new Event('change'));

		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				axes: [expect.objectContaining({ displayUnits: 'millions' })],
			}),
		);
	});

	it('reflects the display units already on the axis', () => {
		const { control } = mountSection(
			chart({ axes: [{ axisType: 'valAx', axisId: 1, axPos: 'l', displayUnits: 'thousands' }] }),
		);

		expect(control<HTMLSelectElement>('pptx.chart.displayUnits').value).toBe('thousands');
	});

	it('clears c:dispUnits rather than writing an empty token', () => {
		const { control, onChange } = mountSection(
			chart({ axes: [{ axisType: 'valAx', axisId: 1, axPos: 'l', displayUnits: 'billions' }] }),
		);
		const units = control<HTMLSelectElement>('pptx.chart.displayUnits');

		units.value = '';
		units.dispatchEvent(new Event('change'));

		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				axes: [expect.objectContaining({ displayUnits: undefined })],
			}),
		);
	});

	it('still commits the neighbouring scale controls after the insert', () => {
		const { control, onChange } = mountSection(chart());
		const max = control<HTMLInputElement>('pptx.chart.axisMaximum');

		max.value = '500';
		max.dispatchEvent(new Event('change'));

		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ axes: [expect.objectContaining({ max: 500 })] }),
		);
	});
});
