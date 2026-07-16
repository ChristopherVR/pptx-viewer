import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

function chartFrom(data: Awaited<ReturnType<PptxHandler['load']>>): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

describe('generated chartEx funnel package', () => {
	it('authors an extended part and survives load and dirty-save reload', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'funnel',
					{
						categories: ['Lead', 'Qualified', 'Won'],
						series: [{ name: 'Opportunities', values: [120, 75, 30], color: '#4472C4' }],
						title: 'Sales Funnel',
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const chartXml = await zip.file('ppt/extendedCharts/chart1.xml')!.async('string');
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');

		expect(zip.file('ppt/charts/chart1.xml')).toBeNull();
		expect(chartXml).toContain('<cx:chartSpace');
		expect(chartXml).toContain('<cx:series layoutId="funnel"');
		expect(chartXml).toContain('<cx:dataId val="0"');
		expect(chartXml.indexOf('<cx:spPr')).toBeLessThan(chartXml.indexOf('<cx:dataId'));
		expect(chartXml.indexOf('<cx:title')).toBeLessThan(chartXml.indexOf('<cx:plotArea'));
		expect(slideXml).toContain('drawing/2014/chartex');
		expect(slideRels).toContain('office/2014/relationships/chartEx');
		expect(slideRels).toContain('Target="../extendedCharts/chart1.xml"');
		expect(contentTypes).toContain('application/vnd.ms-office.chartex+xml');

		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(saved.buffer as ArrayBuffer);
		expect(chartFrom(loaded).chartData).toMatchObject({
			chartType: 'funnel',
			title: 'Sales Funnel',
			categories: ['Lead', 'Qualified', 'Won'],
			series: [{ name: 'Opportunities', values: [120, 75, 30], color: '#4472C4' }],
		});

		loaded.slides[0].isDirty = true;
		const resaved = await loadedHandler.save(loaded.slides);
		const reloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
		expect(chartFrom(reloaded).chartData?.series[0].values).toStrictEqual([120, 75, 30]);
	});
});
