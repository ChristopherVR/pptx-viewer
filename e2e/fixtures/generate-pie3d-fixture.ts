/**
 * Generates `pie3d.pptx`: a single slide holding one `pie3D` chart (four
 * slices, matching `chart-gallery.pptx`'s flat "Pie" slide's own Revenue/
 * Q1..Q4/45-62-58-71 data, so the two fixtures agree when a spec compares
 * behaviour across them).
 *
 * `pie3D` is not in `e2e/fixtures/chart-xml.ts`'s builders (they only ever
 * emit `c:pieChart`), and this generator owns no file outside `e2e/`, so the
 * `c:pie3DChart` XML is hand-authored here rather than extending that shared
 * helper. `packages/core/src/core/core/runtime/PptxHandlerRuntimeChartDetection.ts`
 * maps the `<c:pie3DChart>` element name to `chartType: 'pie3D'`; unlike
 * `c:pieChart`/`c:doughnutChart`, ECMA-376's `CT_Pie3DChart` content model has
 * no `c:firstSliceAng` (`chart-container-content-model.ts`'s `pie3DChart`
 * entry), so none is authored here either.
 *
 * Same base-deck-then-inject-a-chart-part technique as
 * `generate-bar3d-horizontal-fixture.ts`: the core save pipeline can only
 * UPDATE an existing chart part, not author one from scratch, so a valid deck
 * skeleton is built first and the chart part is spliced into the saved zip
 * afterwards.
 *
 * Run with: bun run e2e/fixtures/generate-pie3d-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type JSZipType from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

const __dirname = dirname(fileURLToPath(import.meta.url));

const C_NS =
	'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Mirrors `chart-gallery.pptx`'s own "Pie" slide (`CHART_SLIDES[3]` in `generate-chart-fixture.ts`). */
const CATEGORIES = ['Q1', 'Q2', 'Q3', 'Q4'];
const VALUES = [45, 62, 58, 71];
const SERIES_NAME = 'Revenue';

function strCache(values: readonly string[]): string {
	const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
	return `<c:strRef><c:f>Sheet1!$A$2:$A$${values.length + 1}</c:f><c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache></c:strRef>`;
}

function numCache(values: readonly number[]): string {
	const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
	return `<c:numRef><c:f>Sheet1!$B$2:$B$${values.length + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache></c:numRef>`;
}

/** The `pie3D` chart part: one series, no `c:firstSliceAng` (not in the CT_Pie3DChart content model). */
function pie3DChartXml(): string {
	const ser =
		`<c:ser><c:idx val="0"/><c:order val="0"/>` +
		`<c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache><c:ptCount val="1"/>` +
		`<c:pt idx="0"><c:v>${SERIES_NAME}</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
		`<c:cat>${strCache(CATEGORIES)}</c:cat><c:val>${numCache(VALUES)}</c:val></c:ser>`;
	const body = `<c:pie3DChart><c:varyColors val="1"/>${ser}</c:pie3DChart>`;
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<c:chartSpace ${C_NS}><c:chart><c:view3D><c:rotX val="30"/><c:rotY val="0"/></c:view3D>` +
		`<c:plotArea><c:layout/>${body}</c:plotArea>` +
		`<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`
	);
}

export async function generatePie3DFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Pie3D Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(
		createSlide('Blank')
			.addShape('rect', { x: 0, y: 0, width: 1, height: 1, fill: { type: 'none' }, text: '' })
			.build(),
	);
	const baseBytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(baseBytes);
	let contentTypes = await zip.file('[Content_Types].xml')!.async('string');

	const chartPartName = 'ppt/charts/chart1.xml';
	zip.file(chartPartName, pie3DChartXml());

	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	const rId = 'rId100';
	const relType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
	const newRels = relsXml.replace(
		'</Relationships>',
		`<Relationship Id="${rId}" Type="${relType}" Target="../charts/chart1.xml"/></Relationships>`,
	);
	zip.file(relsPath, newRels);

	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	const x = 60 * 9525;
	const y = 60 * 9525;
	const cx = 600 * 9525;
	const cy = 500 * 9525;
	const frame =
		`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="200" name="Pie3D"/>` +
		`<p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
		`<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>` +
		`</a:graphicData></a:graphic></p:graphicFrame>`;
	const marker = '</p:spTree>';
	const at = slideXml.lastIndexOf(marker);
	zip.file(slidePath, slideXml.slice(0, at) + frame + slideXml.slice(at));

	contentTypes = contentTypes.replace(
		'</Types>',
		`<Override PartName="/${chartPartName}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`,
	);
	zip.file('[Content_Types].xml', contentTypes);

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'pie3d.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

if (process.argv[1]?.endsWith('generate-pie3d-fixture.ts')) {
	generatePie3DFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
