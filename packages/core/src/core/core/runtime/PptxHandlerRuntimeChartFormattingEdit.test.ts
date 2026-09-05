import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../PptxHandler';
import type { ChartPptxElement } from '../../types/elements';

/**
 * Load -> edit -> save -> re-parse regressions for the chart formatting
 * constructs W3-D1 moved from "typed but partially/never serialized" to
 * native: per-point `c:dPt/c:spPr`, series `c:marker/c:spPr` (stroke
 * width/dash, not just fill), `c:errBars`/`c:trendline` line width and dash
 * style, per-label `c:dLbl/c:spPr` and `c:dLbl/c:txPr`, and the chart-level
 * `c:dropLines`/`c:hiLowLines` helper lines (previously parsed but silently
 * dropped on save).
 */

const LINE_CHART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
	xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
	<c:chart>
		<c:plotArea>
			<c:layout/>
			<c:lineChart>
				<c:grouping val="standard"/>
				<c:varyColors val="0"/>
				<c:ser>
					<c:idx val="0"/>
					<c:order val="0"/>
					<c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Line</c:v></c:pt></c:strCache></c:strRef></c:tx>
					<c:marker><c:symbol val="circle"/></c:marker>
					<c:dPt><c:idx val="0"/></c:dPt>
					<c:dLbls>
						<c:dLbl><c:idx val="0"/><c:showVal val="1"/></c:dLbl>
					</c:dLbls>
					<c:trendline><c:trendlineType val="linear"/></c:trendline>
					<c:errBars><c:errDir val="y"/><c:errBarType val="both"/><c:errValType val="fixedVal"/><c:val val="1"/></c:errBars>
					<c:cat><c:strRef><c:strCache><c:ptCount val="2"/><c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt></c:strCache></c:strRef></c:cat>
					<c:val><c:numRef><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="2"/><c:pt idx="0"><c:v>10</c:v></c:pt><c:pt idx="1"><c:v>20</c:v></c:pt></c:numCache></c:numRef></c:val>
				</c:ser>
				<c:marker val="1"/>
				<c:axId val="111111111"/>
				<c:axId val="222222222"/>
			</c:lineChart>
			<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx>
			<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111111111"/></c:valAx>
		</c:plotArea>
		<c:plotVisOnly val="1"/>
	</c:chart>
