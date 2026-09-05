/**
 * ChartUserShapeOptionsComponent, Angular binding (C2-G10 edit/serialize
 * follow-up).
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals, mirroring
 * `chart-display-options.component.test.ts`.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import type { ChartPptxElement, PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ChartUserShapeOptionsComponent } from './chart-user-shape-options.component';

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

function createOptions(chartData: PptxChartData): ChartUserShapeOptionsComponent {
	const options = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new ChartUserShapeOptionsComponent(),
	);
	Object.assign(options, {
		element: signal(chartElement(chartData)) as unknown as InputSignal<ChartPptxElement>,
		canEdit: signal(true) as unknown as InputSignal<boolean>,
	});
	return options;
}

const textBoxShape: PptxChartUserShape = {
	kind: 'sp',
	anchor: 'rel',
	from: { x: 0.1, y: 0.1 },
	to: { x: 0.3, y: 0.2 },
	paragraphs: [{ text: 'Note' }],
};

describe('chartUserShapeOptionsComponent', () => {
	it('lists no descriptors for a chart with no overlay shapes', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			categories: [],
		} as PptxChartData);
		expect(options['descriptors']()).toStrictEqual([]);
	});

	it('lists one descriptor per overlay shape', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			categories: [],
			userShapes: [textBoxShape],
		} as unknown as PptxChartData);
		const descriptors = options['descriptors']();
		expect(descriptors).toHaveLength(1);
		expect(descriptors[0].text).toBe('Note');
		expect(descriptors[0].editable).toBeTruthy();
	});

	it('emits an appended shape when adding a text box', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			categories: [],
		} as PptxChartData);
		let emitted: ChartPptxElement | undefined;
		vi.spyOn(
			options.elementChange as OutputEmitterRef<ChartPptxElement>,
			'emit',
		).mockImplementation((value) => {
			emitted = value;
		});
		options['onAddTextBox']();
		expect(emitted?.chartData?.userShapes).toHaveLength(1);
		expect(emitted?.chartData?.userShapes?.[0].kind).toBe('sp');
	});

	it('emits the shape removed when deleting by index', () => {
		const options = createOptions({
			chartType: 'bar',
			series: [],
			categories: [],
			userShapes: [textBoxShape],
		} as unknown as PptxChartData);
		let emitted: ChartPptxElement | undefined;
		vi.spyOn(
			options.elementChange as OutputEmitterRef<ChartPptxElement>,
			'emit',
		).mockImplementation((value) => {
			emitted = value;
		});
		options['onRemove'](0);
		expect(emitted?.chartData?.userShapes).toStrictEqual([]);
	});
});
