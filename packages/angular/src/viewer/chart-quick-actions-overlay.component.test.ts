/**
 * ChartQuickActionsOverlayComponent, Angular binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly inside an injection context that provides fakes for
 * `EditorStateService`/`SLIDE_CONTEXT`/`ElementRef`, mirroring
 * `chart-filtered-series-options.component.test.ts`. Inputs are stubbed as
 * signals; assertions call the component's protected methods directly and
 * check what got committed through the (faked) editor, since there is no
 * TestBed to render the template through.
 */
import { ElementRef, Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import type { ChartPptxElement, PptxChartData, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ChartQuickActionsOverlayComponent } from './chart-quick-actions-overlay.component';
import { EditorStateService } from './editor-state.service';
import { SLIDE_CONTEXT } from './slide-context';

function chartElement(data: PptxChartData): ChartPptxElement {
	return {
		type: 'chart',
		id: 'chart-1',
		x: 10,
		y: 20,
		width: 400,
		height: 300,
		chartData: data,
	} as ChartPptxElement;
}

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'Revenue', values: [100, 150] },
			{ name: 'Cost', values: [80, 90] },
		],
		style: { hasTitle: true, hasLegend: false },
		...overrides,
	};
}

function createOverlay(
	element: ChartPptxElement,
	canEdit = true,
): { overlay: ChartQuickActionsOverlayComponent; updateElement: ReturnType<typeof vi.fn> } {
	const updateElement =
		vi.fn<(slideIndex: number, id: string, patch: Partial<PptxElement>) => void>();
	const slide: PptxSlide = { id: 's1', elements: [element] } as PptxSlide;
	const overlay = runInInjectionContext(
		Injector.create({
			providers: [
				{
					provide: EditorStateService,
					useValue: { slides: () => [slide], updateElement },
				},
				{ provide: SLIDE_CONTEXT, useValue: { slideId: () => 's1' } },
				{ provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
			],
		}),
		() => new ChartQuickActionsOverlayComponent(),
	);
	Object.assign(overlay, {
		element: signal(element) as unknown as InputSignal<ChartPptxElement>,
		canEdit: signal(canEdit) as unknown as InputSignal<boolean>,
		zoom: signal(1) as unknown as InputSignal<number>,
	});
	return { overlay, updateElement };
}

describe('chartQuickActionsOverlayComponent', () => {
	it('builds a descriptor with three buttons for a multi-series chart', () => {
		const { overlay } = createOverlay(chartElement(chartData()));
		const descriptor = overlay['descriptor']();
		expect(descriptor?.buttons.map((b) => b.id)).toStrictEqual(['elements', 'styles', 'filters']);
	});

	it('omits the filters button for a single-series chart', () => {
		const single = chartElement(chartData({ series: [{ name: 'Only', values: [1, 2] }] }));
		const { overlay } = createOverlay(single);
		const descriptor = overlay['descriptor']();
		expect(descriptor?.buttons.map((b) => b.id)).toStrictEqual(['elements', 'styles']);
	});

	it('commits a title toggle through the editor', () => {
		const { overlay, updateElement } = createOverlay(chartElement(chartData()));
		overlay['onElementToggle']('title', {
			target: { checked: false },
		} as unknown as Event);
		expect(updateElement).toHaveBeenCalledWith(0, 'chart-1', expect.anything());
		const [, , patch] = updateElement.mock.calls.at(-1)!;
		expect((patch.chartData as PptxChartData).style?.hasTitle).toBeFalsy();
	});

	it('commits a series hide/restore through the editor', () => {
		const { overlay, updateElement } = createOverlay(chartElement(chartData()));
		overlay['onFilterToggle'](0, undefined);
		expect(updateElement).toHaveBeenCalledWith(0, 'chart-1', expect.anything());
		const [, , patch] = updateElement.mock.calls.at(-1)!;
		const nextData = patch.chartData as PptxChartData;
		expect(nextData.series.map((s) => s.name)).not.toContain('Revenue');
		expect(nextData.filteredSeries?.[0]?.name).toBe('Revenue');
	});

	it('commits a style preset through the editor', () => {
		const { overlay, updateElement } = createOverlay(chartElement(chartData()));
		overlay['onStylePreset']('monochrome');
		expect(updateElement).toHaveBeenCalledWith(0, 'chart-1', expect.anything());
		const [, , patch] = updateElement.mock.calls.at(-1)!;
		expect((patch.chartData as PptxChartData).colorPalette?.length).toBeGreaterThan(0);
	});
});
