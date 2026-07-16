import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

const CHART_EX_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cx:chartSpace xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
 <cx:chartData>
  <cx:data id="7">
   <cx:strDim type="cat"><cx:lvl ptCount="3"><cx:pt idx="0">Lead</cx:pt><cx:pt idx="1">Qualified</cx:pt><cx:pt idx="2">Won</cx:pt></cx:lvl></cx:strDim>
   <cx:numDim type="val"><cx:lvl ptCount="3"><cx:pt idx="0">120</cx:pt><cx:pt idx="1">75</cx:pt><cx:pt idx="2">30</cx:pt></cx:lvl></cx:numDim>
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

async function buildChartExDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', CHART_EX_XML);
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

function chartElement(data: { slides: { elements: { type: string }[] }[] }): ChartPptxElement {
	const element = data.slides[0].elements.find((item) => item.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

describe('chartEx package round-trip', () => {
	it('loads referenced chartData dimensions from a cx chart part', async () => {
		const data = await new PptxHandler().load(await buildChartExDeck());
		const chart = chartElement(data).chartData!;

		expect(chart.chartType).toBe('funnel');
		expect(chart.title).toBe('Sales Funnel');
		expect(chart.categories).toStrictEqual(['Lead', 'Qualified', 'Won']);
		expect(chart.series[0]).toMatchObject({
			name: 'Opportunities',
			values: [120, 75, 30],
			color: '#4472C4',
		});
	});

	it('preserves the loaded cx part and unknown extensions through a dirty save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildChartExDeck());
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const savedXml = await (
			await JSZip.loadAsync(saved)
		)
			.file('ppt/charts/chart1.xml')!
			.async('string');

		expect(savedXml).toContain('<cx:chartSpace');
		expect(savedXml).toContain('uri="vendor-roundtrip"');
		expect(savedXml).toContain('<vendor:payload xmlns:vendor="urn:vendor">keep</vendor:payload>');
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(chartElement(reloaded).chartData?.series[0].values).toStrictEqual([120, 75, 30]);
	});
});
