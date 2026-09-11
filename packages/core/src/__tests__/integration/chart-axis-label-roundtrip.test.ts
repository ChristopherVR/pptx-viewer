import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { XmlObject } from '../../core/types';
import type { ChartPptxElement } from '../../core/types/elements';
import { applyChartAxisTitleToXml } from '../../core/utils/chart-axis-title-serializer';

function chartFrom(slides: Awaited<ReturnType<PptxHandler['load']>>['slides']): ChartPptxElement {
	const element = slides[0].elements.find((candidate) => candidate.type === 'chart');
	if (!element || element.type !== 'chart') {
		throw new Error('Expected chart element');
	}
	return element;
}

async function buildDeckWithAttributedAxisTitle(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank')
			.addChart(
				'bar',
				{ categories: ['Q1', 'Q2'], series: [{ name: 'Revenue', values: [10, 20] }] },
				{ x: 50, y: 50, width: 500, height: 300 },
			)
			.build(),
	);
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	const path = 'ppt/charts/chart1.xml';
	const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
	const document = parser.parse(await zip.file(path)!.async('string')) as XmlObject;
	const chartSpace = document['c:chartSpace'] as XmlObject;
	const chart = chartSpace['c:chart'] as XmlObject;
	const plotArea = chart['c:plotArea'] as XmlObject;
	const categoryAxis = plotArea['c:catAx'] as XmlObject;
	const valueAxis = plotArea['c:valAx'] as XmlObject;
	const getLocalName = (key: string) => key.split(':').at(-1)!;
	applyChartAxisTitleToXml(categoryAxis, 'Category axis', getLocalName);
	applyChartAxisTitleToXml(valueAxis, 'Value axis', getLocalName);
	const valueAxisKeys = Object.keys(valueAxis).map(getLocalName);
	expect(valueAxisKeys.indexOf('title')).toBeGreaterThan(valueAxisKeys.indexOf('axPos'));
	expect(valueAxisKeys.indexOf('title')).toBeLessThan(valueAxisKeys.indexOf('crossAx'));

	const valueTitle = valueAxis['c:title'] as XmlObject;
	const valueRich = ((valueTitle['c:tx'] as XmlObject)['c:rich'] as XmlObject)['a:p'] as XmlObject;
	const valueRun = valueRich['a:r'] as XmlObject;
	expect(valueRun['a:t']).toBe('Value axis');
	valueRun['a:t'] = { '@_xml:space': 'preserve', '#text': ' Value axis ' };
	zip.file(
		path,
		new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' }).build(document),
	);
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

describe('chartML axis label formatting round-trip', () => {
	it('preserves an attributed axis title through an unrelated save', async () => {
		let handler = new PptxHandler();
		let loaded = await handler.load(await buildDeckWithAttributedAxisTitle());
		let chart = chartFrom(loaded.slides);
		const categoryAxis = chart.chartData!.axes?.find((axis) => axis.axisType === 'catAx');
		const valueAxis = chart.chartData!.axes?.find((axis) => axis.axisType === 'valAx');
		expect(categoryAxis?.titleText).toBe('Category axis');
		expect(valueAxis?.titleText).toBe(' Value axis ');

		chart.x += 1;
		loaded.slides[0].isDirty = true;
		const saved = await handler.save(loaded.slides);
		const zip = await JSZip.loadAsync(saved);
		const chartXml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(chartXml).toContain('<a:t xml:space="preserve"> Value axis </a:t>');
		expect(chartXml).toContain('<a:t>Category axis</a:t>');
		expect(chartXml).not.toContain('[object Object]');

		handler = new PptxHandler();
		loaded = await handler.load(saved.buffer as ArrayBuffer);
		chart = chartFrom(loaded.slides);
		expect(chart.chartData!.axes?.find((axis) => axis.axisType === 'catAx')?.titleText).toBe(
			'Category axis',
		);
		expect(chart.chartData!.axes?.find((axis) => axis.axisType === 'valAx')?.titleText).toBe(
			' Value axis ',
		);
	});

	it('still replaces an attributed axis title after a genuine title edit', async () => {
		const handler = new PptxHandler();
		const loaded = await handler.load(await buildDeckWithAttributedAxisTitle());
		const valueAxis = chartFrom(loaded.slides).chartData!.axes?.find(
			(axis) => axis.axisType === 'valAx',
		);
		expect(valueAxis).toBeDefined();
		valueAxis!.titleText = 'Edited value axis';

		loaded.slides[0].isDirty = true;
		const saved = await handler.save(loaded.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(
			chartFrom(reloaded.slides).chartData!.axes?.find((axis) => axis.axisType === 'valAx')
				?.titleText,
		).toBe('Edited value axis');
		const zip = await JSZip.loadAsync(saved);
		const chartXml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(chartXml).toContain('Edited value axis');
		expect(chartXml).not.toContain(' Value axis ');
		expect(chartXml).not.toContain('[object Object]');
	});

	it('generates, parses, edits, and dirty-saves category-axis label controls', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'bar',
					{ categories: ['Q1', 'Q2'], series: [{ name: 'Revenue', values: [10, 20] }] },
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);
		chartFrom(data.slides).chartData!.axes = [
			{
				axisType: 'catAx',
				crosses: 'max',
				majorTickMark: 'out',
				minorTickMark: 'in',
				tickLblPos: 'low',
				auto: false,
				labelAlignment: 'r',
				labelOffset: 160,
				noMultiLevelLabels: true,
			},
			{ axisType: 'valAx', crossesAt: 12, crossBetween: 'midCat' },
		];

		const firstHandler = new PptxHandler();
		const first = await firstHandler.load((await handler.save(data.slides)).buffer as ArrayBuffer);
		const loadedAxis = chartFrom(first.slides).chartData!.axes?.find(
			(axis) => axis.axisType === 'catAx',
		);
		expect(loadedAxis).toMatchObject({
			crosses: 'max',
			majorTickMark: 'out',
			minorTickMark: 'in',
			tickLblPos: 'low',
			auto: false,
			labelAlignment: 'r',
			labelOffset: 160,
			noMultiLevelLabels: true,
		});
		expect(
			chartFrom(first.slides).chartData!.axes?.find((axis) => axis.axisType === 'valAx'),
		).toMatchObject({ crossesAt: 12, crossBetween: 'midCat' });

		Object.assign(loadedAxis!, {
			crosses: undefined,
			crossesAt: 2,
			majorTickMark: 'cross',
			minorTickMark: 'none',
			auto: true,
			labelAlignment: 'ctr',
			labelOffset: 90,
			noMultiLevelLabels: false,
		});
		const loadedValueAxis = chartFrom(first.slides).chartData!.axes?.find(
			(axis) => axis.axisType === 'valAx',
		);
		Object.assign(loadedValueAxis!, { crossesAt: undefined, crosses: 'min' });
		const secondBytes = await firstHandler.save(first.slides);
		const second = await new PptxHandler().load(secondBytes.buffer as ArrayBuffer);
		expect(
			chartFrom(second.slides).chartData!.axes?.find((axis) => axis.axisType === 'catAx'),
		).toMatchObject({
			crossesAt: 2,
			majorTickMark: 'cross',
			minorTickMark: 'none',
			auto: true,
			labelAlignment: 'ctr',
			labelOffset: 90,
			noMultiLevelLabels: false,
		});
		expect(
			chartFrom(second.slides).chartData!.axes?.find((axis) => axis.axisType === 'valAx'),
		).toMatchObject({ crosses: 'min', crossBetween: 'midCat' });
	});
});
