/**
 * Save-side regression tests for chart EDITS (as opposed to untouched
 * round-trips): mutated data/title must reach the saved XML for both the
 * 2006 `c:chartSpace` and the 2016+ `cx:chartSpace` part families, and a
 * chart type change across families must regenerate the part instead of
 * patching mismatched markup into the old one.
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxChartData, PptxChartType } from '../../core/types/chart';
import type { ChartPptxElement } from '../../core/types/elements';
import type { PptxData } from '../../core/types/presentation';

const CHART_EX_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cx:chartSpace xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
 <cx:chartData>
  <cx:data id="7">
   <cx:strDim type="cat"><cx:lvl ptCount="3"><cx:pt idx="0">Lead</cx:pt><cx:pt idx="1">Qualified</cx:pt><cx:pt idx="2">Won</cx:pt></cx:lvl></cx:strDim>
   <cx:numDim type="val"><cx:lvl ptCount="3" formatCode="0.0"><cx:pt idx="0">120</cx:pt><cx:pt idx="1">75</cx:pt><cx:pt idx="2">30</cx:pt></cx:lvl></cx:numDim>
  </cx:data>
 </cx:chartData>
 <cx:chart>
  <cx:title><cx:tx><cx:rich><a:p><a:r><a:t>Sales Funnel</a:t></a:r></a:p></cx:rich></cx:tx></cx:title>
  <cx:plotArea><cx:plotAreaRegion>
   <cx:series layoutId="funnel" uniqueId="{00000001-0000-0000-0000-000000000000}">
    <cx:tx><cx:txData><cx:v>Opportunities</cx:v></cx:txData></cx:tx>
    <cx:spPr><a:solidFill><a:srgbClr val="4472C4"/></a:solidFill></cx:spPr>
    <cx:dataId val="7"/>
   </cx:series>
  </cx:plotAreaRegion></cx:plotArea>
  <cx:extLst><cx:ext uri="vendor-roundtrip"><vendor:payload xmlns:vendor="urn:vendor">keep</vendor:payload></cx:ext></cx:extLst>
 </cx:chart>
</cx:chartSpace>`;

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
 <p:cSld><p:spTree>
  <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
  <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  <p:graphicFrame>
   <p:nvGraphicFramePr><p:cNvPr id="2" name="Funnel Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
   <p:xfrm><a:off x="914400" y="914400"/><a:ext cx="4572000" cy="3200400"/></p:xfrm>
   <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rIdChart"/></a:graphicData></a:graphic>
  </p:graphicFrame>
 </p:spTree></p:cSld>
</p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
 <Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;

type SavedPackage = { zip: JSZip; bytes: Uint8Array };

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.slice().buffer as ArrayBuffer;
}

async function buildChartExDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', CHART_EX_XML);
	return toArrayBuffer(await zip.generateAsync({ type: 'uint8array' }));
}

async function buildSdkDeck(
	chartType: PptxChartType,
	chartData: Parameters<
		ReturnType<Awaited<ReturnType<typeof PresentationBuilder.create>>['createSlide']>['addChart']
	>[1],
): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank')
			.addChart(chartType, chartData, { x: 50, y: 50, width: 500, height: 300 })
			.build(),
	);
	return toArrayBuffer(await handler.save(data.slides));
}

function chartOf(data: PptxData): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

/** Load `deck`, let `edit` mutate the chart model, save dirty, return the package. */
async function editAndSave(
	deck: ArrayBuffer,
	edit: (chart: PptxChartData) => void,
): Promise<SavedPackage> {
	const handler = new PptxHandler();
	const data = await handler.load(deck);
	edit(chartOf(data).chartData!);
	data.slides[0].isDirty = true;
	const bytes = await handler.save(data.slides);
	return { zip: await JSZip.loadAsync(bytes), bytes };
}

async function reload(saved: SavedPackage): Promise<PptxChartData> {
	const data = await new PptxHandler().load(toArrayBuffer(saved.bytes));
	return chartOf(data).chartData!;
}

async function text(zip: JSZip, path: string): Promise<string> {
	const file = zip.file(path);
	if (!file) {
		throw new Error(`missing part ${path}`);
	}
	return file.async('string');
}

