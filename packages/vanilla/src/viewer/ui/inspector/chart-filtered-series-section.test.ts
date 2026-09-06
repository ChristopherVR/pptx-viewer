import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createChartFilteredSeriesSection } from './chart-filtered-series-section';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [
			{ name: 'Sales', values: [1, 2] },
			{ name: 'Costs', values: [3, 4] },
		],
		...overrides,
	};
}

/** Identity translator, but stringify params so interpolation is observable. */
function translate(key: string, params?: Record<string, string | number>): string {
	return params ? `${key}:${Object.values(params).join(',')}` : key;
}

function mount(data: PptxChartData) {
	const onChange = vi.fn();
	const section = createChartFilteredSeriesSection(document, translate, onChange);
	section.update(data);
	return { onChange, section };
}

function query<T extends Element>(root: Element, testid: string): T {
	return root.querySelector<T>(`[data-testid="${testid}"]`)!;
}

describe('chart filtered series section', () => {
	it('hides itself and builds nothing for a single visible series with no extensions', () => {
		const { section } = mount(chart({ series: [{ name: 'Sales', values: [1, 2] }] }));
		expect(section.el.hidden).toBeTruthy();
		expect(section.el.querySelectorAll('button, input')).toHaveLength(0);
	});

	it('shows one hide button per visible series when there is more than one', () => {
		const { section } = mount(chart());
		expect(section.el.hidden).toBeFalsy();
		expect(query(section.el, 'chart-series-hide-0')).toBeTruthy();
		expect(query(section.el, 'chart-series-hide-1')).toBeTruthy();
		expect(section.el.querySelector('[data-testid="chart-series-hide-2"]')).toBeNull();
		expect(query(section.el, 'chart-series-hide-1').getAttribute('aria-label')).toBe(
			'pptx.chart.hideSeries:Costs',
		);
	});

	it('hides the clicked series: it moves out of series into filteredSeries', () => {
		const { section, onChange } = mount(chart());
		query<HTMLButtonElement>(section.el, 'chart-series-hide-1').click();
		expect(onChange).toHaveBeenCalledOnce();
		const next = onChange.mock.calls[0][0] as PptxChartData;
		expect(next.series.map((s) => s.name)).toStrictEqual(['Sales']);
		expect(next.filteredSeries).toHaveLength(1);
		expect(next.filteredSeries![0]).toMatchObject({ name: 'Costs', values: [3, 4] });
	});

	it('does not offer hide buttons when only one series is visible', () => {
		const { section } = mount(
			chart({
				series: [{ name: 'Sales', values: [1, 2] }],
				filteredSeries: [{ idx: 1, order: 1, name: 'Costs', values: [3, 4] }],
			}),
		);
		expect(section.el.hidden).toBeFalsy();
		expect(section.el.querySelector('[data-testid="chart-series-hide-0"]')).toBeNull();
		expect(query(section.el, 'chart-series-show-0')).toBeTruthy();
	});

	it('shows a filtered series row and restores it on click', () => {
		const { section, onChange } = mount(
			chart({
				filteredSeries: [{ idx: 2, order: 2, name: 'Profit', values: [5, 6] }],
			}),
		);
		const show = query<HTMLButtonElement>(section.el, 'chart-series-show-0');
		expect(show.getAttribute('aria-label')).toBe('pptx.chart.showSeries:Profit');
		expect(section.el.textContent).toContain('Profit');
		show.click();
		expect(onChange).toHaveBeenCalledOnce();
		const next = onChange.mock.calls[0][0] as PptxChartData;
		expect(next.series.map((s) => s.name)).toStrictEqual(['Sales', 'Costs', 'Profit']);
		expect(next.filteredSeries).toBeUndefined();
	});

	it('falls back to filteredSeriesTitle when the filtered entry has no cached name', () => {
		const { section } = mount(
			chart({
				filteredSeries: [{ idx: 2, order: 2 }],
				filteredSeriesTitle: 'Series 3',
			}),
		);
		expect(query(section.el, 'chart-series-show-0').getAttribute('aria-label')).toBe(
			'pptx.chart.showSeries:Series 3',
		);
		expect(section.el.querySelector('.pptxv-chart-filters-name')!.textContent).toBe('Sales');
		expect(section.el.querySelector('.is-filtered .pptxv-chart-filters-name')!.textContent).toBe(
			'Series 3',
		);
	});

	it('falls back to the generic series label when neither name nor title exists', () => {
		const { section } = mount(chart({ filteredSeries: [{ idx: 2, order: 2 }] }));
		expect(query(section.el, 'chart-series-show-0').getAttribute('aria-label')).toBe(
			'pptx.chart.showSeries:pptx.chart.seriesShort',
		);
	});

	it('builds one input per cached Value From Cells label, labelled by category', () => {
		const { section } = mount(
			chart({
				series: [
					{
						name: 'Sales',
						values: [1, 2],
						dataLabelOptions: {
							dataLabelsRange: { formula: 'Sheet1!$C$2:$C$3', cache: ['High', 'Low'] },
						},
					},
				],
			}),
		);
		expect(section.el.hidden).toBeFalsy();
		expect(section.el.textContent).toContain('pptx.chart.valueFromCells:Sales');
		const first = query<HTMLInputElement>(section.el, 'chart-dlbl-range-0-0');
		const second = query<HTMLInputElement>(section.el, 'chart-dlbl-range-0-1');
		expect(first.value).toBe('High');
		expect(second.value).toBe('Low');
		expect(first.getAttribute('aria-label')).toBe('A');
		expect(second.getAttribute('aria-label')).toBe('B');
		expect(section.el.querySelector('[data-testid="chart-dlbl-range-0-2"]')).toBeNull();
		// A series without a range contributes no inputs.
		expect(section.el.querySelectorAll('input')).toHaveLength(2);
	});

	it('commits an edited cache label through the shared action for the right series', () => {
		const { section, onChange } = mount(
			chart({
				series: [
					{ name: 'Sales', values: [1, 2] },
					{
						name: 'Costs',
						values: [3, 4],
						dataLabelOptions: {
							dataLabelsRange: { formula: 'Sheet1!$C$2:$C$3', cache: ['High', 'Low'] },
						},
					},
				],
			}),
		);
		const input = query<HTMLInputElement>(section.el, 'chart-dlbl-range-1-1');
		input.value = 'Medium';
		input.dispatchEvent(new Event('change'));
		expect(onChange).toHaveBeenCalledOnce();
		const next = onChange.mock.calls[0][0] as PptxChartData;
		expect(next.series[0]).toStrictEqual({ name: 'Sales', values: [1, 2] });
		expect(next.series[1]!.dataLabelOptions!.dataLabelsRange).toStrictEqual({
			formula: 'Sheet1!$C$2:$C$3',
			cache: ['High', 'Medium'],
		});
	});

	it('disables every control when not editable and re-enables them after', () => {
		const { section, onChange } = mount(
			chart({
				filteredSeries: [{ idx: 2, order: 2, name: 'Profit' }],
				series: [
					{
						name: 'Sales',
						values: [1, 2],
						dataLabelOptions: { dataLabelsRange: { formula: 'X', cache: ['a'] } },
					},
					{ name: 'Costs', values: [3, 4] },
				],
			}),
		);
		const controls = () =>
			Array.from(
				section.el.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input'),
			);
		expect(controls()).toHaveLength(4);
		expect(controls().every((c) => !c.disabled)).toBeTruthy();

		section.setEditable(false);
		expect(controls().every((c) => c.disabled)).toBeTruthy();
		query<HTMLButtonElement>(section.el, 'chart-series-hide-0').click();
		expect(onChange).not.toHaveBeenCalled();

		// Rows rebuilt while read-only stay disabled.
		section.update(chart());
		expect(controls().every((c) => c.disabled)).toBeTruthy();

		section.setEditable(true);
		expect(controls().every((c) => !c.disabled)).toBeTruthy();
	});
});
