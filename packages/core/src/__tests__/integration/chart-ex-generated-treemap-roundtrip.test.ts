import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

const VENDOR_EXTENSION =
	'<cx:extLst><cx:ext uri="treemap-vendor"><vendor:hierarchy xmlns:vendor="urn:vendor">keep</vendor:hierarchy></cx:ext></cx:extLst>';

function chartFrom(data: Awaited<ReturnType<PptxHandler['load']>>): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

describe('generated chartEx treemap package', () => {
	it('authors category and size dimensions and retains unknown extensions', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const categories = ['Hardware', 'Software', 'Services'];
		const categoryLevels = [categories, ['North', 'North', 'South']];
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'treemap',
					{
						categories,
						categoryLevels,
						series: [
							{
								name: 'Revenue',
								values: [65, 40, 25],
								color: '#5B9BD5',
								treemapOptions: { parentLabelLayout: 'banner' },
							},
						],
						title: 'Portfolio Mix',
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const partPath = 'ppt/extendedCharts/chart1.xml';
		const chartXml = await zip.file(partPath)!.async('string');

		expect(chartXml).toContain('<cx:series layoutId="treemap"');
		expect(chartXml).toContain('<cx:strDim type="cat"');
		expect(chartXml).toContain('<cx:numDim type="size"');
		expect(chartXml.match(/<cx:lvl /gu)).toHaveLength(3);
		expect(chartXml).toContain('<cx:parentLabelLayout val="banner"');
		for (const category of categories) {
			expect(chartXml).toContain(`>${category}</cx:pt>`);
		}

		zip.file(partPath, chartXml.replace('</cx:chart>', `${VENDOR_EXTENSION}</cx:chart>`));
		const augmented = await zip.generateAsync({ type: 'uint8array' });
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(augmented.buffer as ArrayBuffer);
		expect(chartFrom(loaded).chartData).toMatchObject({
			chartType: 'treemap',
			title: 'Portfolio Mix',
			categories,
			categoryLevels,
			series: [
				{
					name: 'Revenue',
					values: [65, 40, 25],
					color: '#5B9BD5',
					treemapOptions: { parentLabelLayout: 'banner' },
				},
			],
		});

		loaded.slides[0].isDirty = true;
		const resaved = await loadedHandler.save(loaded.slides);
		const resavedZip = await JSZip.loadAsync(resaved);
		const resavedXml = await resavedZip.file(partPath)!.async('string');
		expect(resavedXml).toContain('uri="treemap-vendor"');
		expect(resavedXml).toContain('<cx:parentLabelLayout val="banner"');
		expect(resavedXml).toContain(
			'<vendor:hierarchy xmlns:vendor="urn:vendor">keep</vendor:hierarchy>',
		);
		const reloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
		expect(chartFrom(reloaded).chartData?.categories).toStrictEqual(categories);
		expect(chartFrom(reloaded).chartData?.categoryLevels).toStrictEqual(categoryLevels);
		expect(chartFrom(reloaded).chartData?.series[0].values).toStrictEqual([65, 40, 25]);
		expect(chartFrom(reloaded).chartData?.series[0].treemapOptions).toStrictEqual({
			parentLabelLayout: 'banner',
		});
	});
});
