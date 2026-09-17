import { mkdirSync } from 'node:fs';
/**
 * Generates `chart-stacked-line-markers.pptx`: a single-slide deck with one
 * stacked line chart reproducing three real-world constructs found in a
 * user-supplied deck (slide 21 of a `ppt/charts/chart3.xml` part), all fixed
 * in `packages/shared/src/render` and `packages/core/src/core/utils`:
 *
 *   1. `<c:valAx><c:majorGridlines/>` with NO `c:spPr` and no attributes: a
 *      childless, attribute-less element that fast-xml-parser renders as an
 *      empty STRING, not `{}`. `chart-axis-parser.ts`'s presence check used
 *      to require a non-array OBJECT, so this common bare form (PowerPoint
 *      writes it constantly) parsed as "no gridlines" (fixed:
 *      `hasLocalName` in `chart-axis-parser.ts`).
 *   2. Two series with NON-SEQUENTIAL `c:idx` (1, 2, not 0, 1) and no
 *      authored `c:symbol` anywhere: real PowerPoint auto-assigns series
 *      idx=1 a SQUARE marker and idx=2 a TRIANGLE marker (COM-verified),
 *      not the plain circle every "automatic" marker used to resolve to
 *      (fixed: `PptxChartSeries.idx` parsing + the automatic marker cycle
 *      in `chart-datapoint-style.ts`).
 *   3. `<c:legend><c:txPr>` authoring an 18pt font for the WHOLE legend
 *      (distinct from a per-entry `c:legendEntry/c:txPr` override, which
 *      already worked): never parsed, so the legend rendered at the
 *      renderer's hardcoded 9px default regardless (fixed:
 *      `parseChartLegendStyle` + `applyLegendEntryOverrides`'s new
 *      `legendBaseStyle` parameter).
 *
 * `c:grouping="stacked"` (series B plots at the A+B running sum) was
 * INVESTIGATED and found to already work correctly; included here anyway so
 * a future regression in that path is also caught by this fixture's spec.
 *
 * Used by `chart-stacked-line-markers.spec.ts` for a framework-neutral
 * regression check across all five bindings.
 *
 * WHY a generated fixture instead of committing the real user deck: the
 * source deck is personal content unrelated to this repo; this fixture
 * reproduces only the OOXML constructs that trigger the bugs, with
 * synthetic data.
 *
 * Re-runnable; the spec invokes it from globalSetup.
 */
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

export const CHART_STACKED_LINE_TITLE = 'Stacked Line Markers Fixture';
export const CHART_STACKED_LINE_CATEGORIES = ['2011', '2012', '2013', '2014', '2015'] as const;
export const CHART_STACKED_LINE_SERIES_A_NAME = 'A';
export const CHART_STACKED_LINE_SERIES_B_NAME = 'B';
const VALUES_A = [2.4, 4.4, 1.8, 2.8, 5.6] as const;
const VALUES_B = [2, 2, 3, 5, 6.4] as const;

const CAT_AX_ID = 38397952;
const VAL_AX_ID = 36336128;

function pts(values: readonly number[]): string {
	return values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
}

