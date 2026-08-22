/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own short arrange/act/assert consts. */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createChartSection } from './chart-section';
import type { InspectorHandlers, InspectorState } from './types';

/** A `section()` factory matching the one `createInspector` passes in. */
function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [{ name: 'Sales', values: [1, 2] }],
		...overrides,
	};
}

/**
 * Mount the section with the identity translator, so an option's text IS the
 * i18n key it resolved: that is what proves the control is spelled from the
 * shared catalogue rather than from the raw schema token.
 */
function mount() {
	const setChartData = vi.fn();
	const section = createChartSection(document, (key) => key, sectionFactory(), {
		setChartData,
	} as unknown as InspectorHandlers);
	section.update({ isChart: true, chartData: chart() } as InspectorState);
	const labels = Array.from(section.el.querySelectorAll('label'));
	const labelFor = (key: string): HTMLLabelElement =>
		labels.find((label) => label.textContent?.startsWith(key))!;
	return { section, setChartData, labelFor };
}

describe('chart section type and grouping selects', () => {
	it('keeps every chart type it has always offered, plus the six ChartEx types', () => {
		const { labelFor } = mount();
		const select = labelFor('pptx.chart.type').querySelector('select')!;

		expect(Array.from(select.options).map((option) => option.value)).toStrictEqual([
			'bar',
			'line',
			'pie',
			'doughnut',
			'area',
			'scatter',
			'bubble',
			'radar',
			'stock',
			'waterfall',
			'histogram',
			'funnel',
			'treemap',
			'sunburst',
			'boxWhisker',
			'regionMap',
			'combo',
		]);
	});

	it('spells the chart types instead of printing the schema token', () => {
		const { labelFor } = mount();
		const select = labelFor('pptx.chart.type').querySelector('select')!;

		expect(Array.from(select.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.chart.typeBar',
			'pptx.chart.typeLine',
			'pptx.chart.typePie',
			'pptx.chart.typeDoughnut',
			'pptx.chart.typeArea',
			'pptx.chart.typeScatter',
			'pptx.chart.typeBubble',
			'pptx.chart.typeRadar',
			'pptx.chart.typeStock',
			'pptx.chart.typeWaterfall',
			'pptx.chart.typeHistogram',
			'pptx.chart.typeFunnel',
			'pptx.chart.typeTreemap',
			'pptx.chart.typeSunburst',
			'pptx.chart.typeBoxWhisker',
			'pptx.chart.typeRegionMap',
			'pptx.chart.typeCombo',
		]);
	});

	it('spells the grouping modes and keeps their three values', () => {
		const { labelFor } = mount();
		const select = labelFor('pptx.chart.grouping').querySelector('select')!;

		expect(Array.from(select.options).map((option) => option.value)).toStrictEqual([
			'clustered',
			'stacked',
			'percentStacked',
		]);
		expect(Array.from(select.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.chart.groupingClustered',
			'pptx.chart.groupingStacked',
			'pptx.chart.groupingPercentStacked',
		]);
	});

	it('names both selects, which used to be bare unlabelled dropdowns', () => {
		const { labelFor } = mount();

		expect(labelFor('pptx.chart.type').querySelector('select')).not.toBeNull();
		expect(labelFor('pptx.chart.grouping').querySelector('select')).not.toBeNull();
	});

	it('still commits the raw token, not the caption', () => {
		const { labelFor, setChartData } = mount();
		const select = labelFor('pptx.chart.type').querySelector('select')!;

		select.value = 'treemap';
		select.dispatchEvent(new Event('change'));

		expect(setChartData).toHaveBeenLastCalledWith(
			expect.objectContaining({ chartType: 'treemap' }),
		);
	});
});

/**
 * `chartHighlightCell` is the state field a canvas mark click surfaces
 * through (`chart-editable.ts` -> the store -> `buildInspectorState`). Before
 * this landed, the section never read the field at all: a click had nowhere
 * to go.
 */
describe('chart section canvas-click selection surfacing', () => {
	it('rings the matching cell in the data grid', () => {
		const setChartData = vi.fn();
		const section = createChartSection(document, (key) => key, sectionFactory(), {
			setChartData,
		} as unknown as InspectorHandlers);

		section.update({
			isChart: true,
			chartData: chart({ series: [{ name: 'Sales', values: [1, 2] }] }),
			chartHighlightCell: { seriesIndex: 0, pointIndex: 1 },
		} as InspectorState);

		const highlighted = section.el.querySelector('.pptxv-chart-grid-cell-highlight');
		expect(highlighted).not.toBeNull();
		expect((highlighted as HTMLInputElement).value).toBe('2');
	});

	it('points the shared Data Point Index box at the clicked point', () => {
		const setChartData = vi.fn();
		const section = createChartSection(document, (key) => key, sectionFactory(), {
			setChartData,
		} as unknown as InspectorHandlers);

		section.update({
			isChart: true,
			chartData: chart({ series: [{ name: 'Sales', values: [1, 2, 3] }] }),
			chartHighlightCell: { seriesIndex: 0, pointIndex: 2 },
		} as InspectorState);

		const labels = Array.from(section.el.querySelectorAll('label'));
		const pointIndexLabel = labels.find((label) =>
			label.textContent?.startsWith('pptx.chart.dataPointIndex'),
		)!;
		const control = pointIndexLabel.querySelector('input')!;
		// 0-based pointIndex 2 -> PowerPoint's 1-based display value 3.
		expect(control.value).toBe('3');
	});

	it('leaves no highlight when nothing is selected on canvas', () => {
		const { section } = mount();

		expect(section.el.querySelector('.pptxv-chart-grid-cell-highlight')).toBeNull();
	});
});
