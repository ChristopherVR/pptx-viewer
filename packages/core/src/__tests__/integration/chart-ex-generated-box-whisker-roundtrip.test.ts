import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

const VENDOR_EXTENSION =
	'<cx:extLst><cx:ext uri="box-whisker-vendor"><vendor:statistics xmlns:vendor="urn:vendor">keep</vendor:statistics></cx:ext></cx:extLst>';

function chartFrom(data: Awaited<ReturnType<PptxHandler['load']>>): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

describe('generated chartEx box-and-whisker package', () => {
	it('round-trips typed layout options and unknown extensions', async () => {
		const options = {
			quartileMethod: 'inclusive' as const,
			showMeanLine: true,
			showMeanMarker: false,
			showInnerPoints: true,
			showOutlierPoints: false,
		};
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'boxWhisker',
					{
						categories: ['North', 'South', 'West'],
						series: [
							{ name: 'Current', values: [12, 18, 31], boxWhiskerOptions: options },
							{ name: 'Prior', values: [9, 15, 27], boxWhiskerOptions: options },
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
		expect(chartXml.match(/<cx:series layoutId="boxWhisker"/gu)).toHaveLength(2);
		expect(chartXml).toContain(
			'<cx:visibility meanLine="1" meanMarker="0" nonoutliers="1" outliers="0"',
		);
		expect(chartXml).toContain('<cx:statistics quartileMethod="inclusive"');
		expect(chartXml.indexOf('<cx:dataId')).toBeLessThan(chartXml.indexOf('<cx:layoutPr'));

		zip.file(partPath, chartXml.replace('</cx:chart>', `${VENDOR_EXTENSION}</cx:chart>`));
		const augmented = await zip.generateAsync({ type: 'uint8array' });
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(augmented.buffer as ArrayBuffer);
		expect(chartFrom(loaded).chartData).toMatchObject({
			chartType: 'boxWhisker',
			categories: ['North', 'South', 'West'],
			series: [
				{ name: 'Current', values: [12, 18, 31], boxWhiskerOptions: options },
				{ name: 'Prior', values: [9, 15, 27], boxWhiskerOptions: options },
			],
		});

		loaded.slides[0].isDirty = true;
		const resaved = await loadedHandler.save(loaded.slides);
		const resavedZip = await JSZip.loadAsync(resaved);
		const resavedXml = await resavedZip.file(partPath)!.async('string');
		expect(resavedXml).toContain('uri="box-whisker-vendor"');
		expect(resavedXml).toContain(
			'<vendor:statistics xmlns:vendor="urn:vendor">keep</vendor:statistics>',
		);
		const reloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
		expect(chartFrom(reloaded).chartData?.series[0].boxWhiskerOptions).toStrictEqual(options);
	});
});
