/**
 * Generates `bar3d-picture-fill.pptx`: a single-slide `bar3D` chart whose
 * ONE series has a picture-only fill (`c:pictureOptions`, no `a:solidFill`)
 * with `c:applyToFront val="1"` but `c:applyToSides val="0"` and
 * `c:applyToEnd val="0"` - i.e. the side and end extrusion faces are
 * EXPLICITLY left untargeted, the exact COM-verified scenario
 * `chart-bar3d-face-picture.ts`'s module doc reproduces: PowerPoint paints
 * those two faces a flat colour sampled from the picture's own pixel at
 * (0,0), not the resolved series colour and not an average of the image.
 *
 * The embedded picture is a tiny 2x2 PNG whose (0,0) pixel is a distinctive
 * GREEN (`#00ff00`) with every other pixel red (`#ff0000`) - the same
 * "majority colour is a decoy" shape as the mostly-red-with-one-green-corner
 * COM ground-truth fixture already documented in that module, so a renderer
 * that (incorrectly) averaged or centre-sampled the image would visibly fail
 * this fixture's e2e assertion.
 *
 * Same base-deck-then-inject-a-chart-part technique as
 * `generate-bar3d-horizontal-fixture.ts` (this file's sibling): the core save
 * pipeline can only UPDATE an existing chart part, not author a picture-fill
 * one from scratch, so a valid deck skeleton is built first and the chart
 * part + its own picture relationship are spliced into the saved zip
 * afterwards.
 *
 * Run with: bun run e2e/fixtures/generate-bar3d-picture-fill-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type JSZipType from 'jszip';
import { encodePng, PptxHandler } from 'pptx-viewer-core';

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

const CATEGORIES = ['Only'];
const VALUES = [80];
const CAT_AX_ID = 411111111;
const VAL_AX_ID = 422222222;
const SER_AX_ID = 433333333;

function strCache(values: readonly string[]): string {
	const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
	return `<c:strRef><c:f>Sheet1!$A$2:$A$${values.length + 1}</c:f><c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache></c:strRef>`;
}

function numCache(values: readonly number[]): string {
	const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
	return `<c:numRef><c:f>Sheet1!$B$2:$B$${values.length + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache></c:numRef>`;
}

/**
 * The `bar3D` chart part: one series, picture-only fill (no `a:solidFill`),
 * front face targeted, side/end faces explicitly untargeted
 * (`c:applyToSides`/`c:applyToEnd` both `0`) - the COM-verified "paint a flat
 * colour sampled from the picture's pixel at (0,0)" scenario.
 */
function bar3DChartXml(pictureRelId: string): string {
	const axes =
		`<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${VAL_AX_ID}"/></c:catAx>` +
		`<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="${CAT_AX_ID}"/></c:valAx>` +
		`<c:serAx><c:axId val="${SER_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="1"/><c:axPos val="b"/><c:crossAx val="${VAL_AX_ID}"/></c:serAx>`;
	const ser =
		`<c:ser><c:idx val="0"/><c:order val="0"/>` +
		`<c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache><c:ptCount val="1"/>` +
		`<c:pt idx="0"><c:v>Series</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
		`<c:spPr><a:blipFill><a:blip r:embed="${pictureRelId}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>` +
		`<a:ln><a:noFill/></a:ln></c:spPr>` +
		`<c:pictureOptions><c:applyToFront val="1"/><c:applyToSides val="0"/><c:applyToEnd val="0"/>` +
		`<c:pictureFormat val="stretch"/></c:pictureOptions>` +
		`<c:shape val="box"/>` +
		`<c:cat>${strCache(CATEGORIES)}</c:cat><c:val>${numCache(VALUES)}</c:val></c:ser>`;
	const body =
		`<c:bar3DChart><c:barDir val="col"/><c:grouping val="clustered"/>` +
		`${ser}<c:shape val="box"/>` +
		`<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/><c:axId val="${SER_AX_ID}"/></c:bar3DChart>`;
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<c:chartSpace ${C_NS}><c:chart><c:plotArea><c:layout/>${body}${axes}</c:plotArea>` +
		`<c:plotVisOnly val="1"/></c:chart></c:chartSpace>`
	);
}

/** 2x2 PNG: pixel (0,0) is GREEN, every other pixel RED. */
function pictureFillPng(): Uint8Array {
	const rgba = new Uint8Array([
		0,
		255,
		0,
		255,
		255,
		0,
		0,
		255, // row 0: green, red
		255,
		0,
		0,
		255,
		255,
		0,
		0,
		255, // row 1: red, red
	]);
	return encodePng(2, 2, rgba);
}

export async function generateBar3DPictureFillFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Bar3D Picture-Fill Fixture',
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

	const imagePartName = 'ppt/media/image900.png';
	zip.file(imagePartName, pictureFillPng());

	const chartRelsPath = 'ppt/charts/_rels/chart1.xml.rels';
	const pictureRelId = 'rId1';
	zip.file(
		chartRelsPath,
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
			`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
			`<Relationship Id="${pictureRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image900.png"/>` +
			`</Relationships>`,
	);

	const chartPartName = 'ppt/charts/chart1.xml';
	zip.file(chartPartName, bar3DChartXml(pictureRelId));

	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	const chartRId = 'rId100';
	const chartRelType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
	const newRels = relsXml.replace(
		'</Relationships>',
		`<Relationship Id="${chartRId}" Type="${chartRelType}" Target="../charts/chart1.xml"/></Relationships>`,
	);
	zip.file(relsPath, newRels);

	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	const x = 60 * 9525;
	const y = 60 * 9525;
	const cx = 840 * 9525;
	const cy = 420 * 9525;
	const frame =
		`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="200" name="Bar3DPictureFill"/>` +
		`<p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
		`<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${chartRId}"/>` +
		`</a:graphicData></a:graphic></p:graphicFrame>`;
	const marker = '</p:spTree>';
	const at = slideXml.lastIndexOf(marker);
	zip.file(slidePath, slideXml.slice(0, at) + frame + slideXml.slice(at));

	contentTypes = contentTypes.replace(
		'</Types>',
		`<Default Extension="png" ContentType="image/png"/>` +
			`<Override PartName="/${chartPartName}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`,
	);
	zip.file('[Content_Types].xml', contentTypes);

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'bar3d-picture-fill.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

if (process.argv[1]?.endsWith('generate-bar3d-picture-fill-fixture.ts')) {
	generateBar3DPictureFillFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
