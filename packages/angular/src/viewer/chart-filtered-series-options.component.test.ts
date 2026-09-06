/**
 * ChartFilteredSeriesOptionsComponent, Angular binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals, mirroring
 * `chart-display-options.component.test.ts` and
 * `chart-user-shape-options.component.test.ts`. `TranslateService` is stubbed
 * with a minimal `instant` so the generic "Series" fallback label resolves
 * without a full i18n module.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ChartFilteredSeriesOptionsComponent } from './chart-filtered-series-options.component';

function chartElement(chartData: PptxChartData): ChartPptxElement {
	return {
		type: 'chart',
		id: 'chart-1',
		name: 'Chart 1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

function createOptions(
	chartData: PptxChartData,
	canEdit = true,
): ChartFilteredSeriesOptionsComponent {
	const options = runInInjectionContext(
		Injector.create({
			providers: [
				{
					provide: TranslateService,
					useValue: {
						instant: (key: string) => (key === 'pptx.chart.seriesShort' ? 'Series' : key),
					},
				},
			],
		}),
		() => new ChartFilteredSeriesOptionsComponent(),
	);
	Object.assign(options, {
		element: signal(chartElement(chartData)) as unknown as InputSignal<ChartPptxElement>,
		canEdit: signal(canEdit) as unknown as InputSignal<boolean>,
	});
	return options;
}

function spyEmit(options: ChartFilteredSeriesOptionsComponent): () => ChartPptxElement | undefined {
	let emitted: ChartPptxElement | undefined;
	vi.spyOn(options.elementChange as OutputEmitterRef<ChartPptxElement>, 'emit').mockImplementation(
		(value) => {
			emitted = value;
		},
	);
	return () => emitted;
}

function textChange(value: string): Event {
	const input = document.createElement('input');
	input.type = 'text';
	input.value = value;
	return { target: input } as unknown as Event;
}

describe('chartFilteredSeriesOptionsComponent', () => {
	it('renders nothing when there is one series, no filtered series, and no data-labels range', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [{ name: 'Revenue', values: [1, 2, 3] }],
			categories: ['Q1', 'Q2', 'Q3'],
		} as unknown as PptxChartData);
		expect(options['showSection']()).toBeFalsy();
	});

	it('shows a hide row per visible series, keyed by position, only when there is more than one', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [
				{ name: 'Revenue', values: [1, 2] },
				{ name: 'Cost', values: [3, 4] },
			],
			categories: ['Q1', 'Q2'],
		} as unknown as PptxChartData);
		expect(options['showSection']()).toBeTruthy();
		expect(options['series']()).toHaveLength(2);
	});

	it('hide emits the series moved out of chartData.series into filteredSeries', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [
				{ name: 'Revenue', values: [1, 2] },
				{ name: 'Cost', values: [3, 4] },
			],
			categories: ['Q1', 'Q2'],
		} as unknown as PptxChartData);
		const emitted = spyEmit(options);
		options['onHideSeries'](1);
		const next = emitted()?.chartData;
		expect(next?.series).toHaveLength(1);
		expect(next?.series[0]!.name).toBe('Revenue');
		expect(next?.filteredSeries).toHaveLength(1);
		expect(next?.filteredSeries?.[0]).toMatchObject({ name: 'Cost' });
	});

	it('shows a filtered-series row and its show button emits the series restored, indexed by filtered position', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [{ name: 'Revenue', values: [1, 2] }],
			categories: ['Q1', 'Q2'],
			filteredSeries: [{ idx: 1, order: 1, name: 'Cost', values: [3, 4] }],
		} as unknown as PptxChartData);
		expect(options['showSection']()).toBeTruthy();
		expect(options['filteredSeries']()).toHaveLength(1);
		expect(options['filteredName'](options['filteredSeries']()[0]!)).toBe('Cost');

		const emitted = spyEmit(options);
		options['onRestoreSeries'](0);
		const next = emitted()?.chartData;
		expect(next?.series).toHaveLength(2);
		expect(next?.series[1]).toMatchObject({ name: 'Cost' });
		expect(next?.filteredSeries).toBeUndefined();
	});

	it('falls back to chartData.filteredSeriesTitle when the filtered entry has no cached name', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [{ name: 'Revenue', values: [1, 2] }],
			categories: ['Q1', 'Q2'],
			filteredSeries: [{ idx: 1, order: 1, values: [3, 4] }],
			filteredSeriesTitle: 'Hidden series title',
		} as unknown as PptxChartData);
		expect(options['filteredName'](options['filteredSeries']()[0]!)).toBe('Hidden series title');
	});

	it('falls back to a generic "Series" label when neither the entry nor the chart has a title', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [{ name: 'Revenue', values: [1, 2] }],
			categories: ['Q1', 'Q2'],
			filteredSeries: [{ idx: 1, order: 1, values: [3, 4] }],
		} as unknown as PptxChartData);
		expect(options['filteredName'](options['filteredSeries']()[0]!)).toBe('Series');
	});

	it('renders one input per cached label and emits an edited cache on change', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [
				{
					name: 'Revenue',
					values: [1, 2],
					dataLabelOptions: {
						dataLabelsRange: { formula: 'Sheet1!A1:A2', cache: ['Low', 'High'] },
					},
				},
			],
			categories: ['Q1', 'Q2'],
		} as unknown as PptxChartData);
		const rows = options['seriesWithRange']();
		expect(rows).toHaveLength(1);
		expect(rows[0]!.series.dataLabelOptions!.dataLabelsRange!.cache).toStrictEqual(['Low', 'High']);
		expect(options['categoryLabel'](0)).toBe('Q1');
		expect(options['categoryLabel'](5)).toBe('5');

		const emitted = spyEmit(options);
		options['onSetDataLabelsRangeCache'](0, 1, textChange('Very high'));
		const range = emitted()?.chartData?.series[0]?.dataLabelOptions?.dataLabelsRange;
		expect(range?.cache).toStrictEqual(['Low', 'Very high']);
	});

	it('exposes canEdit() for the template to disable every control when editing is off', () => {
		const options = createOptions(
			{
				chartType: 'bar',
				series: [
					{ name: 'Revenue', values: [1, 2] },
					{ name: 'Cost', values: [3, 4] },
				],
				categories: ['Q1', 'Q2'],
			} as unknown as PptxChartData,
			false,
		);
		expect(options.canEdit()).toBeFalsy();
	});
});
