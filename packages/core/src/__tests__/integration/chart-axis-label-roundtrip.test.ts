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

const CHART_PATH = 'ppt/charts/chart1.xml';
const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	trimValues: false,
});
const xmlBuilder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const getLocalName = (key: string): string => key.split(':').at(-1)!;

function asArray<T>(value: T | T[] | undefined): T[] {
	return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function axisNode(document: XmlObject, axisType: 'catAx' | 'valAx'): XmlObject {
	const chartSpace = document['c:chartSpace'] as XmlObject;
	const chart = chartSpace['c:chart'] as XmlObject;
	const plotArea = chart['c:plotArea'] as XmlObject;
	return plotArea[`c:${axisType}`] as XmlObject;
}

function titleNode(document: XmlObject, axisType: 'catAx' | 'valAx'): XmlObject {
	return axisNode(document, axisType)['c:title'] as XmlObject;
}

function titleParagraph(title: XmlObject): XmlObject {
	return (((title['c:tx'] as XmlObject)['c:rich'] as XmlObject)['a:p'] ?? {}) as XmlObject;
}

function titleTextValues(title: XmlObject): string[] {
	return asArray(titleParagraph(title)['a:r'] as XmlObject | XmlObject[] | undefined).map((run) =>
		typeof run['a:t'] === 'object'
			? String((run['a:t'] as XmlObject)['#text'] ?? '')
			: String(run['a:t'] ?? ''),
	);
}

function setTwoRunTitle(
	axis: XmlObject,
	firstText: string,
	secondText: string,
	accent: string,
): void {
	applyChartAxisTitleToXml(axis, `${firstText}${secondText}`, getLocalName);
	const existingTitle = axis['c:title'] as XmlObject;
	const rich = (existingTitle['c:tx'] as XmlObject)['c:rich'] as XmlObject;
	rich['a:p'] = {
		'a:pPr': { '@_algn': 'ctr', 'a:defRPr': { '@_lang': 'en-US' } },
		'a:r': [
			{
				'a:rPr': {
					'@_lang': 'en-AU',
					'@_b': '1',
					'a:solidFill': {
						'a:schemeClr': { '@_val': accent, 'a:lumMod': { '@_val': '75000' } },
					},
					'a:latin': { '@_typeface': '+mj-lt' },
				},
				'a:t': firstText,
			},
			{ 'a:rPr': { '@_lang': 'de-DE', '@_i': '1' }, 'a:t': secondText },
		],
		'a:endParaRPr': { '@_lang': 'fr-FR' },
	};
	axis['c:title'] = {
		'c:tx': existingTitle['c:tx'],
		'c:layout': {
			'c:manualLayout': { 'c:xMode': { '@_val': 'factor' }, 'c:x': { '@_val': '0.2' } },
		},
		'c:overlay': { '@_val': '1' },
		'c:spPr': {
			'a:ln': {
				'@_w': '12700',
				'a:solidFill': { 'a:srgbClr': { '@_val': accent === 'accent2' ? '123456' : '654321' } },
			},
		},
	};
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function parseChartXml(bytes: ArrayBuffer | Uint8Array): Promise<XmlObject> {
	const zip = await JSZip.loadAsync(bytes);
	return xmlParser.parse(await zip.file(CHART_PATH)!.async('string')) as XmlObject;
}

async function buildDeckWithTwoRunAxisTitles(): Promise<ArrayBuffer> {
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
	const document = xmlParser.parse(await zip.file(CHART_PATH)!.async('string')) as XmlObject;
	setTwoRunTitle(axisNode(document, 'catAx'), 'Category-', 'control', 'accent3');
	setTwoRunTitle(axisNode(document, 'valAx'), 'Revenue-', 'by-quarter', 'accent2');
	zip.file(CHART_PATH, xmlBuilder.build(document));
	return exactArrayBuffer(await zip.generateAsync({ type: 'uint8array' }));
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

	it('keeps unchanged two-run axis title XML stable through repeated dirty saves', async () => {
		const seed = await buildDeckWithTwoRunAxisTitles();
		const originalXml = await parseChartXml(seed);
		const originalCategoryTitle = titleNode(originalXml, 'catAx');
		const originalValueTitle = titleNode(originalXml, 'valAx');
		const handler = new PptxHandler();
		const loaded = await handler.load(seed);
		const chart = chartFrom(loaded.slides);
		expect(chart.chartData?.axes?.find((axis) => axis.axisType === 'catAx')?.titleText).toBe(
			'Category-control',
		);
		expect(chart.chartData?.axes?.find((axis) => axis.axisType === 'valAx')?.titleText).toBe(
			'Revenue-by-quarter',
		);

		chart.x += 1;
		loaded.slides[0].isDirty = true;
		const firstSaved = await handler.save(loaded.slides);
		const firstXml = await parseChartXml(firstSaved);
		expect(titleNode(firstXml, 'catAx')).toStrictEqual(originalCategoryTitle);
		expect(titleNode(firstXml, 'valAx')).toStrictEqual(originalValueTitle);

		chart.x += 1;
		loaded.slides[0].isDirty = true;
		const secondSaved = await handler.save(loaded.slides);
		const secondXml = await parseChartXml(secondSaved);
		expect(titleNode(secondXml, 'catAx')).toStrictEqual(originalCategoryTitle);
		expect(titleNode(secondXml, 'valAx')).toStrictEqual(originalValueTitle);

		const reloadedHandler = new PptxHandler();
		const reloaded = await reloadedHandler.load(exactArrayBuffer(secondSaved));
		chartFrom(reloaded.slides).x += 1;
		reloaded.slides[0].isDirty = true;
		const reloadedXml = await parseChartXml(await reloadedHandler.save(reloaded.slides));
		expect(titleNode(reloadedXml, 'catAx')).toStrictEqual(originalCategoryTitle);
		expect(titleNode(reloadedXml, 'valAx')).toStrictEqual(originalValueTitle);
	});

	it.each(['Edited-value-axis', ' Edited value axis '])(
		'collapses a genuinely edited rich axis title to %j without changing the other axis or its styles',
		async (editedText) => {
			const seed = await buildDeckWithTwoRunAxisTitles();
			const originalXml = await parseChartXml(seed);
			const originalCategoryTitle = titleNode(originalXml, 'catAx');
			const originalValueTitle = titleNode(originalXml, 'valAx');
			const originalValueParagraph = titleParagraph(originalValueTitle);
			const originalFirstRun = asArray(originalValueParagraph['a:r'] as XmlObject | XmlObject[])[0];
			const handler = new PptxHandler();
			const loaded = await handler.load(seed);
			const valueAxis = chartFrom(loaded.slides).chartData?.axes?.find(
				(axis) => axis.axisType === 'valAx',
			);
			expect(valueAxis?.titleText).toBe('Revenue-by-quarter');
			valueAxis!.titleText = editedText;
			loaded.slides[0].isDirty = true;

			const firstSaved = await handler.save(loaded.slides);
			const firstXml = await parseChartXml(firstSaved);
			const editedTitle = titleNode(firstXml, 'valAx');
			const editedParagraph = titleParagraph(editedTitle);
			const editedRuns = asArray(editedParagraph['a:r'] as XmlObject | XmlObject[]);
			expect(titleNode(firstXml, 'catAx')).toStrictEqual(originalCategoryTitle);
			expect(titleTextValues(editedTitle)).toStrictEqual([editedText]);
			expect(editedRuns).toHaveLength(1);
			expect(editedRuns[0]['a:rPr']).toStrictEqual(originalFirstRun['a:rPr']);
			expect(editedParagraph['a:pPr']).toStrictEqual(originalValueParagraph['a:pPr']);
			expect(editedParagraph['a:endParaRPr']).toStrictEqual(originalValueParagraph['a:endParaRPr']);
			expect(editedTitle['c:layout']).toStrictEqual(originalValueTitle['c:layout']);
			expect(editedTitle['c:overlay']).toStrictEqual(originalValueTitle['c:overlay']);
			expect(editedTitle['c:spPr']).toStrictEqual(originalValueTitle['c:spPr']);

			chartFrom(loaded.slides).x += 1;
			loaded.slides[0].isDirty = true;
			const secondSaved = await handler.save(loaded.slides);
			const secondXml = await parseChartXml(secondSaved);
			expect(titleNode(secondXml, 'catAx')).toStrictEqual(originalCategoryTitle);
			expect(titleNode(secondXml, 'valAx')).toStrictEqual(editedTitle);

			const reloadedHandler = new PptxHandler();
			const reloaded = await reloadedHandler.load(exactArrayBuffer(secondSaved));
			const reloadedChart = chartFrom(reloaded.slides);
			expect(
				reloadedChart.chartData?.axes?.find((axis) => axis.axisType === 'valAx')?.titleText,
			).toBe(editedText);
			reloadedChart.x += 1;
			reloaded.slides[0].isDirty = true;
			const reloadedXml = await parseChartXml(await reloadedHandler.save(reloaded.slides));
			expect(titleNode(reloadedXml, 'catAx')).toStrictEqual(originalCategoryTitle);
			expect(titleNode(reloadedXml, 'valAx')).toStrictEqual(editedTitle);
		},
	);

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
