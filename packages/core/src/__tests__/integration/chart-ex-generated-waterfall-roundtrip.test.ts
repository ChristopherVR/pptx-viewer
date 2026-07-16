import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

const VENDOR_EXTENSION =
	'<cx:extLst><cx:ext uri="waterfall-vendor"><vendor:payload xmlns:vendor="urn:vendor">keep</vendor:payload></cx:ext></cx:extLst>';

function chartFrom(data: Awaited<ReturnType<PptxHandler['load']>>): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

describe('generated chartEx waterfall package', () => {
	it('authors waterfall data and retains unknown extensions through dirty save', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'waterfall',
					{
						categories: ['Opening', 'Sales', 'Costs', 'Closing'],
						series: [
							{
								name: 'Cash flow',
								values: [100, 45, -30, 115],
								color: '#70AD47',
								waterfallOptions: { subtotalIndices: [0, 3], connectorLines: false },
							},
						],
						title: 'Cash Movement',
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const partPath = 'ppt/extendedCharts/chart1.xml';
		const chartXml = await zip.file(partPath)!.async('string');
		const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');

		expect(chartXml).toContain('<cx:series layoutId="waterfall"');
		expect(chartXml).toContain('<cx:pt idx="2">-30</cx:pt>');
		expect(chartXml).toContain('<cx:visibility connectorLines="0"></cx:visibility>');
		expect(chartXml).toContain('<cx:idx val="0"></cx:idx>');
		expect(chartXml).toContain('<cx:idx val="3"></cx:idx>');
		expect(chartXml.indexOf('<cx:visibility')).toBeLessThan(chartXml.indexOf('<cx:subtotals'));
		expect(slideRels).toContain('office/2014/relationships/chartEx');
		expect(contentTypes).toContain('application/vnd.ms-office.chartex+xml');

		zip.file(partPath, chartXml.replace('</cx:chart>', `${VENDOR_EXTENSION}</cx:chart>`));
		const augmented = await zip.generateAsync({ type: 'uint8array' });
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(augmented.buffer as ArrayBuffer);
		expect(chartFrom(loaded).chartData).toMatchObject({
			chartType: 'waterfall',
			title: 'Cash Movement',
			categories: ['Opening', 'Sales', 'Costs', 'Closing'],
			series: [
				{
					name: 'Cash flow',
					values: [100, 45, -30, 115],
					color: '#70AD47',
					waterfallOptions: { subtotalIndices: [0, 3], connectorLines: false },
				},
			],
		});

		loaded.slides[0].isDirty = true;
		const resaved = await loadedHandler.save(loaded.slides);
		const resavedZip = await JSZip.loadAsync(resaved);
		const resavedXml = await resavedZip.file(partPath)!.async('string');
		expect(resavedXml).toContain('uri="waterfall-vendor"');
		expect(resavedXml).toContain('<vendor:payload xmlns:vendor="urn:vendor">keep</vendor:payload>');
		const reloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
		expect(chartFrom(reloaded).chartData?.series[0]).toMatchObject({
			values: [100, 45, -30, 115],
			waterfallOptions: { subtotalIndices: [0, 3], connectorLines: false },
		});
	});
});