describe('chart edits reach the saved package', () => {
	it('writes mutated values, categories, names and title into a 2006 chart part', async () => {
		const deck = await buildSdkDeck('bar', {
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [10, 20] }],
			title: 'Before',
		});
		const saved = await editAndSave(deck, (chart) => {
			chart.categories = ['Jan', 'Feb'];
			chart.series[0].name = 'Bookings';
			chart.series[0].values = [33, 44];
			chart.title = 'After';
		});

		const xml = await text(saved.zip, 'ppt/charts/chart1.xml');
		expect(xml).toContain('<c:v>33</c:v>');
		expect(xml).toContain('<c:v>44</c:v>');
		expect(xml).toContain('<c:v>Feb</c:v>');
		expect(xml).toContain('<a:t>After</a:t>');
		expect(xml).not.toContain('<a:t>Before</a:t>');
		await expect(reload(saved)).resolves.toMatchObject({
			chartType: 'bar',
			title: 'After',
			categories: ['Jan', 'Feb'],
			series: [{ name: 'Bookings', values: [33, 44] }],
		});
	});

	it('inserts a c:title (before c:autoTitleDeleted val=0) on a chart that had none', async () => {
		const deck = await buildSdkDeck('bar', {
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [10, 20] }],
		});
		const before = await text(await JSZip.loadAsync(deck), 'ppt/charts/chart1.xml');
		expect(before).not.toContain('<c:title');
		expect(before).toContain('<c:autoTitleDeleted val="1">');

		const saved = await editAndSave(deck, (chart) => {
			chart.title = 'Added later';
		});
		const xml = await text(saved.zip, 'ppt/charts/chart1.xml');
		expect(xml).toContain('<a:t>Added later</a:t>');
		expect(xml).toContain('<c:autoTitleDeleted val="0">');
		expect(xml.indexOf('<c:title>')).toBeGreaterThan(-1);
		expect(xml.indexOf('<c:title>')).toBeLessThan(xml.indexOf('<c:autoTitleDeleted'));
		expect(xml.indexOf('<c:autoTitleDeleted')).toBeLessThan(xml.indexOf('<c:plotArea>'));
		expect((await reload(saved)).title).toBe('Added later');
	});

	it('removes the c:title and flags autoTitleDeleted when hasTitle is cleared', async () => {
		const deck = await buildSdkDeck('bar', {
			categories: ['Q1'],
			series: [{ name: 'Revenue', values: [10] }],
			title: 'Gone soon',
		});
		const saved = await editAndSave(deck, (chart) => {
			chart.title = '';
			chart.style = { ...chart.style, hasTitle: false };
		});
		const xml = await text(saved.zip, 'ppt/charts/chart1.xml');
		expect(xml).not.toContain('<c:title');
		expect(xml).toContain('<c:autoTitleDeleted val="1">');
		expect((await reload(saved)).title).toBeUndefined();
	});

	it('writes mutated data and title into an existing ChartEx part, keeping extensions', async () => {
		const saved = await editAndSave(await buildChartExDeck(), (chart) => {
			chart.categories = ['Lead', 'Qualified', 'Won', 'Closed'];
			chart.series[0].name = 'Deals';
			chart.series[0].values = [200, 90, 45, 12];
			chart.series[0].color = '#FF0000';
			chart.title = 'Pipeline';
		});

		const xml = await text(saved.zip, 'ppt/charts/chart1.xml');
		expect(xml).toContain('<cx:chartSpace');
		expect(xml).toContain('<cx:pt idx="3">Closed</cx:pt>');
		expect(xml).toContain('<cx:pt idx="0">200</cx:pt>');
		expect(xml).toContain('<cx:pt idx="3">12</cx:pt>');
		expect(xml).toContain('<cx:v>Deals</cx:v>');
		expect(xml).toContain('<a:t>Pipeline</a:t>');
		expect(xml).toContain('<a:srgbClr val="FF0000">');
		expect(xml).toContain('formatCode="0.0"');
		expect(xml).toContain('uniqueId="{00000001-0000-0000-0000-000000000000}"');
		expect(xml).toContain('uri="vendor-roundtrip"');
		await expect(reload(saved)).resolves.toMatchObject({
			chartType: 'funnel',
			title: 'Pipeline',
			categories: ['Lead', 'Qualified', 'Won', 'Closed'],
			series: [{ name: 'Deals', values: [200, 90, 45, 12], color: '#FF0000' }],
		});
	});

	it('adds and removes series on a ChartEx part', async () => {
		const added = await editAndSave(await buildChartExDeck(), (chart) => {
			chart.series.push({ name: 'Renewals', values: [50, 40, 20] });
		});
		const addedXml = await text(added.zip, 'ppt/charts/chart1.xml');
		expect(addedXml).toContain('<cx:v>Renewals</cx:v>');
		expect(addedXml).toContain('<cx:data id="8">');
		expect(addedXml).toContain('<cx:dataId val="8">');
		const addedModel = await reload(added);
		expect(addedModel.series.map((series) => series.name)).toStrictEqual([
			'Opportunities',
			'Renewals',
		]);
		expect(addedModel.series[1].values).toStrictEqual([50, 40, 20]);

		const removed = await editAndSave(toArrayBuffer(added.bytes), (chart) => {
			chart.series = chart.series.slice(0, 1);
		});
		const removedXml = await text(removed.zip, 'ppt/charts/chart1.xml');
		expect(removedXml).not.toContain('Renewals');
		expect(removedXml).not.toContain('<cx:data id="8">');
		expect((await reload(removed)).series).toHaveLength(1);
	});

	it('writes mutated data into a generated (SDK) ChartEx part', async () => {
		const deck = await buildSdkDeck('funnel', {
			categories: ['Lead', 'Qualified', 'Won'],
			series: [{ name: 'Opportunities', values: [120, 75, 30] }],
			title: 'Sales Funnel',
		});
		const saved = await editAndSave(deck, (chart) => {
			chart.series[0].values = [1, 2, 3];
			chart.title = 'Renamed';
		});
		const xml = await text(saved.zip, 'ppt/extendedCharts/chart1.xml');
		expect(xml).toContain('<cx:pt idx="2">3</cx:pt>');
		expect(xml).toContain('<a:t>Renamed</a:t>');
		await expect(reload(saved)).resolves.toMatchObject({
			title: 'Renamed',
			series: [{ values: [1, 2, 3] }],
		});
	});
});