function catPts(): string {
	return CHART_STACKED_LINE_CATEGORIES.map(
		(v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`,
	).join('');
}

function seriesXml(
	idx: number,
	order: number,
	name: string,
	color: string,
	values: readonly number[],
): string {
	const n = CHART_STACKED_LINE_CATEGORIES.length;
	return (
		`<c:ser><c:idx val="${idx}"/><c:order val="${order}"/>` +
		`<c:tx><c:strRef><c:f>Sheet1!$${String.fromCharCode(66 + order)}$1</c:f>` +
		`<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${name}</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
		// NO c:symbol anywhere: PowerPoint resolves this to an automatic marker
		// shape cycled by c:idx, not a plain circle.
		`<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln></c:spPr>` +
		`<c:marker><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:marker>` +
		`<c:cat><c:numRef><c:f>Sheet1!$A$2:$A$${n + 1}</c:f>` +
		`<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${n}"/>${catPts()}</c:numCache></c:numRef></c:cat>` +
		`<c:val><c:numRef><c:f>Sheet1!$${String.fromCharCode(66 + order)}$2:$${String.fromCharCode(66 + order)}$${n + 1}</c:f>` +
		`<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${n}"/>${pts(values)}</c:numCache></c:numRef></c:val>` +
		`<c:smooth val="0"/></c:ser>`
	);
}

/**
 * The chart XML part, matching the real-world shape as closely as practical:
 * a stacked line chart, non-sequential series idx (1, 2), no authored
 * markers, a bare `<c:majorGridlines/>`, and an 18pt whole-legend `c:txPr`.
 */
function chartXml(): string {
	const seriesA = seriesXml(1, 0, CHART_STACKED_LINE_SERIES_A_NAME, '00B0F0', VALUES_A);
	const seriesB = seriesXml(2, 1, CHART_STACKED_LINE_SERIES_B_NAME, '404040', VALUES_B);
	// `<c:majorGridlines/>` (bare, no c:spPr, no attributes) is the exact
	// construct that used to parse as "no gridlines". The whole-legend
	// `<c:txPr>` (18pt) is distinct from any per-entry override.
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
		`<c:chart><c:autoTitleDeleted val="1"/>` +
		`<c:plotArea><c:layout/>` +
		`<c:lineChart><c:grouping val="stacked"/><c:varyColors val="0"/>${seriesA}${seriesB}` +
		`<c:marker val="1"/><c:smooth val="0"/>` +
		`<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:lineChart>` +
		`<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/>` +
		`<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
		`<c:crossAx val="${VAL_AX_ID}"/><c:crosses val="autoZero"/><c:auto val="1"/>` +
		`<c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
		`<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/>` +
		`<c:numFmt formatCode="General" sourceLinked="1"/>` +
		`<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
		`<c:crossAx val="${CAT_AX_ID}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>` +
		`</c:plotArea>` +
		`<c:legend><c:legendPos val="b"/><c:overlay val="0"/>` +
		`<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1800"/></a:pPr></a:p></c:txPr></c:legend>` +
		`<c:plotVisOnly val="1"/><c:dispBlanksAs val="zero"/></c:chart>` +
		`</c:chartSpace>`
	);
}

function chartGraphicFrameXml(rId: string): string {
	const x = 60 * 9525,
		y = 60 * 9525,
		cx = 840 * 9525,
		cy = 420 * 9525;
	return (
		`<p:graphicFrame><p:nvGraphicFramePr>` +
		`<p:cNvPr id="101" name="Chart 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
		`<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>` +
		`</a:graphicData></a:graphic></p:graphicFrame>`
	);
}

function injectGraphicFrame(slideXml: string, frameXml: string): string {
	const marker = '</p:spTree>';
	const at = slideXml.lastIndexOf(marker);
	if (at < 0) {
		throw new Error('slide XML missing </p:spTree>');
	}
	return slideXml.slice(0, at) + frameXml + slideXml.slice(at);
}

function addChartRel(relsXml: string, target: string): { xml: string; rId: string } {
	const ids = [...relsXml.matchAll(/Id="rId(?<n>\d+)"/gu)].map((m) =>
		Number.parseInt(m.groups?.n ?? '0', 10),
	);
	const next = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
	const rId = `rId${next}`;
	const relType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
	const rel = `<Relationship Id="${rId}" Type="${relType}" Target="${target}"/>`;
	return { xml: relsXml.replace('</Relationships>', `${rel}</Relationships>`), rId };
}

function addContentTypeOverride(ctXml: string, partName: string): string {
	const contentType = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
	const override = `<Override PartName="/${partName}" ContentType="${contentType}"/>`;
	return ctXml.replace('</Types>', `${override}</Types>`);
}

export async function generateChartStackedLineMarkersFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Chart Stacked Line Markers Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(
		createSlide('Blank')
			.addShape('rect', {
				x: 0,
				y: 0,
				width: 1,
				height: 1,
				fill: { type: 'none' },
				text: CHART_STACKED_LINE_TITLE,
			})
			.build(),
	);
	const baseBytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(baseBytes);
	let contentTypes = await zip.file('[Content_Types].xml')!.async('string');

	const chartPartName = 'ppt/charts/chart1.xml';
	const slidePath = 'ppt/slides/slide1.xml';
	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';

	zip.file(chartPartName, chartXml());

	const relsXml = await zip.file(relsPath)!.async('string');
	const { xml: newRels, rId } = addChartRel(relsXml, '../charts/chart1.xml');
	zip.file(relsPath, newRels);

	const slideXml = await zip.file(slidePath)!.async('string');
	zip.file(slidePath, injectGraphicFrame(slideXml, chartGraphicFrameXml(rId)));

	contentTypes = addContentTypeOverride(contentTypes, chartPartName);
	zip.file('[Content_Types].xml', contentTypes);

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'chart-stacked-line-markers.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-chart-stacked-line-markers-fixture.ts');
if (invokedDirectly) {
	generateChartStackedLineMarkersFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
