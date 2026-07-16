import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

const VENDOR_EXTENSION =
	'<cx:extLst><cx:ext uri="region-map-vendor"><vendor:geo xmlns:vendor="urn:vendor">keep</vendor:geo></cx:ext></cx:extLst>';

function chartFrom(data: Awaited<ReturnType<PptxHandler['load']>>): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

describe('generated chartEx region-map package', () => {
	it('round-trips region dimensions, geography and unknown extensions', async () => {
		const regionMapOptions = {
			entityIds: ['country:AU', 'country:US', 'country:DE'],
			categorySourceIndices: [2, 5, 9],
			valueSourceIndices: [2, 5, 9],
			entityIdSourceIndices: [2, 5, 9],
			regionLabelLayout: 'showAll' as const,
			projectionType: 'robinson' as const,
			viewedRegionType: 'world' as const,
			cultureLanguage: 'en-AU',
			cultureRegion: 'AU',
			attribution: 'Microsoft',
			geographyCache: {
				'@_provider': 'Bing',
				'cx:geoData': { '@_entityId': 'country:AU', '@_entityName': 'Australia' },
			},
		};
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'regionMap',
					{
						categories: ['AU', 'US', 'DE'],
						series: [
							{
								name: 'Revenue',
								values: [72, 95, 61],
								regionMapOptions,
							},
						],
						title: 'Regional Revenue',
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const partPath = 'ppt/extendedCharts/chart1.xml';
		const chartXml = await zip.file(partPath)!.async('string');
		expect(chartXml).toContain('<cx:series layoutId="regionMap"');
		expect(chartXml).toContain('<cx:strDim type="entityId"');
		expect(chartXml).toContain('<cx:pt idx="2">country:AU</cx:pt>');
		expect(chartXml).toContain('<cx:pt idx="5">US</cx:pt>');
		expect(chartXml).toContain('<cx:pt idx="9">61</cx:pt>');
		expect(chartXml).toContain('<cx:numDim type="colorVal"');
		expect(chartXml).toContain('<cx:regionLabelLayout val="showAll"');
		expect(chartXml).toContain(
			'<cx:geography projectionType="robinson" viewedRegionType="world" cultureLanguage="en-AU" cultureRegion="AU" attribution="Microsoft"',
		);
		expect(chartXml).toContain('<cx:geoCache provider="Bing">');
		expect(chartXml).toContain('<cx:geoData entityId="country:AU" entityName="Australia"');
		expect(chartXml.indexOf('<cx:regionLabelLayout')).toBeLessThan(
			chartXml.indexOf('<cx:geography'),
		);
		expect(chartXml.indexOf('<cx:dataId')).toBeLessThan(chartXml.indexOf('<cx:layoutPr'));

		zip.file(partPath, chartXml.replace('</cx:chart>', `${VENDOR_EXTENSION}</cx:chart>`));
		const augmented = await zip.generateAsync({ type: 'uint8array' });
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(augmented.buffer as ArrayBuffer);
		expect(chartFrom(loaded).chartData).toMatchObject({
			chartType: 'regionMap',
			title: 'Regional Revenue',
			categories: ['AU', 'US', 'DE'],
			series: [{ name: 'Revenue', values: [72, 95, 61], regionMapOptions }],
		});

		loaded.slides[0].isDirty = true;
		const resaved = await loadedHandler.save(loaded.slides);
		const resavedZip = await JSZip.loadAsync(resaved);
		const resavedXml = await resavedZip.file(partPath)!.async('string');
		expect(resavedXml).toContain('uri="region-map-vendor"');
		expect(resavedXml).toContain('<vendor:geo xmlns:vendor="urn:vendor">keep</vendor:geo>');
		const reloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
		expect(chartFrom(reloaded).chartData?.categories).toStrictEqual(['AU', 'US', 'DE']);
		expect(chartFrom(reloaded).chartData?.series[0]).toMatchObject({
			values: [72, 95, 61],
			regionMapOptions,
		});
	});
});
