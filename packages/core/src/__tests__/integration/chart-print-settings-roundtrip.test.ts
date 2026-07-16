import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types';

const CHART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:vendor="urn:vendor">
 <c:chart><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/>
  <c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Sales</c:v></c:tx>
   <c:cat><c:strLit><c:ptCount val="1"/><c:pt idx="0"><c:v>Q1</c:v></c:pt></c:strLit></c:cat>
   <c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="1"/><c:pt idx="0"><c:v>10</c:v></c:pt></c:numLit></c:val>
  </c:ser></c:barChart></c:plotArea><c:plotVisOnly val="1"/></c:chart>
 <c:printSettings vendor:mode="keep">
  <c:headerFooter alignWithMargins="1"><c:oddHeader>&amp;LSales</c:oddHeader></c:headerFooter>
  <c:pageMargins l="0.7" r="0.7" t="0.75" b="0.75" header="0.3" footer="0.3" vendor:unit="in"/>
  <c:pageSetup paperSize="1" orientation="portrait" horizontalDpi="600" verticalDpi="600" copies="1" vendor:printer="keep"/>
  <c:legacyDrawingHF r:id="rIdLegacy"/><vendor:printExtension value="keep"/>
 </c:printSettings>
</c:chartSpace>`;

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
 <p:cSld><p:spTree>
  <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
  <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  <p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
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

describe('chartML print settings integration', () => {
	it('loads, edits, saves, and reloads print settings without losing extensions', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck());
		const chart = chartElement(data);
		const settings = chart.chartData!.printSettings!;
		expect(settings.headerFooter).toMatchObject({ oddHeader: '&LSales', alignWithMargins: true });
		expect(settings.pageMargins).toMatchObject({ left: 0.7, footer: 0.3 });
		expect(settings.pageSetup).toMatchObject({ orientation: 'portrait', copies: 1 });
		expect(settings.legacyDrawingHeaderFooterRelationshipId).toBe('rIdLegacy');

		settings.headerFooter!.firstFooter = '&CConfidential';
		settings.pageMargins!.left = 1.25;
		settings.pageSetup!.orientation = 'landscape';
		settings.pageSetup!.copies = 3;
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const savedXml = await (
			await JSZip.loadAsync(saved)
		)
			.file('ppt/charts/chart1.xml')!
			.async('string');
		expect(savedXml).toContain('vendor:mode="keep"');
		expect(savedXml).toContain('vendor:unit="in"');
		expect(savedXml).toContain('vendor:printer="keep"');
		expect(savedXml).toContain('<vendor:printExtension value="keep"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const roundTrip = chartElement(reloaded).chartData!.printSettings!;
		expect(roundTrip.headerFooter).toMatchObject({ firstFooter: '&CConfidential' });
		expect(roundTrip.pageMargins).toMatchObject({ left: 1.25 });
		expect(roundTrip.pageSetup).toMatchObject({ orientation: 'landscape', copies: 3 });
	});
});
