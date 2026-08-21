import JSZip from 'jszip';
import type { ChartPptxElement, PptxData } from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { createChart, updateChart } from '../../tools/chart-tools.js';
import type { ToolContext } from '../../types.js';

function makeTestPresentation(): PptxData {
	return {
		width: 960,
		height: 540,
		slides: [
			{
				id: 'slide-0',
				rId: 'rId2',
				slideNumber: 1,
				elements: [
					{
						id: 'chart-0',
						type: 'chart' as const,
						x: 50,
						y: 50,
						width: 400,
						height: 300,
						chartData: {
							chartType: 'bar',
							categories: ['A', 'B', 'C', 'D'],
							series: [{ name: 'Defects', values: [40, 30, 20, 10] }],
						},
					},
				],
				notes: '',
				comments: [],
			},
		],
	} as unknown as PptxData;
}

function ctx(pptxData?: PptxData): ToolContext {
	return { pptxData: pptxData ?? makeTestPresentation() };
}

function emptyPresentation(): PptxData {
	return {
		width: 960,
		height: 540,
		slides: [{ id: 'slide-0', rId: 'rId2', slideNumber: 1, elements: [], notes: '', comments: [] }],
	} as unknown as PptxData;
}

describe('createChart with chartType "pareto"', () => {
	it('produces a real ChartEx histogram+paretoLine chart on save, not a silent bar chart', async () => {
		const c = ctx(emptyPresentation());
		const result = createChart(c, {
			slideIndex: 0,
			chartType: 'pareto',
			categories: ['A', 'B', 'C', 'D'],
			series: [{ name: 'Defects', values: [40, 30, 20, 10] }],
		});
		expect(result.dirty).toBeTruthy();

		const chart = result.pptxData.slides[0].elements.find(
			(e) => e.id === result.result.elementId,
		) as ChartPptxElement;
		expect(chart.chartData?.chartType).toBe('histogram');
		expect(chart.chartData?.series).toHaveLength(2);
		expect(chart.chartData?.series[1].histogramOptions?.layout).toBe('pareto');

		const handler = new PptxHandler();
		const saved = await handler.save(result.pptxData.slides);
		const zip = await JSZip.loadAsync(saved);
		const extendedPart = zip.file('ppt/extendedCharts/chart1.xml');
		expect(extendedPart).not.toBeNull();
		const xml = await extendedPart!.async('string');
		expect(xml).toContain('<cx:series layoutId="clusteredColumn"');
		expect(xml).toContain('<cx:series layoutId="paretoLine"');
		// Confirms this did NOT silently fall back to a classic bar chart part.
		expect(zip.file('ppt/charts/chart1.xml')).toBeNull();
	});
});

describe('updateChart with chartType "pareto"', () => {
	it('converts an existing bar chart into a histogram+paretoLine ChartEx chart', () => {
		const c = ctx();
		const result = updateChart(c, {
			slideIndex: 0,
			elementId: 'chart-0',
			chartType: 'pareto',
		});
		expect(result.dirty).toBeTruthy();

		const chart = c.pptxData.slides[0].elements[0] as ChartPptxElement;
		expect(chart.chartData?.chartType).toBe('histogram');
		expect(chart.chartData?.series).toHaveLength(2);
		expect(chart.chartData?.series[0].histogramOptions?.layout).toBe('histogram');
		expect(chart.chartData?.series[1].name).toBe('Cumulative %');
		expect(chart.chartData?.series[1].values).toStrictEqual([40, 70, 90, 100]);
	});
});
