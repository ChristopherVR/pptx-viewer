import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createChartExhaustiveSection } from './chart-exhaustive-section';
import { createChartPointIndexField } from './chart-point-index';

function chart(): PptxChartData {
	return {
		chartType: 'combo',
		categories: ['A', 'B', 'C', 'D'],
		series: [
			{
				name: 'Sales',
				values: [1, 2, 3, 4],
				seriesChartType: 'bar',
				trendlines: [{ trendlineType: 'polynomial', order: 2 }],
				errBars: [{ direction: 'y', barType: 'both', valType: 'cust' }],
				// Sparse and out of order on purpose: `c:dPt` is keyed by `c:idx`,
				// so an editor writing by array position targets the wrong point.
				dataPoints: [
					{ idx: 3, marker: { symbol: 'diamond' } },
					{ idx: 0, marker: { symbol: 'circle', spPr: { fillColor: '#ff0000' } } },
				],
			},
		],
		axes: [{ axisType: 'valAx', axisId: 1, axPos: 'l', titleText: 'Value' }],
	};
}

/** Mount a section and expose its controls by their translation key. */
function mount(pointIndex?: ReturnType<typeof createChartPointIndexField>) {
	const onChange = vi.fn();
	const section = createChartExhaustiveSection(document, (key) => key, onChange, pointIndex);
	section.update(chart());
	const control = <T extends HTMLInputElement | HTMLSelectElement>(key: string): T =>
		Array.from(section.el.querySelectorAll('label'))
			.find((label) => label.textContent?.startsWith(key))!
			.querySelector('input,select') as T;
	return { section, onChange, control };
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

	it('lands the per-point marker on the picked point, not on the first override', () => {
		const { control, onChange } = mount();

		const picker = control<HTMLInputElement>('pptx.chart.dataPointIndex');
		picker.value = '3';
		picker.dispatchEvent(new Event('change'));
		const symbol = control<HTMLSelectElement>('pptx.chart.dataPointMarker');
		symbol.value = 'star';
		symbol.dispatchEvent(new Event('change'));

		const [{ series }] = onChange.mock.lastCall as [PptxChartData];
		expect(series[0].dataPoints).toStrictEqual([
			{ idx: 3, marker: { symbol: 'diamond' } },
			{ idx: 0, marker: { symbol: 'circle', spPr: { fillColor: '#ff0000' } } },
			{ idx: 2, invertIfNegative: false, marker: { symbol: 'star', size: undefined } },
		]);
	});

	it('replaces the override carrying the picked c:idx and keeps its marker fill', () => {
		const { control, onChange } = mount();

		const picker = control<HTMLInputElement>('pptx.chart.dataPointIndex');
		picker.value = '4';
		picker.dispatchEvent(new Event('change'));
		const symbol = control<HTMLSelectElement>('pptx.chart.dataPointMarker');
		symbol.value = 'square';
		symbol.dispatchEvent(new Event('change'));

		const [{ series }] = onChange.mock.lastCall as [PptxChartData];
		expect(series[0].dataPoints).toHaveLength(2);
		expect(series[0].dataPoints?.[0]).toStrictEqual({
			idx: 3,
			invertIfNegative: false,
			marker: { symbol: 'square', size: undefined },
		});
	});

	it('reads the picked point back rather than committing the previous one', () => {
		const { control, onChange } = mount();
		const picker = control<HTMLInputElement>('pptx.chart.dataPointIndex');

		picker.value = '4';
		picker.dispatchEvent(new Event('change'));

		expect(onChange).not.toHaveBeenCalled();
		expect(control<HTMLSelectElement>('pptx.chart.dataPointMarker').value).toBe('diamond');
	});

	it('obeys a point picker owned by the surrounding panel', () => {
		const shared = createChartPointIndexField(document, (key) => key);
		const { section, control, onChange } = mount(shared);

		// The panel renders the shared field itself, so the section must not.
		expect(section.el.contains(shared.label)).toBeFalsy();

		shared.control.value = '3';
		shared.control.dispatchEvent(new Event('change'));
		const symbol = control<HTMLSelectElement>('pptx.chart.dataPointMarker');
		symbol.value = 'plus';
		symbol.dispatchEvent(new Event('change'));

		const [{ series }] = onChange.mock.lastCall as [PptxChartData];
		expect(series[0].dataPoints?.find(({ idx }) => idx === 2)?.marker?.symbol).toBe('plus');
	});
});

/**
 * The identity translator means an option's text IS the i18n key it resolved,
 * so these assertions prove each select is spelled from a shared catalogue
 * while its value list stays exactly as it was.
 */
describe('chart exhaustive section option wording', () => {
	it('keeps its six series types and only spells them', () => {
		const { control } = mount();
		const combo = control<HTMLSelectElement>('pptx.chart.seriesType');

		expect(Array.from(combo.options).map((option) => option.value)).toStrictEqual([
			'bar',
			'line',
			'area',
			'scatter',
			'bubble',
			'radar',
		]);
		expect(Array.from(combo.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.chart.typeBar',
			'pptx.chart.typeLine',
			'pptx.chart.typeArea',
			'pptx.chart.typeScatter',
			'pptx.chart.typeBubble',
			'pptx.chart.typeRadar',
		]);
	});

	it('keeps all nine data-label positions and spells the four bare ones', () => {
		const { control } = mount();
		const position = control<HTMLSelectElement>('pptx.chart.dataLabelPosition');

		expect(Array.from(position.options).map((option) => option.value)).toStrictEqual([
			'bestFit',
			'b',
			'ctr',
			'inBase',
			'inEnd',
			'l',
			'outEnd',
			'r',
			't',
		]);
		expect(Array.from(position.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.chart.labelPosBestFit',
			'pptx.chart.labelPosBelow',
			'pptx.chart.labelPosCenter',
			'pptx.chart.labelPosInsideBase',
			'pptx.chart.labelPosInsideEnd',
			'pptx.chart.labelPosLeft',
			'pptx.chart.labelPosOutsideEnd',
			'pptx.chart.labelPosRight',
			'pptx.chart.labelPosAbove',
		]);
	});

	it('spells the error-bar direction and type pickers', () => {
		const { control } = mount();
		const direction = control<HTMLSelectElement>('pptx.chart.errorBarDirection');
		const barType = control<HTMLSelectElement>('pptx.chart.errorBarType');

		expect(Array.from(direction.options).map((option) => option.value)).toStrictEqual(['x', 'y']);
		expect(Array.from(direction.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.chart.errorBarDirectionX',
			'pptx.chart.errorBarDirectionY',
		]);
		expect(
			Array.from(barType.options)
				.map((option) => option.value)
				.sort(),
		).toStrictEqual(['both', 'minus', 'plus']);
		expect(Array.from(barType.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.chart.errorBarBoth',
			'pptx.chart.errorBarPlus',
			'pptx.chart.errorBarMinus',
		]);
	});

	it('captions an untitled axis with its spelled element name', () => {
		const section = createChartExhaustiveSection(document, (key) => key, vi.fn());
		section.update({
			chartType: 'bar',
			categories: ['A'],
			series: [{ name: 'Sales', values: [1] }],
			axes: [{ axisType: 'dateAx' }],
		});
		const axis = Array.from(section.el.querySelectorAll('label'))
			.find((label) => label.textContent?.startsWith('pptx.chart.axis'))!
			.querySelector('select')!;

		expect(axis.options[0].value).toBe('0');
		expect(axis.options[0].textContent).toBe('pptx.chart.dateAxis');
	});
});
