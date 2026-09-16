/**
 * Generates `bar-picture-fill-hill.pptx`: a single-slide `barChart` that
 * reproduces the "hill/mountain silhouette" construct found in a real-world
 * deck (issue: chart1.xml on a report slide rendered "entirely different"
 * from PowerPoint). The construct: ONE category, SIX series (`c:idx` 0-5),
 * each contributing exactly one bar for that category with a value profile
 * that rises then falls (a hill shape: 1, 2, 3, 4, 3, 2). Every series' fill
 * is a bare `c:spPr/a:blipFill` picture fill with NO `c:pictureOptions`
 * sibling at all - PowerPoint's own default "stretch, no stack" picture fill
 * when the format pane's stack settings are never touched, and the exact
 * shape the render pipeline silently dropped before this fix (it required
 * `c:pictureOptions` to notice a picture fill at all, so every bar fell back
 * to a flat palette colour instead of the intended photo fill).
 *
 * `c:gapWidth val="5"` and `c:overlap val="23"` pack the six bars close
 * enough to visually merge into a continuous silhouette, matching the
 * real-world deck. `c:plotArea/c:layout/c:manualLayout` with
 * `layoutTarget="inner"` explicitly positions the plot area, exercising the
 * inner-target manual-layout path alongside the picture fill.
 *
 * The middle (peak) series, idx 2, uses a DIFFERENT image and a DIFFERENT
 * `a:alphaModFix` amount than the other five - mirroring the real deck's
 * "one highlighted series, rId3 + amt=67000, vs. every other series sharing
 * rId2 + amt=60000" pattern - so a fixture assertion can tell the two apart
 * and confirm per-series opacity is honoured, not just presence of a picture.
 *
 * Same base-deck-then-inject-a-chart-part technique as
 * `generate-bar3d-picture-fill-fixture.ts` (this file's sibling): the core
 * save pipeline can only UPDATE an existing chart part, not author a
 * picture-fill one from scratch, so a valid deck skeleton is built first and
 * the chart part + its own picture relationships are spliced into the saved
 * zip afterwards.
 *
 * Run with: bun run e2e/fixtures/generate-bar-picture-fill-hill-fixture.ts
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

const CAT_AX_ID = 511111111;
const VAL_AX_ID = 522222222;

/** Hill-shaped value profile: rises then falls, like the real-world deck's 8-series chart. */
const VALUES = [1, 2, 3, 4, 3, 2];
/** Series index whose peak bar gets the distinct (blue, 67%) picture fill. */
const PEAK_INDEX = 3;

function strCache(value: string): string {
	return `<c:strRef><c:f>Sheet1!$A$2</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${value}</c:v></c:pt></c:strCache></c:strRef>`;
}

function numCache(value: number): string {
	return `<c:numRef><c:f>Sheet1!$B$2</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="1"/><c:pt idx="0"><c:v>${value}</c:v></c:pt></c:numCache></c:numRef>`;
}

/**
 * One `c:ser`: a bare `a:blipFill` picture fill (NO `c:pictureOptions`
 * sibling), matching the real-world deck exactly. `amt` is the
 * `a:alphaModFix` opacity (thousandths of a percent, so `60000` is 60%).
 */
function seriesXml(idx: number, pictureRelId: string, amt: number, value: number): string {
	return (
		`<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/>` +
		`<c:tx><c:strRef><c:f>Sheet1!$${String.fromCharCode(66 + idx)}$1</c:f>` +
		`<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Series ${idx + 1}</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
		`<c:spPr><a:blipFill dpi="0" rotWithShape="1">` +
		`<a:blip r:embed="${pictureRelId}"><a:alphaModFix amt="${amt}"/></a:blip>` +
		`<a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill>` +
		`<a:ln><a:noFill/></a:ln></c:spPr>` +
		`<c:invertIfNegative val="0"/>` +
		`<c:cat>${strCache('Category 1')}</c:cat><c:val>${numCache(value)}</c:val></c:ser>`
	);
}

/**
 * The `barChart` chart part: one category, six series, all bare `a:blipFill`
 * picture fills, packed with `c:gapWidth val="5"`/`c:overlap val="23"`, and
 * an explicit `layoutTarget="inner"` plot-area manual layout - the same
 * construct as the real-world "hill silhouette" deck this fixture reproduces.
 */
function barChartXml(grayRelId: string, blueRelId: string): string {
	const axes =
		`<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${VAL_AX_ID}"/></c:catAx>` +
		`<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="${CAT_AX_ID}"/></c:valAx>`;
	const series = VALUES.map((value, idx) =>
		idx === PEAK_INDEX
			? seriesXml(idx, blueRelId, 67000, value)
			: seriesXml(idx, grayRelId, 60000, value),
	).join('');
	const body =
		`<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
		`${series}<c:gapWidth val="5"/><c:overlap val="23"/>` +
		`<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:barChart>`;
	const manualLayout =
		`<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/>` +
		`<c:x val="0.06"/><c:y val="0.02"/><c:w val="0.92"/><c:h val="0.9"/></c:manualLayout></c:layout>`;
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<c:chartSpace ${C_NS}><c:chart><c:autoTitleDeleted val="1"/>` +
		`<c:plotArea>${manualLayout}${body}${axes}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>` +
		`<c:plotVisOnly val="1"/></c:chart></c:chartSpace>`
	);
}

/** Solid 2x2 PNG at the given opaque RGB (alpha comes from `a:alphaModFix`, not the pixel data). */
function solidPng(r: number, g: number, b: number): Uint8Array {
	const px = [r, g, b, 255];
	return encodePng(2, 2, new Uint8Array([...px, ...px, ...px, ...px]));
}

export async function generateBarPictureFillHillFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Bar Picture-Fill Hill Fixture',
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

	// Pale gray-green (most series) and blue (the peak series) - the same two
	// colours, roughly, as the real-world deck's two embedded triangle images.
	const grayImagePart = 'ppt/media/image901.png';
	const blueImagePart = 'ppt/media/image902.png';
	zip.file(grayImagePart, solidPng(0xd6, 0xdb, 0xd3));
	zip.file(blueImagePart, solidPng(0x00, 0xaf, 0xef));

	const chartRelsPath = 'ppt/charts/_rels/chart1.xml.rels';
	const grayRelId = 'rId1';
	const blueRelId = 'rId2';
	zip.file(
		chartRelsPath,
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
			`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
			`<Relationship Id="${grayRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image901.png"/>` +
			`<Relationship Id="${blueRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image902.png"/>` +
			`</Relationships>`,
	);

	const chartPartName = 'ppt/charts/chart1.xml';
	zip.file(chartPartName, barChartXml(grayRelId, blueRelId));

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
		`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="200" name="BarPictureFillHill"/>` +
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
	const outPath = resolve(__dirname, 'bar-picture-fill-hill.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

if (process.argv[1]?.endsWith('generate-bar-picture-fill-hill-fixture.ts')) {
	generateBarPictureFillHillFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
