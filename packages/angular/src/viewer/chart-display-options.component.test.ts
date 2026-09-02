/**
 * ChartDisplayOptionsComponent's gridlines toggle, Angular binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals. Pins the fix for a real bug: the
 * checkbox used to read/write `chartData.style.hasGridlines`, a field the
 * cartesian renderer never reads (it draws from the value axis's
 * `majorGridlines`), so toggling "Show Gridlines" silently did nothing. It
 * now goes through shared's `chartGridlinesState`/`chartGridlinesPatch`.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ChartDisplayOptionsComponent } from './chart-display-options.component';

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

function createOptions(chartData: PptxChartData): ChartDisplayOptionsComponent {
	const options = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new ChartDisplayOptionsComponent(),
	);
	Object.assign(options, {
		element: signal(chartElement(chartData)) as unknown as InputSignal<ChartPptxElement>,
		canEdit: signal(true) as unknown as InputSignal<boolean>,
	});
	return options;
}

function checkboxChange(checked: boolean): Event {
	const input = document.createElement('input');
	input.type = 'checkbox';
	input.checked = checked;
	return { target: input } as unknown as Event;
}

describe('chartDisplayOptionsComponent gridlines', () => {
	it('reads the primary value axis majorGridlines, not the unread style flag', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			axes: [{ axisType: 'valAx', axPos: 'l', majorGridlines: true }],
			style: { hasGridlines: false },
		} as unknown as PptxChartData);
		expect(options['gridlinesShown']()).toBeTruthy();
	});

	it('falls back to style.hasGridlines when there is no parsed value axis', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			style: { hasGridlines: false },
		} as unknown as PptxChartData);
		expect(options['gridlinesShown']()).toBeFalsy();
	});

	it('writes the toggle onto the value axis, not just the unread style flag', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			axes: [{ axisType: 'valAx', axPos: 'l', majorGridlines: true }],
			style: { hasGridlines: true },
		} as unknown as PptxChartData);
		let emitted: ChartPptxElement | undefined;
		vi.spyOn(
			options.elementChange as OutputEmitterRef<ChartPptxElement>,
			'emit',
		).mockImplementation((value) => {
			emitted = value;
		});
		options['onToggleGridlines'](checkboxChange(false));
		expect(emitted?.chartData?.axes?.[0]).toMatchObject({ majorGridlines: false });
		expect(emitted?.chartData?.style?.hasGridlines).toBeFalsy();
	});
});
