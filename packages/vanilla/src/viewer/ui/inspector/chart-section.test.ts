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
	it('keeps every chart type it has always offered, plus the ChartEx and 3-D types', () => {
		const { labelFor } = mount();
		const select = labelFor('pptx.chart.type').querySelector('select')!;

		expect(Array.from(select.options).map((option) => option.value)).toStrictEqual([
			'bar',
			'bar3D',
			'line',
			'line3D',
			'pie',
			'pie3D',
			'doughnut',
			'area',
			'area3D',
			'surface',
			'scatter',
			'bubble',
			'radar',
			'stock',
			'waterfall',
			'histogram',
			'pareto',
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
			'pptx.chart.typeBar3D',
			'pptx.chart.typeLine',
			'pptx.chart.typeLine3D',
			'pptx.chart.typePie',
			'pptx.chart.typePie3D',
			'pptx.chart.typeDoughnut',
			'pptx.chart.typeArea',
			'pptx.chart.typeArea3D',
			'pptx.chart.typeSurface',
			'pptx.chart.typeScatter',
			'pptx.chart.typeBubble',
			'pptx.chart.typeRadar',
			'pptx.chart.typeStock',
			'pptx.chart.typeWaterfall',
			'pptx.chart.typeHistogram',
			'pptx.chart.typePareto',
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

	it("converts a 'pareto' selection to histogram plus a cumulative-percent series (docs/guide/limitations.md ChartEx row)", () => {
		const { labelFor, setChartData } = mount();
		const select = labelFor('pptx.chart.type').querySelector('select')!;

		select.value = 'pareto';
		select.dispatchEvent(new Event('change'));

		expect(setChartData).toHaveBeenCalledOnce();
		const committed = setChartData.mock.calls[0]?.[0] as PptxChartData;
		expect(committed.chartType).toBe('histogram');
		expect(committed.series).toHaveLength(2);
		expect(committed.series[1].histogramOptions?.layout).toBe('pareto');
	});

	it('shows "pareto" (not "histogram") as selected for a histogram with a paretoLine series', () => {
		const { section, labelFor } = mount();
		section.update({
			isChart: true,
			chartData: chart({
				chartType: 'histogram',
				series: [
					{ name: 'Frequency', values: [3, 5, 2] },
					{ name: 'Cumulative %', values: [30, 80, 100], histogramOptions: { layout: 'pareto' } },
				],
			}),
		} as InspectorState);
		const select = labelFor('pptx.chart.type').querySelector('select')!;

		expect(select.value).toBe('pareto');
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

// W4-D: a multi-run title collapses to one run in the dominant style instead
// of leaving a stale second run's text behind.
describe('chart section title field', () => {
	it('collapses a multi-run title to one run in the dominant style on commit', () => {
		const setChartData = vi.fn();
		const section = createChartSection(document, (key) => key, sectionFactory(), {
			setChartData,
		} as unknown as InspectorHandlers);
		section.update({
			isChart: true,
			chartData: chart({
				title: 'Sales Q1',
				titleRuns: [
					{ text: 'Sales ', bold: true },
					{ text: 'Q1 Numbers', italic: true, color: '#FF0000' },
				],
			}),
		} as InspectorState);

		const labels = Array.from(section.el.querySelectorAll('label'));
		const titleLabel = labels.find((label) => label.textContent?.startsWith('pptx.chart.title'))!;
		const titleInput = titleLabel.querySelector('input')!;
		titleInput.value = 'New Title';
		titleInput.dispatchEvent(new Event('change', { bubbles: true }));

		expect(setChartData).toHaveBeenCalledOnce();
		const next = setChartData.mock.calls[0][0] as PptxChartData;
		expect(next.title).toBe('New Title');
		expect(next.titleRuns).toStrictEqual([{ text: 'New Title', italic: true, color: '#FF0000' }]);
	});
});
