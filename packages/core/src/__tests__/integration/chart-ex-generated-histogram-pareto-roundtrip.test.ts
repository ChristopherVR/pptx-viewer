import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

const VENDOR_EXTENSION =
	'<cx:extLst><cx:ext uri="histogram-vendor"><vendor:binning xmlns:vendor="urn:vendor">keep</vendor:binning></cx:ext></cx:extLst>';

function chartFrom(data: Awaited<ReturnType<PptxHandler['load']>>): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

describe('generated chartEx histogram and Pareto package', () => {
	it('round-trips typed binning and Pareto layouts with unknown extensions', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'histogram',
					{
						categories: ['A', 'B', 'C', 'D'],
						series: [
							{
								name: 'Frequency',
								values: [7, 4, 2, 1],
								histogramOptions: {
									layout: 'histogram',
									binCount: 5,
									intervalClosed: 'r',
									underflow: 'auto',
									overflow: 100,
								},
							},
							{
								name: 'Cumulative',
								values: [50, 78, 92, 100],
								histogramOptions: { layout: 'pareto' },
							},
						],
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const partPath = 'ppt/extendedCharts/chart1.xml';
		const chartXml = await zip.file(partPath)!.async('string');
		expect(chartXml).toContain('<cx:series layoutId="clusteredColumn"');
		expect(chartXml).toContain('<cx:series layoutId="paretoLine"');
		expect(chartXml).toContain(
			'<cx:binning intervalClosed="r" underflow="auto" overflow="100"><cx:binCount>5</cx:binCount></cx:binning>',
		);
		expect(chartXml.indexOf('<cx:dataId')).toBeLessThan(chartXml.indexOf('<cx:layoutPr'));

		zip.file(partPath, chartXml.replace('</cx:chart>', `${VENDOR_EXTENSION}</cx:chart>`));
		const augmented = await zip.generateAsync({ type: 'uint8array' });
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(augmented.buffer as ArrayBuffer);
		expect(chartFrom(loaded).chartData).toMatchObject({
			chartType: 'histogram',
			categories: ['A', 'B', 'C', 'D'],
			series: [
				{
					name: 'Frequency',
					values: [7, 4, 2, 1],
					histogramOptions: {
						layout: 'histogram',
						binCount: 5,
						intervalClosed: 'r',
						underflow: 'auto',
						overflow: 100,
					},
				},
				{
					name: 'Cumulative',
					values: [50, 78, 92, 100],
					histogramOptions: { layout: 'pareto' },
				},
			],
		});

		loaded.slides[0].isDirty = true;
		const resaved = await loadedHandler.save(loaded.slides);
		const resavedZip = await JSZip.loadAsync(resaved);
		const resavedXml = await resavedZip.file(partPath)!.async('string');
		expect(resavedXml).toContain('uri="histogram-vendor"');
		expect(resavedXml).toContain('<vendor:binning xmlns:vendor="urn:vendor">keep</vendor:binning>');
		const reloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
		expect(chartFrom(reloaded).chartData?.series[0].histogramOptions).toMatchObject({
			layout: 'histogram',
			binCount: 5,
		});
		expect(chartFrom(reloaded).chartData?.series[1].histogramOptions).toStrictEqual({
			layout: 'pareto',
		});
	});

	/**
	 * The Insert Chart / Change Chart Type "Pareto" entry (see
	 * `pptx-viewer-shared`'s `chart-ex-insert-defaults.ts` and
	 * `chart-editor-options.ts`, and docs/guide/limitations.md's ChartEx row)
	 * builds exactly this shape: `chartType: 'histogram'` with raw observations
	 * on the first series (no explicit binning column/size, matching the
	 * insert-time default) and a `pareto`-layout cumulative-percent series.
	 * Verifies core serializes it as `clusteredColumn` + `paretoLine`, the two
	 * layoutIds the doc says a Pareto chart is modeled as, independent of
	 * `pptx-viewer-shared` (this package does not depend on it).
	 */
	it('serializes the Pareto insert/change-type shape as clusteredColumn + paretoLine', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'histogram',
					{
						categories: [],
						series: [
							{
								name: 'Frequency',
								values: [1, 1, 1, 2, 2, 3, 4, 6, 8, 10, 13, 17, 22],
								histogramOptions: { layout: 'histogram', binCount: 5 },
							},
							{
								name: 'Cumulative %',
								values: [45.16, 70.97, 87.1, 96.77, 100],
								histogramOptions: { layout: 'pareto' },
							},
						],
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const chartXml = await zip.file('ppt/extendedCharts/chart1.xml')!.async('string');
		expect(chartXml).toContain('<cx:series layoutId="clusteredColumn"');
		expect(chartXml).toContain('<cx:series layoutId="paretoLine"');
		expect(chartXml).not.toContain('layoutId="waterfall"');

		const loaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const chart = chartFrom(loaded);
		expect(chart.chartData?.chartType).toBe('histogram');
		expect(chart.chartData?.series).toHaveLength(2);
		expect(chart.chartData?.series[0].histogramOptions?.layout).toBe('histogram');
		expect(chart.chartData?.series[1].histogramOptions?.layout).toBe('pareto');
	});
});
