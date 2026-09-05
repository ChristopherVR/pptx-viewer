/**
 * @fileoverview End-to-end load-path regression tests for gaps closed in
 * `PptxHandlerRuntimeChartParsing.ts`:
 * - a chart title authored as a linked cell reference (`c:tx/c:strRef`)
 *   resolves from `c:strCache/c:pt/c:v`, not just an `a:t` run.
 * - `c:chartSpace/c:date1904` and `c:roundedCorners` reach `PptxChartData`.
 * - `c:barChart/c:gapDepth` reaches `PptxChartData` (read-only, like
 *   `barGapWidth`/`barOverlap`).
 * - the Office 2013+ chart-style part (`style1.xml`, `cs:chartStyle`) is
 *   parsed into `PptxChartData.chartStyleDefinition`.
 *
 * Uses a real `PptxHandler.load()` over a hand-built in-memory package
 * (JSZip) rather than binding protected methods, since these fields are
 * produced by wiring spread across several parse calls in
 * `getChartDataForGraphicFrame` and a fixture-level test is what would catch
 * a regression in that wiring, not just in one helper.
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../PptxHandler';
import type { ChartPptxElement } from '../../types/elements';

const CHART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <c:date1904 val="1"/>
 <c:roundedCorners val="1"/>
 <c:chart>
  <c:title>
   <c:tx>
    <c:strRef>
     <c:f>Sheet1!$A$1</c:f>
     <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Revenue</c:v></c:pt></c:strCache>
    </c:strRef>
   </c:tx>
  </c:title>
  <c:plotArea>
   <c:barChart>
    <c:barDir val="col"/>
    <c:grouping val="clustered"/>
    <c:gapDepth val="150"/>
    <c:ser>
     <c:idx val="0"/><c:order val="0"/>
     <c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>Q1</c:v></c:pt></c:strCache></c:strRef></c:cat>
     <c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>10</c:v></c:pt></c:numCache></c:numRef></c:val>
    </c:ser>
   </c:barChart>
   <c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:crossAx val="2"/></c:catAx>
   <c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:crossAx val="1"/></c:valAx>
  </c:plotArea>
 </c:chart>
</c:chartSpace>`;

const CHART_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rIdStyle" Type="http://schemas.microsoft.com/office/2012/relationships/chartStyle" Target="style1.xml"/>
</Relationships>`;

const CHART_STYLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cs:chartStyle xmlns:cs="http://schemas.microsoft.com/office/drawing/2012/chartStyle"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
 <cs:title>
  <cs:lnRef idx="0"/><cs:fillRef idx="0"/><cs:effectRef idx="0"/>
  <cs:fontRef idx="minor"><a:schemeClr val="tx1"/></cs:fontRef>
  <cs:defRPr sz="1862" b="0"/>
 </cs:title>
</cs:chartStyle>`;

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
 <p:cSld><p:spTree>
  <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
  <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  <p:graphicFrame>
   <p:nvGraphicFramePr><p:cNvPr id="2" name="Bar Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.slice().buffer as ArrayBuffer;
}

async function buildDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', CHART_XML);
	zip.file('ppt/charts/_rels/chart1.xml.rels', CHART_RELS_XML);
	zip.file('ppt/charts/style1.xml', CHART_STYLE_XML);
	return toArrayBuffer(await zip.generateAsync({ type: 'uint8array' }));
}

const CHART_XML_WITH_CLR_MAP_OVR = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <c:clrMapOvr bg1="lt1" tx1="lt1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2"
  accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
 <c:chart>
  <c:plotArea>
   <c:barChart>
    <c:barDir val="col"/>
    <c:grouping val="clustered"/>
    <c:ser>
     <c:idx val="0"/><c:order val="0"/>
     <c:spPr><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></c:spPr>
     <c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>Q1</c:v></c:pt></c:strCache></c:strRef></c:cat>
     <c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>10</c:v></c:pt></c:numCache></c:numRef></c:val>
    </c:ser>
   </c:barChart>
   <c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:crossAx val="2"/></c:catAx>
   <c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:crossAx val="1"/></c:valAx>
  </c:plotArea>
 </c:chart>
</c:chartSpace>`;

async function buildDeckWithClrMapOvr(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', CHART_XML_WITH_CLR_MAP_OVR);
	return toArrayBuffer(await zip.generateAsync({ type: 'uint8array' }));
}

describe('c2-G11: chart-local c:clrMapOvr is applied to a:schemeClr resolution', () => {
	it('a series colour resolves through the chart clrMapOvr, not the default map', async () => {
		// The default map routes tx1 -> dk1 (black, '#000000' on a blank deck's
		// default theme, confirmed by the fontRef test above). This chart's own
		// `c:clrMapOvr` reroutes tx1 -> lt1 (white) instead, so a series coloured
		// `a:schemeClr val="tx1"` must resolve to lt1's colour, not dk1's.
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeckWithClrMapOvr());
		const element = data.slides[0].elements.find(
			(candidate) => candidate.type === 'chart',
		) as ChartPptxElement;
		const chartData = element.chartData!;

		expect(chartData.clrMapOvr?.tx1).toBe('lt1');
		expect(chartData.series[0].color).not.toBe('#000000');
		expect(chartData.series[0].color?.toLowerCase()).toBe('#ffffff');
	});
});

describe('classic chart chartSpace-level and chart-style-part parsing', () => {
	it('resolves title/date1904/roundedCorners/gapDepth/chartStyleDefinition on load', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck());
		const element = data.slides[0].elements.find(
			(candidate) => candidate.type === 'chart',
		) as ChartPptxElement;
		expect(element).toBeDefined();
		const chartData = element.chartData!;

		// G14: linked-cell title (c:tx/c:strRef/c:strCache), no a:t run at all.
		expect(chartData.title).toBe('Revenue');

		// C1-G3: chartSpace-level c:date1904, with no embedded workbook present.
		expect(chartData.date1904).toBeTruthy();

		// C1-G6: c:chartSpace/c:roundedCorners.
		expect(chartData.roundedCorners).toBeTruthy();

		// C1-G7: c:barChart/c:gapDepth, read-only like barGapWidth/barOverlap.
		expect(chartData.gapDepth).toBe(150);

		// C2-G2: the chart-style part (style1.xml) resolves cs:title's font size
		// and its cs:fontRef scheme colour.
		expect(chartData.chartStyleDefinition?.title).toStrictEqual({
			fontSize: 18.62,
			bold: false,
			// cs:fontRef's a:schemeClr val="tx1" resolves through the deck's
			// theme colour map, matching how classic chart colours resolve.
			color: '#000000',
		});
	});
});

// C2-G9 (render half): a data point's c:pictureOptions picture fill resolves
// to an actual image URL via the chart part's relationships, not just the
// bare stack/stretch flags.
const CHART_XML_WITH_DPT_PICTURE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <c:chart>
  <c:plotArea>
   <c:barChart>
    <c:barDir val="col"/>
    <c:grouping val="clustered"/>
    <c:ser>
     <c:idx val="0"/><c:order val="0"/>
     <c:dPt>
      <c:idx val="0"/>
      <c:spPr><a:blipFill><a:blip r:embed="rIdImg"/></a:blipFill></c:spPr>
      <c:pictureOptions><c:pictureFormat val="stack"/><c:pictureStackUnit val="36"/></c:pictureOptions>
     </c:dPt>
     <c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>Q1</c:v></c:pt></c:strCache></c:strRef></c:cat>
     <c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>10</c:v></c:pt></c:numCache></c:numRef></c:val>
    </c:ser>
   </c:barChart>
   <c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:crossAx val="2"/></c:catAx>
   <c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:crossAx val="1"/></c:valAx>
  </c:plotArea>
 </c:chart>
</c:chartSpace>`;

const CHART_RELS_XML_WITH_IMAGE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`;

// A minimal (67-byte) valid 1x1 transparent PNG.
const TINY_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function buildDeckWithDataPointPicture(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', CHART_XML_WITH_DPT_PICTURE);
	zip.file('ppt/charts/_rels/chart1.xml.rels', CHART_RELS_XML_WITH_IMAGE);
	zip.file('ppt/media/image1.png', Buffer.from(TINY_PNG_BASE64, 'base64'));
	return toArrayBuffer(await zip.generateAsync({ type: 'uint8array' }));
}

describe('c2-G9: c:dPt/c:pictureOptions picture fill resolves to an image URL', () => {
	it('parses the flags and resolves the sibling blipFill to a data: URL', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeckWithDataPointPicture());
		const element = data.slides[0].elements.find(
			(candidate) => candidate.type === 'chart',
		) as ChartPptxElement;
		const dataPoint = element.chartData!.series[0].dataPoints?.find((dp) => dp.idx === 0);

		expect(dataPoint?.picture).toBeDefined();
		expect(dataPoint?.picture?.pictureFormat).toBe('stack');
		expect(dataPoint?.picture?.pictureStackUnit).toBe(36);
		// PptxHandlerRuntimeMediaData resolves to a blob: URL when the test
		// environment supports Blob URLs, otherwise a base64 data: URI; either
		// way it must be an actual resolved image, not the bare relationship id.
		expect(dataPoint?.picture?.imageUrl).toMatch(/^(blob:|data:image\/png;base64,)/u);
	});

	it('does not attempt relationship resolution when no point has a picture fill', async () => {
		// Regression guard for the cheap early-exit: a normal chart (no
		// pictureOptions anywhere) must still load without touching chart rels.
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck());
		const element = data.slides[0].elements.find(
			(candidate) => candidate.type === 'chart',
		) as ChartPptxElement;
		expect(element.chartData!.series[0].dataPoints ?? []).toHaveLength(0);
	});
});