describe('chart type changes across part families', () => {
	it('regenerates a 2006 bar chart as a ChartEx funnel part', async () => {
		const deck = await buildSdkDeck('bar', {
			categories: ['Lead', 'Qualified', 'Won'],
			series: [{ name: 'Opportunities', values: [120, 75, 30] }],
			title: 'Sales Funnel',
		});
		const saved = await editAndSave(deck, (chart) => {
			chart.chartType = 'funnel';
		});

		const chartXml = await text(saved.zip, 'ppt/extendedCharts/chart1.xml');
		const slideXml = await text(saved.zip, 'ppt/slides/slide1.xml');
		const rels = await text(saved.zip, 'ppt/slides/_rels/slide1.xml.rels');
		const contentTypes = await text(saved.zip, '[Content_Types].xml');
		expect(chartXml).toContain('<cx:series layoutId="funnel"');
		expect(chartXml).toContain('<cx:pt idx="1">75</cx:pt>');
		expect(slideXml).toContain('uri="http://schemas.microsoft.com/office/drawing/2014/chartex"');
		expect(slideXml).toContain('<cx:chart ');
		expect(slideXml).not.toContain('<c:chart ');
		expect(rels).toContain('office/2014/relationships/chartEx');
		expect(rels).toContain('Target="../extendedCharts/chart1.xml"');
		expect(contentTypes).toContain(
			'PartName="/ppt/extendedCharts/chart1.xml" ContentType="application/vnd.ms-office.chartex+xml"',
		);

		await expect(reload(saved)).resolves.toMatchObject({
			chartType: 'funnel',
			title: 'Sales Funnel',
			categories: ['Lead', 'Qualified', 'Won'],
			series: [{ name: 'Opportunities', values: [120, 75, 30] }],
			chartPartPath: 'ppt/extendedCharts/chart1.xml',
		});
	});

	it('regenerates a ChartEx funnel as a 2006 bar chart part', async () => {
		const saved = await editAndSave(await buildChartExDeck(), (chart) => {
			chart.chartType = 'bar';
			chart.series[0].values = [5, 6, 7];
		});

		const rels = await text(saved.zip, 'ppt/slides/_rels/slide1.xml.rels');
		const slideXml = await text(saved.zip, 'ppt/slides/slide1.xml');
		const contentTypes = await text(saved.zip, '[Content_Types].xml');
		expect(rels).toContain('Target="../charts/chart2.xml"');
		expect(rels).toContain('officeDocument/2006/relationships/chart"');
		expect(slideXml).toContain('uri="http://schemas.openxmlformats.org/drawingml/2006/chart"');
		expect(contentTypes).toContain('PartName="/ppt/charts/chart2.xml"');
		const chartXml = await text(saved.zip, 'ppt/charts/chart2.xml');
		expect(chartXml).toContain('<c:barChart>');
		expect(chartXml).toContain('<c:v>7</c:v>');
		expect(chartXml).toContain('<a:t>Sales Funnel</a:t>');

		await expect(reload(saved)).resolves.toMatchObject({
			chartType: 'bar',
			title: 'Sales Funnel',
			categories: ['Lead', 'Qualified', 'Won'],
			series: [{ name: 'Opportunities', values: [5, 6, 7] }],
			chartPartPath: 'ppt/charts/chart2.xml',
		});
	});

	it('regenerates a ChartEx part in place when the layout changes within the family', async () => {
		const saved = await editAndSave(await buildChartExDeck(), (chart) => {
			chart.chartType = 'waterfall';
		});
		const chartXml = await text(saved.zip, 'ppt/charts/chart1.xml');
		expect(chartXml).toContain('<cx:series layoutId="waterfall"');
		expect(chartXml).not.toContain('layoutId="funnel"');
		expect(chartXml).toContain('<cx:pt idx="0">120</cx:pt>');
		await expect(reload(saved)).resolves.toMatchObject({
			chartType: 'waterfall',
			series: [{ name: 'Opportunities', values: [120, 75, 30] }],
		});
	});
});
