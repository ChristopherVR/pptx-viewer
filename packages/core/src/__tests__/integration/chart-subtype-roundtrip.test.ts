/**
 * @fileoverview Load -> edit -> save -> reload integration coverage for the
 * three previously-passthrough OOXML chart subtype flags: bar3D column/bar
 * shape (chart-level `c:shape` plus a per-series override), radar chart
 * style (`c:radarStyle`), and surface wireframe (`c:wireframe`).
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="914400" y="914400"/><a:ext cx="4572000" cy="3200400"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rIdChart"/></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`;

async function buildDeck(chartXml: string): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', chartXml);
	return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
}

function chartElement(data: { slides: { elements: { type: string }[] }[] }): ChartPptxElement {
	const element = data.slides[0].elements.find((candidate) => candidate.type === 'chart');
	expect(element).toBeDefined();
	return element as ChartPptxElement;
}

function series(name: string, value: string, extra = ''): string {
	return `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${name}</c:v></c:tx><c:cat><c:strLit><c:ptCount val="1"/><c:pt idx="0"><c:v>Q1</c:v></c:pt></c:strLit></c:cat><c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="1"/><c:pt idx="0"><c:v>${value}</c:v></c:pt></c:numLit></c:val>${extra}</c:ser>`;
}

function chartSpace(chart: string): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:chart>${chart}<c:plotVisOnly val="1"/></c:chart>
</c:chartSpace>`;
}

describe('bar3D shape integration', () => {
	it('parses chart-level and per-series c:shape, edits both, and round-trips', async () => {
		const chartXml = chartSpace(
			`<c:plotArea><c:layout/><c:bar3DChart><c:barDir val="col"/><c:grouping val="clustered"/>${series(
				'Sales',
				'10',
				'<c:shape val="cone"/>',
			)}<c:shape val="cylinder"/><c:axId val="10"/><c:axId val="20"/><c:axId val="30"/></c:bar3DChart></c:plotArea>`,
		);
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck(chartXml));
		const chart = chartElement(data).chartData!;
		expect(chart.barShape).toBe('cylinder');
		expect(chart.series[0].shape).toBe('cone');

		chart.barShape = 'pyramidToMax';
		chart.series[0].shape = 'box';
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const savedXml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(savedXml).toContain('<c:shape val="pyramidToMax">');
		expect(savedXml).toContain('<c:shape val="box">');
		// Chart-level c:shape must stay between c:gapWidth/c:gapDepth and c:axId.
		expect(savedXml.indexOf('<c:shape val="pyramidToMax">')).toBeLessThan(
			savedXml.indexOf('<c:axId'),
		);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const roundTrip = chartElement(reloaded).chartData!;
		expect(roundTrip.barShape).toBe('pyramidToMax');
		expect(roundTrip.series[0].shape).toBe('box');
	});

	it('parses c:gapDepth, edits it, and round-trips it through the typed field', async () => {
		const chartXml = chartSpace(
			`<c:plotArea><c:layout/><c:bar3DChart><c:barDir val="col"/><c:grouping val="clustered"/>${series(
				'Sales',
				'10',
			)}<c:gapWidth val="150"/><c:gapDepth val="120"/><c:shape val="box"/><c:axId val="10"/><c:axId val="20"/><c:axId val="30"/></c:bar3DChart></c:plotArea>`,
		);
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck(chartXml));
		const chart = chartElement(data).chartData!;
		expect(chart.gapDepth).toBe(120);

		chart.gapDepth = 45;
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const savedXml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(savedXml).toContain('<c:gapDepth val="45"');
		expect(savedXml).not.toContain('<c:gapDepth val="120"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(chartElement(reloaded).chartData!.gapDepth).toBe(45);
	});

	it('leaves barShape/series shape undefined for a plain (2D) bar chart', async () => {
		const chartXml = chartSpace(
			`<c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/>${series(
				'Sales',
				'10',
			)}</c:barChart></c:plotArea>`,
		);
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck(chartXml));
		const chart = chartElement(data).chartData!;
		expect(chart.barShape).toBeUndefined();
		expect(chart.series[0].shape).toBeUndefined();
	});
});

describe('radar style integration', () => {
	it('parses c:radarStyle, edits it, and round-trips', async () => {
		const chartXml = chartSpace(
			`<c:plotArea><c:layout/><c:radarChart><c:radarStyle val="filled"/>${series(
				'Sales',
				'10',
			)}<c:axId val="10"/><c:axId val="20"/></c:radarChart></c:plotArea>`,
		);
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck(chartXml));
		const chart = chartElement(data).chartData!;
		expect(chart.radarStyle).toBe('filled');

		chart.radarStyle = 'standard';
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const savedXml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(savedXml).toContain('<c:radarStyle val="standard">');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(chartElement(reloaded).chartData!.radarStyle).toBe('standard');
	});
});

describe('surface wireframe integration', () => {
	it('parses an explicit c:wireframe, edits it, and round-trips', async () => {
		const chartXml = chartSpace(
			`<c:plotArea><c:layout/><c:surfaceChart><c:wireframe val="0"/>${series(
				'Sales',
				'10',
			)}<c:axId val="10"/><c:axId val="20"/><c:axId val="30"/></c:surfaceChart></c:plotArea>`,
		);
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck(chartXml));
		const chart = chartElement(data).chartData!;
		expect(chart.wireframe).toBeDefined();
		expect(chart.wireframe).toBeFalsy();

		chart.wireframe = true;
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const savedXml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(savedXml).toContain('<c:wireframe val="1">');
		// c:wireframe must stay the first child of the surface container.
		expect(savedXml.indexOf('<c:wireframe')).toBeLessThan(savedXml.indexOf('<c:ser>'));

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(chartElement(reloaded).chartData!.wireframe).toBeTruthy();
	});

	it('leaves wireframe undefined when c:wireframe is absent from the source', async () => {
		const chartXml = chartSpace(
			`<c:plotArea><c:layout/><c:surfaceChart>${series(
				'Sales',
				'10',
			)}<c:axId val="10"/><c:axId val="20"/><c:axId val="30"/></c:surfaceChart></c:plotArea>`,
		);
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeck(chartXml));
		expect(chartElement(data).chartData!.wireframe).toBeUndefined();
	});
});
