import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

const VENDOR_EXTENSION =
	'<cx:extLst><cx:ext uri="sunburst-vendor"><vendor:hierarchy xmlns:vendor="urn:vendor">keep</vendor:hierarchy></cx:ext></cx:extLst>';

function chartFrom(data: Awaited<ReturnType<PptxHandler['load']>>): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

describe('generated chartEx sunburst package', () => {
	it('round-trips typed hierarchy levels and unknown extensions', async () => {
		const categories = ['Laptop', 'Desktop', 'Cloud'];
		const categoryLevels = [
			categories,
			['Hardware', 'Hardware', 'Software'],
			['North', 'North', 'South'],
		];
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'sunburst',
					{
						categories,
						categoryLevels,
						series: [{ name: 'Revenue', values: [65, 40, 25], color: '#FFC000' }],
						title: 'Regional Portfolio',
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const partPath = 'ppt/extendedCharts/chart1.xml';
		const chartXml = await zip.file(partPath)!.async('string');
		const strDimXml = chartXml.slice(
			chartXml.indexOf('<cx:strDim'),
			chartXml.indexOf('</cx:strDim>'),
		);

		expect(chartXml).toContain('<cx:series layoutId="sunburst"');
		expect(chartXml).toContain('<cx:numDim type="size"');
		expect(strDimXml.match(/<cx:lvl/gu)).toHaveLength(3);
		expect(strDimXml.indexOf('Laptop')).toBeLessThan(strDimXml.indexOf('Hardware'));
		expect(strDimXml.indexOf('Hardware')).toBeLessThan(strDimXml.indexOf('North'));

		zip.file(partPath, chartXml.replace('</cx:chart>', `${VENDOR_EXTENSION}</cx:chart>`));
		const augmented = await zip.generateAsync({ type: 'uint8array' });
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(augmented.buffer as ArrayBuffer);
		expect(chartFrom(loaded).chartData).toMatchObject({
			chartType: 'sunburst',
			title: 'Regional Portfolio',
			categories,
			categoryLevels,
			series: [{ name: 'Revenue', values: [65, 40, 25], color: '#FFC000' }],
		});

		loaded.slides[0].isDirty = true;
		const resaved = await loadedHandler.save(loaded.slides);
		const resavedZip = await JSZip.loadAsync(resaved);
		const resavedXml = await resavedZip.file(partPath)!.async('string');
		expect(resavedXml).toContain('uri="sunburst-vendor"');
		expect(resavedXml).toContain(
			'<vendor:hierarchy xmlns:vendor="urn:vendor">keep</vendor:hierarchy>',
		);
		const reloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
		expect(chartFrom(reloaded).chartData?.categoryLevels).toStrictEqual(categoryLevels);
		expect(chartFrom(reloaded).chartData?.categories).toStrictEqual(categories);
	});
});
