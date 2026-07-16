import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

/**
 * Integration: a combo chart whose series span multiple chart-type containers
 * (`c:barChart` + `c:lineChart`) must load ALL its series (each tagged with its
 * source chart type) and round-trip back to the same per-container shape.
 *
 * Regression guard for the documented limitation: "an existing combo chart
 * whose series span multiple chart-type containers is re-serialised from the
 * first container only (multi-container combo parsing on load is not yet
 * implemented)".
 */

/** A chart part with a bar series + a line series under one plotArea. */
const COMBO_CHART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
	xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
	<c:chart>
		<c:plotArea>
			<c:layout/>
			<c:barChart>
				<c:barDir val="col"/>
				<c:grouping val="clustered"/>
				<c:ser>
					<c:idx val="0"/>
					<c:order val="0"/>
					<c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Bars</c:v></c:pt></c:strCache></c:strRef></c:tx>
					<c:cat><c:strRef><c:strCache><c:ptCount val="2"/><c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt></c:strCache></c:strRef></c:cat>
					<c:val><c:numRef><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="2"/><c:pt idx="0"><c:v>10</c:v></c:pt><c:pt idx="1"><c:v>20</c:v></c:pt></c:numCache></c:numRef></c:val>
				</c:ser>
				<c:axId val="111111111"/>
				<c:axId val="222222222"/>
			</c:barChart>
			<c:lineChart>
				<c:grouping val="standard"/>
				<c:ser>
					<c:idx val="1"/>
					<c:order val="1"/>
					<c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Line</c:v></c:pt></c:strCache></c:strRef></c:tx>
					<c:cat><c:strRef><c:strCache><c:ptCount val="2"/><c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt></c:strCache></c:strRef></c:cat>
					<c:val><c:numRef><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="2"/><c:pt idx="0"><c:v>5</c:v></c:pt><c:pt idx="1"><c:v>15</c:v></c:pt></c:numCache></c:numRef></c:val>
				</c:ser>
				<c:axId val="333333333"/>
				<c:axId val="444444444"/>
			</c:lineChart>
			<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx>
			<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111111111"/></c:valAx>
			<c:catAx><c:axId val="333333333"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="t"/><c:crossAx val="444444444"/></c:catAx>
			<c:valAx><c:axId val="444444444"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="r"/><c:crossAx val="333333333"/></c:valAx>
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
				<p:nvGraphicFramePr><p:cNvPr id="2" name="Combo Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
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

async function buildComboDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const baseBytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(baseBytes);
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', COMBO_CHART_XML);
	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer as ArrayBuffer;
}

function comboChart(data: { slides: { elements: { type: string }[] }[] }): ChartPptxElement {
	const el = data.slides[0].elements.find((e) => e.type === 'chart');
	expect(el, 'combo chart graphic frame was not parsed').toBeDefined();
	return el as ChartPptxElement;
}

describe('multi-container combo chart round-trip', () => {
	it('loads every series across containers, tagged with its source chart type', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildComboDeck());
		const chart = comboChart(data);

		expect(chart.chartData?.chartType).toBe('combo');
		expect(chart.chartData?.categories).toStrictEqual(['Q1', 'Q2']);

		const series = chart.chartData!.series;
		expect(series).toHaveLength(2);
		// First container (bar) series, then second container (line) series.
		expect(series[0].name).toBe('Bars');
		expect(series[0].seriesChartType).toBe('bar');
		expect(series[0].axisId).toBe(222222222);
		expect(series[0].values).toStrictEqual([10, 20]);
		expect(series[1].name).toBe('Line');
		expect(series[1].seriesChartType).toBe('line');
		expect(series[1].axisId).toBe(444444444);
		expect(series[1].values).toStrictEqual([5, 15]);
	});

	it('round-trips back to bar + line containers after a dirty save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildComboDeck());
		const chart = comboChart(data);
		// Edit a value so the chart serialiser writes the chart part.
		chart.chartData!.series[1].values = [7, 17];
		data.slides[0].isDirty = true;

		const savedBytes = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedChartXml = await savedZip.file('ppt/charts/chart1.xml')!.async('string');

		// Both chart-type containers survive the round-trip.
		expect(savedChartXml).toContain('<c:barChart');
		expect(savedChartXml).toContain('<c:lineChart');
		expect(savedChartXml).toMatch(
			/<c:lineChart[\s\S]*?<c:axId val="333333333"><\/c:axId><c:axId val="444444444"><\/c:axId>[\s\S]*?<\/c:lineChart>/u,
		);
		// The edited line value is written back.
		expect(savedChartXml).toContain('<c:v>17</c:v>');

		// Reload to confirm the model is still a 2-series combo.
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(savedBytes.buffer as ArrayBuffer);
		const chart2 = comboChart(data2);
		expect(chart2.chartData?.chartType).toBe('combo');
		expect(chart2.chartData!.series.map((s) => s.seriesChartType)).toStrictEqual(['bar', 'line']);
		expect(chart2.chartData!.series.map((s) => s.axisId)).toStrictEqual([222222222, 444444444]);
		expect(chart2.chartData!.series[1].values).toStrictEqual([7, 17]);
	});

	it('round-trips typed trendlines and error bars after a dirty save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildComboDeck());
		const chart = comboChart(data);
		chart.chartData!.series[1].trendlines = [
			{
				trendlineType: 'polynomial',
				order: 3,
				displayEq: false,
				label: { numberFormatCode: '0.00', sourceLinked: false },
			},
		];
		chart.chartData!.series[1].errBars = [
			{
				direction: 'y',
				barType: 'both',
				valType: 'percentage',
				val: 5,
				noEndCap: false,
				color: '#123456',
			},
		];
		data.slides[0].isDirty = true;

		const savedBytes = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(savedBytes.buffer as ArrayBuffer);
		const series = comboChart(reloaded).chartData!.series[1];
		expect(series.trendlines).toStrictEqual(chart.chartData!.series[1].trendlines);
		expect(series.errBars).toStrictEqual(chart.chartData!.series[1].errBars);
	});

	it('round-trips a per-data-point label override on a combo series', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildComboDeck());
		const chart = comboChart(data);
		// Add a per-point label override on the line series, point index 1.
		chart.chartData!.series[1].dataLabels = [
			{
				idx: 1,
				showVal: true,
				position: 'outEnd',
				separator: '/',
				showLeaderLines: true,
			},
		];
		data.slides[0].isDirty = true;

		const savedBytes = await handler.save(data.slides);

		const handler2 = new PptxHandler();
		const data2 = await handler2.load(savedBytes.buffer as ArrayBuffer);
		const chart2 = comboChart(data2);
		const lineSeries = chart2.chartData!.series.find((s) => s.name === 'Line');
		expect(lineSeries?.dataLabels).toBeDefined();
		const override = lineSeries!.dataLabels!.find((l) => l.idx === 1);
		expect(override).toBeDefined();
		expect(override!.showVal).toBeTruthy();
		expect(override!.position).toBe('outEnd');
		expect(override!.separator).toBe('/');
		expect(override!.showLeaderLines).toBeTruthy();
	});
});
