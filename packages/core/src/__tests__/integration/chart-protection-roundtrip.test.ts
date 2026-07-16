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
