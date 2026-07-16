import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createChartExhaustiveSection } from './chart-exhaustive-section';

function chart(): PptxChartData {
	return {
		chartType: 'combo',
		categories: ['A', 'B'],
		series: [
			{
				name: 'Sales',
				values: [1, 2],
				seriesChartType: 'bar',
				trendlines: [{ trendlineType: 'polynomial', order: 2 }],
				errBars: [{ direction: 'y', barType: 'both', valType: 'cust' }],
			},
		],
		axes: [{ axisType: 'valAx', axisId: 1, axPos: 'l', titleText: 'Value' }],
	};
}

describe('chart exhaustive section', () => {
	it('authors combo, data-label, and detailed axis options', () => {
		const onChange = vi.fn();
		const section = createChartExhaustiveSection(document, (key) => key, onChange);
		section.update(chart());
		const labels = Array.from(section.el.querySelectorAll('label'));
		const control = <T extends HTMLInputElement | HTMLSelectElement>(key: string): T =>
			labels
				.find((label) => label.textContent?.startsWith(key))!
				.querySelector('input,select') as T;

		const combo = control<HTMLSelectElement>('pptx.chart.seriesType');
		combo.value = 'line';
		combo.dispatchEvent(new Event('change'));
		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				series: [expect.objectContaining({ seriesChartType: 'line' })],
			}),
		);

		const minor = control<HTMLInputElement>('pptx.chart.minorUnit');
		minor.value = '2.5';
		minor.dispatchEvent(new Event('change'));
		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				axes: [expect.objectContaining({ minorUnit: 2.5 })],
			}),
		);
	});
});
