/**
 * Generates `bar3d-horizontal.pptx`: a single slide holding one `bar3D` chart
 * authored `c:barDir val="bar"` (PowerPoint's horizontal 3-D Bar, as opposed
 * to the default vertical 3-D Column).
 *
 * `bar3D` is not in `e2e/fixtures/chart-xml.ts`'s builders (they only ever
 * emit `c:barChart`), and this generator owns no file outside `e2e/`, so the
 * `c:bar3DChart` XML is hand-authored here rather than extending that shared
 * helper. `packages/core/src/core/core/runtime/PptxHandlerRuntimeChartDetection.ts`
 * maps the `<c:bar3DChart>` element name to `chartType: 'bar3D'`, and
 * `resolveChartKind` (`packages/shared/src/render/chart-view-model-kinds.ts`)
 * folds `bar3D` back onto the flat `'bar'` SVG geometry unless a binding has
 * opted into the interactive three.js scene (`BarChart3DContext`) - none of
 * the five demos do by default - so the flat renderer's horizontal-bar
 * geometry (`chart-horizontal-bars.ts`) is exactly what this fixture exercises.
 *
 * Same base-deck-then-inject-a-chart-part technique as
 * `generate-chart-fixture.ts`: the core save pipeline can only UPDATE an
 * existing chart part, not author one from scratch, so a valid deck skeleton
 * is built first and the chart part is spliced into the saved zip afterwards.
 *
 * Run with: bun run e2e/fixtures/generate-bar3d-horizontal-fixture.ts
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

const CATEGORIES = ['North', 'South', 'East', 'West'];
const SERIES: readonly { name: string; values: number[]; colorHex: string }[] = [
	{ name: 'Revenue', values: [45, 62, 58, 71], colorHex: '4472C4' },
	{ name: 'Cost', values: [30, 41, 38, 52], colorHex: 'ED7D31' },
];

const CAT_AX_ID = 111111111;
const VAL_AX_ID = 222222222;
const SER_AX_ID = 333333333;

function strCache(values: readonly string[]): string {
	const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
	return `<c:strRef><c:f>Sheet1!$A$2:$A$${values.length + 1}</c:f><c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache></c:strRef>`;
}

function numCache(values: readonly number[]): string {
	const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
	return `<c:numRef><c:f>Sheet1!$B$2:$B$${values.length + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache></c:numRef>`;
}

function seriesXml(): string {
	return SERIES.map(
		(s, i) =>
			`<c:ser><c:idx val="${i}"/><c:order val="${i}"/>` +
			`<c:tx><c:strRef><c:f>Sheet1!$${String.fromCharCode(66 + i)}$1</c:f><c:strCache><c:ptCount val="1"/>` +
			`<c:pt idx="0"><c:v>${s.name}</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
			`<c:spPr><a:solidFill><a:srgbClr val="${s.colorHex}"/></a:solidFill></c:spPr>` +
			`<c:cat>${strCache(CATEGORIES)}</c:cat><c:val>${numCache(s.values)}</c:val></c:ser>`,
	).join('');
}

/** The `bar3D` chart part: `c:barDir val="bar"` is the horizontal orientation under test. */
function bar3DChartXml(): string {
	const axes =
		`<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="${VAL_AX_ID}"/></c:catAx>` +
		`<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${CAT_AX_ID}"/></c:valAx>` +
		`<c:serAx><c:axId val="${SER_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="1"/><c:axPos val="b"/><c:crossAx val="${VAL_AX_ID}"/></c:serAx>`;
	const body =
		`<c:bar3DChart><c:barDir val="bar"/><c:grouping val="clustered"/>` +
		`${seriesXml()}<c:shape val="box"/>` +
		`<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/><c:axId val="${SER_AX_ID}"/></c:bar3DChart>`;
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<c:chartSpace ${C_NS}><c:chart><c:plotArea><c:layout/>${body}${axes}</c:plotArea>` +
		`<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`
	);
}

export async function generateBar3DHorizontalFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Horizontal Bar3D Fixture',
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
	zip.file(chartPartName, bar3DChartXml());

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
	const cx = 840 * 9525;
	const cy = 420 * 9525;
	const frame =
		`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="200" name="HorizontalBar3D"/>` +
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
	const outPath = resolve(__dirname, 'bar3d-horizontal.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

if (process.argv[1]?.endsWith('generate-bar3d-horizontal-fixture.ts')) {
	generateBar3DHorizontalFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