</c:chartSpace>`;

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
	xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
	<p:cSld>
		<p:spTree>
			<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
			<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
			<p:graphicFrame>
				<p:nvGraphicFramePr><p:cNvPr id="2" name="Line Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
				<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="4572000" cy="3200400"/></p:xfrm>
				<a:graphic>
					<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
						<c:chart r:id="rIdChart"/>
					</a:graphicData>
				</a:graphic>
			</p:graphicFrame>
		</p:spTree>
	</p:cSld>
</p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
	<Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;

async function buildLineDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const baseBytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(baseBytes);
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', LINE_CHART_XML);
	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer as ArrayBuffer;
}

describe('chart formatting edit -> save -> re-parse (W3-D1)', () => {
	it('round-trips dPt/marker spPr, trendline/errBars width+dash, dLbl spPr+txPr, dropLines/hiLowLines', async () => {
		const handler = new PptxHandler();
		const buffer = await buildLineDeck();
		const data = await handler.load(buffer);
		const chart = data.slides[0].elements.find((e) => e.type === 'chart') as
			| ChartPptxElement
			| undefined;
		expect(chart?.chartData).toBeDefined();
		const chartData = chart!.chartData!;
		const series = chartData.series[0];

		// --- Edit every construct under test ---
		series.dataPoints = [
			{ idx: 0, spPr: { strokeColor: '#123456', strokeWidth: 2, strokeDashStyle: 'sysDot' } },
		];
		series.marker = {
			symbol: 'square',
			spPr: { strokeColor: '#654321', strokeWidth: 1.5, strokeDashStyle: 'lgDash' },
		};
		series.trendlines = [
			{ trendlineType: 'linear', color: '#00FF00', lineWidth: 2, lineDashStyle: 'dash' },
		];
		series.errBars = [
			{
				direction: 'y',
				barType: 'both',
				valType: 'fixedVal',
				val: 3,
				color: '#0000FF',
				width: 1.25,
				dashStyle: 'sysDash',
			},
		];
		series.dataLabels = [
			{
				idx: 0,
				showVal: true,
				spPr: { fillColor: '#EEEEEE' },
				txPr: { fontSize: 11, bold: true, color: '#111111' },
			},
		];
		chartData.dropLines = { color: '#AAAAAA', width: 0.75, dashStyle: 'dot' };
		chartData.hiLowLines = { color: '#BBBBBB', width: 1, dashStyle: 'solid' };
		chartData.clrMapOvr = { bg1: 'lt1', accent1: 'accent2' };
		data.slides[0].isDirty = true;

		// --- Save and re-parse via the full PptxHandler pipeline ---
		const savedBytes = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const xml = await savedZip.file('ppt/charts/chart1.xml')!.async('string');

		// Raw-XML assertions: the edits actually reached the saved chart part.
		expect(xml).toMatch(/<c:dPt>.*?<a:ln w="25400"[^>]*>.*?sysDot/su);
		expect(xml).toContain('123456');
		expect(xml).toMatch(/<c:marker>.*?654321.*?lgDash/su);
		expect(xml).toMatch(/<c:trendline>.*?00FF00.*?<a:prstDash val="dash"/su);
		expect(xml).toMatch(/<c:errBars>.*?0000FF.*?sysDash/su);
		expect(xml).toContain('EEEEEE');
		expect(xml).toMatch(/<a:defRPr sz="1100" b="1">.*?111111/su);
		expect(xml).toMatch(/<c:dropLines>.*?AAAAAA.*?dot/su);
		expect(xml).toMatch(/<c:hiLowLines>.*?BBBBBB.*?solid/su);
		expect(xml).toMatch(/<c:clrMapOvr[^>]*bg1="lt1"[^>]*accent1="accent2"/su);

		// Re-parse through PptxHandler and assert the typed model round-trips.
		const reloaded = await new PptxHandler().load(savedBytes.buffer as ArrayBuffer);
		const reloadedChart = reloaded.slides[0].elements.find((e) => e.type === 'chart') as
			| ChartPptxElement
			| undefined;
		const reloadedSeries = reloadedChart!.chartData!.series[0];
		expect(reloadedSeries.dataPoints?.[0].spPr).toMatchObject({
			strokeColor: '#123456',
			strokeWidth: 2,
			strokeDashStyle: 'sysDot',
		});
		expect(reloadedSeries.marker?.spPr).toMatchObject({
			strokeColor: '#654321',
			strokeWidth: 1.5,
			strokeDashStyle: 'lgDash',
		});
		expect(reloadedSeries.trendlines?.[0]).toMatchObject({
			color: '#00FF00',
			lineWidth: 2,
			lineDashStyle: 'dash',
		});
		expect(reloadedSeries.errBars?.[0]).toMatchObject({
			color: '#0000FF',
			width: 1.25,
			dashStyle: 'sysDash',
		});
		expect(reloadedSeries.dataLabels?.[0].spPr).toMatchObject({ fillColor: '#EEEEEE' });
		expect(reloadedSeries.dataLabels?.[0].txPr).toMatchObject({
			fontSize: 11,
			bold: true,
			color: '#111111',
		});
		expect(reloadedChart!.chartData!.dropLines).toMatchObject({
			color: '#AAAAAA',
			width: 0.75,
			dashStyle: 'dot',
		});
		expect(reloadedChart!.chartData!.hiLowLines).toMatchObject({
			color: '#BBBBBB',
			width: 1,
			dashStyle: 'solid',
		});
		expect(reloadedChart!.chartData!.clrMapOvr).toMatchObject({
			bg1: 'lt1',
			accent1: 'accent2',
		});
	});
});
