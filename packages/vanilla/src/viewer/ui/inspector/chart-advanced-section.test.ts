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

	it('writes the point fill onto the override carrying the picked c:idx', () => {
		const { control, onChange } = mountSection(
			chart({
				series: [
					{
						name: 'Sales',
						values: [1, 2, 3],
						// Sparse and unordered: writing by array position would hit idx 5.
						dataPoints: [{ idx: 5, explosion: 20 }, { idx: 1 }],
					},
				],
			}),
		);

		const picker = control<HTMLInputElement>('pptx.chart.dataPointIndex');
		picker.value = '2';
		picker.dispatchEvent(new Event('change'));
		const fill = control<HTMLInputElement>('pptx.chart.dataPointColor');
		fill.value = '#123456';
		fill.dispatchEvent(new Event('change'));

		const [{ series }] = onChange.mock.lastCall as [PptxChartData];
		expect(series[0].dataPoints).toStrictEqual([
			{ idx: 5, explosion: 20 },
			{ idx: 1, spPr: { fillColor: '#123456' }, explosion: undefined },
		]);
	});

	it('re-reads the picked point instead of stamping the previous colour on it', () => {
		const { control, onChange } = mountSection(
			chart({
				series: [
					{
						name: 'Sales',
						values: [1, 2],
						dataPoints: [{ idx: 1, spPr: { fillColor: '#abcdef' }, explosion: 15 }],
					},
				],
			}),
		);

		const picker = control<HTMLInputElement>('pptx.chart.dataPointIndex');
		picker.value = '2';
		picker.dispatchEvent(new Event('change'));

		expect(onChange).not.toHaveBeenCalled();
		expect(control<HTMLInputElement>('pptx.chart.dataPointColor').value).toBe('#abcdef');
		expect(control<HTMLInputElement>('pptx.chart.pointExplosion').value).toBe('15');
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

/**
 * The identity translator means an option's text IS the i18n key it resolved,
 * so each assertion below proves the control is spelled from a shared
 * catalogue while its value list stays exactly as it was.
 */
describe('chart advanced section option wording', () => {
	it('drives the trendline picker from the shared catalogue', () => {
		const { control } = mountSection(chart());
		const trendline = control<HTMLSelectElement>('pptx.chart.trendlines');

		expect(Array.from(trendline.options).map((option) => option.value)).toStrictEqual([
			'',
			'linear',
			'exponential',
			'logarithmic',
			'polynomial',
			'power',
			'movingAvg',
		]);
		expect(Array.from(trendline.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.chart.trendlineNone',
			'pptx.chart.trendlineLinear',
			'pptx.chart.trendlineExponential',
			'pptx.chart.trendlineLogarithmic',
			'pptx.chart.trendlinePolynomial',
			'pptx.chart.trendlinePower',
			'pptx.chart.trendlineMovingAvg',
		]);
	});

	it('drives the error-bar type picker from the shared catalogue', () => {
		const { control } = mountSection(chart());
		const errors = control<HTMLSelectElement>('pptx.chart.errorBars');

		expect(Array.from(errors.options).map((option) => option.value)).toStrictEqual([
			'',
			'fixedVal',
			'percentage',
			'stdDev',
			'stdErr',
		]);
		expect(Array.from(errors.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.chart.errorBarNone',
			'pptx.chart.errorBarFixed',
			'pptx.chart.errorBarPercentage',
			'pptx.chart.errorBarStdDev',
			'pptx.chart.errorBarStdErr',
		]);
	});

	it('keeps its own nine marker symbols and only spells them', () => {
		const { control } = mountSection(chart());
		const marker = control<HTMLSelectElement>('pptx.chart.marker');

		expect(Array.from(marker.options).map((option) => option.value)).toStrictEqual([
			'none',
			'auto',
			'circle',
			'diamond',
			'square',
			'star',
			'triangle',
			'x',
			'plus',
		]);
		expect(Array.from(marker.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.chart.markerNone',
			'pptx.chart.markerAuto',
			'pptx.chart.markerCircle',
			'pptx.chart.markerDiamond',
			'pptx.chart.markerSquare',
			'pptx.chart.markerStar',
			'pptx.chart.markerTriangle',
			'pptx.chart.markerX',
			'pptx.chart.markerPlus',
		]);
	});

	it('captions an untitled axis with its spelled element name', () => {
		const { control } = mountSection(chart({ axes: [{ axisType: 'catAx' }] }));
		const axis = control<HTMLSelectElement>('pptx.chart.axis');

		expect(axis.options[0].value).toBe('0');
		expect(axis.options[0].textContent).toBe('pptx.chart.categoryAxis');
	});

	it('still commits the marker token rather than its caption', () => {
		const { control, onChange } = mountSection(chart());
		const marker = control<HTMLSelectElement>('pptx.chart.marker');

		marker.value = 'triangle';
		marker.dispatchEvent(new Event('change'));

		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				series: [
					expect.objectContaining({ marker: expect.objectContaining({ symbol: 'triangle' }) }),
				],
			}),
		);
	});
});
