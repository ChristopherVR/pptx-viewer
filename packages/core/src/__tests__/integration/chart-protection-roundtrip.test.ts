import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types';

const CHART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:vendor">
 <c:protection v:mode="keep"><c:chartObject/><c:data val="false" v:leaf="keep"/><c:formatting val="1"/><c:selection val="0"/><v:future value="keep"/></c:protection>
 <c:chart><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Sales</c:v></c:tx><c:cat><c:strLit><c:ptCount val="1"/><c:pt idx="0"><c:v>Q1</c:v></c:pt></c:strLit></c:cat><c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="1"/><c:pt idx="0"><c:v>10</c:v></c:pt></c:numLit></c:val></c:ser></c:barChart></c:plotArea><c:plotVisOnly val="1"/></c:chart>
</c:chartSpace>`;

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="914400" y="914400"/><a:ext cx="4572000" cy="3200400"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rIdChart"/></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`;

async function buildDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', CHART_XML);
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

function chartElement(data: { slides: { elements: { type: string }[] }[] }): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

describe('classic ChartML protection integration', () => {
	it('loads, edits, saves, and reloads protection without losing foreign markup', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck());
		const protection = chartElement(data).chartData!.protection!;
		expect(protection).toMatchObject({
			chartObject: true,
			data: false,
			formatting: true,
			selection: false,
		});

		protection.data = true;
		protection.formatting = null;
		protection.userInterface = false;
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const savedXml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(savedXml).toContain('v:mode="keep"');
		expect(savedXml).toContain('v:leaf="keep"');
		expect(savedXml).toContain('<v:future value="keep"');
		expect(savedXml).not.toContain('<c:formatting');
		expect(savedXml.indexOf('<c:protection')).toBeLessThan(savedXml.indexOf('<c:chart>'));

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(chartElement(reloaded).chartData!.protection).toMatchObject({
			chartObject: true,
			data: true,
			selection: false,
			userInterface: false,
		});
		expect(chartElement(reloaded).chartData!.protection!.formatting).toBeUndefined();
	});
});

describe('classic ChartML pivot formats integration', () => {
	it('loads, edits, saves, and reloads pivot formats without losing extensions', async () => {
		const sourceZip = await JSZip.loadAsync(await buildDeck());
		const chartPart = sourceZip.file('ppt/charts/chart1.xml')!;
		const pivotXml = `<c:pivotFmts><c:pivotFmt><c:idx val="2"/><c:marker><c:symbol val="circle"/></c:marker><c:extLst><c:ext uri="urn:pivot"><v:data value="keep"/></c:ext></c:extLst></c:pivotFmt></c:pivotFmts>`;
		sourceZip.file(
			'ppt/charts/chart1.xml',
			(await chartPart.async('string')).replace('<c:chart>', `<c:chart>${pivotXml}`),
		);
		const source = await sourceZip.generateAsync({ type: 'uint8array' });
		const handler = new PptxHandler();
		const data = await handler.load(source.buffer as ArrayBuffer);
		const formats = chartElement(data).chartData!.pivotFormats!;
		expect(formats.formats[0]).toMatchObject({ index: 2 });
		formats.formats[0].index = 5;
		formats.formats[0].markerXml = { 'c:symbol': { '@_val': 'diamond' } };
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/charts/chart1.xml')!.async('string');
		expect(savedXml).toContain('uri="urn:pivot"');
		expect(savedXml).toContain('<v:data value="keep"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const roundTrip = chartElement(reloaded).chartData!.pivotFormats!;
		expect(roundTrip.formats[0]).toMatchObject({ index: 5 });
		expect(roundTrip.formats[0].markerXml).toStrictEqual({
			'c:symbol': { '@_val': 'diamond' },
		});
	});
});

describe('chart color style and axis position integration', () => {
	it('loads, edits, saves, and reloads palette method and axis position', async () => {
		const sourceZip = await JSZip.loadAsync(await buildDeck());
		const chartFile = sourceZip.file('ppt/charts/chart1.xml')!;
		let chartXml = await chartFile.async('string');
		chartXml = chartXml.replace(
			'</c:barChart>',
			'<c:axId val="10"/><c:axId val="20"/></c:barChart><c:catAx><c:axId val="10"/><c:scaling/><c:axPos val="b"/><c:crossAx val="20"/></c:catAx><c:valAx><c:axId val="20"/><c:scaling/><c:axPos val="l"/><c:crossAx val="10"/></c:valAx>',
		);
		sourceZip.file('ppt/charts/chart1.xml', chartXml);
		sourceZip.file(
			'ppt/charts/_rels/chart1.xml.rels',
			`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2011/relationships/chartColorStyle" Target="colors1.xml"/></Relationships>`,
		);
		sourceZip.file(
			'ppt/charts/colors1.xml',
			`<cs:colorStyle xmlns:cs="http://schemas.microsoft.com/office/drawing/2012/chartStyle" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:v="urn:vendor" meth="cycle" id="10"><a:srgbClr val="4472C4"/><a:srgbClr val="ED7D31"/><cs:extLst><a:ext uri="urn:test"><v:data value="keep"/></a:ext></cs:extLst></cs:colorStyle>`,
		);
		const source = await sourceZip.generateAsync({ type: 'uint8array' });
		const handler = new PptxHandler();
		const data = await handler.load(source.buffer as ArrayBuffer);
		const chart = chartElement(data).chartData!;
		expect(chart.colorPalette).toStrictEqual(['#4472C4', '#ED7D31']);
		chart.colorPalette = ['#112233', '#AABBCC'];
		chart.colorMethod = 'acrossLinear';
		chart.axes!.find((axis) => axis.axisId === 20)!.axPos = 'r';
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const colorXml = await savedZip.file('ppt/charts/colors1.xml')!.async('string');
		expect(colorXml).toContain('meth="acrossLinear"');
		expect(colorXml).toContain('val="112233"');
		expect(colorXml).toContain('<v:data value="keep"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const roundTrip = chartElement(reloaded).chartData!;
		expect(roundTrip.colorPalette).toStrictEqual(['#112233', '#AABBCC']);
		expect(roundTrip.colorMethod).toBe('acrossLinear');
		expect(roundTrip.axes!.find((axis) => axis.axisId === 20)!.axPos).toBe('r');
	});
});
