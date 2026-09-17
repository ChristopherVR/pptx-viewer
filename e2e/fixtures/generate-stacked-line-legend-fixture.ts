/**
 * Generates `stacked-line-legend.pptx`: a single-slide deck with one STACKED
 * line chart, reproducing the exact construct from a real-world deck that
 * shipped two visible bugs (issue repro slide 21, `ppt/charts/chart3.xml`):
 *
 *   1. Series `c:idx` values are NON-SEQUENTIAL (1 and 2, not 0 and 1). A
 *      lookup keyed off raw `c:idx` instead of series position/order would
 *      silently miss or misplace a series.
 *   2. Series "A" carries `c:dPt` marker overrides on points 1-4 only (never
 *      point 0), so the series relies on its OWN series-level `c:marker` for
 *      the first point. A legend/marker resolver that assumes every point has
 *      a `c:dPt`, or that reads point 0's marker off the wrong series, would
 *      diverge here.
 *   3. `c:marker val="1"` at the `c:lineChart` level (markers on) with a
 *      bottom `c:legend`: PowerPoint draws a line + marker sample per legend
 *      entry, not the plain filled-rect swatch every other chart kind uses.
 *
 * Both reported symptoms (missing series polylines, missing legend line
 * samples) were investigated against the REAL file via COM-verified ground
 * truth; only the legend swatch was an actual shared-engine gap (see
 * `chart-legend-swatch.ts` in `pptx-viewer-shared`) - the stacked-line
 * polyline math was already correct in all five bindings. This fixture
 * exists so that fact stays true: a synthetic, checked-in repro of the exact
 * construct, not the user's personal deck (which is unrelated content and
 * does not belong in this repository).
 *
 * WHY hand-authored instead of `buildLineChartXml` (mirrors
 * `generate-chart-title-runs-fixture.ts`'s reasoning): that helper only emits
 * `c:grouping val="standard"`, one `c:idx`/`c:order` per series position, and
 * no `c:dPt` overrides at all, none of which this construct can do without
 * duplicating and diverging. This composes the same low-level cache/axis/
 * wrapper helpers (`chart-xml.ts`, now exported for exactly this) directly.
 *
 * Re-runnable; not wired into `global-setup.ts` (its bytes are checked in,
 * like `chart-title-runs.pptx`'s sibling fixtures).
 *
 * Run with: bun run e2e/fixtures/generate-stacked-line-legend-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type JSZipType from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import {
	CAT_AX_ID,
	catValAxes,
	numCache,
	strCache,
	txCache,
	VAL_AX_ID,
	wrapClassic,
} from './chart-xml';
import type { ChartXmlInput } from './chart-xml';
import { writeFixtureDeterministic } from './write-fixture';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

const __dirname = dirname(fileURLToPath(import.meta.url));

export const STACKED_LINE_TITLE = 'Stacked Line Legend Repro';
export const STACKED_LINE_CATEGORIES = ['2011', '2012', '2013', '2014', '2015'];
export const SERIES_A_NAME = 'A';
export const SERIES_A_VALUES = [2.4, 4.4, 1.8, 2.8, 5.6];
export const SERIES_A_COLOR = '00B0F0';
export const SERIES_B_NAME = 'B';
export const SERIES_B_VALUES = [2, 2, 3, 5, 6.4];
export const SERIES_B_COLOR = '404040';

const CHART_INPUT: ChartXmlInput = {
	title: STACKED_LINE_TITLE,
	categories: STACKED_LINE_CATEGORIES,
	series: [
		{ name: SERIES_A_NAME, values: SERIES_A_VALUES, colorHex: SERIES_A_COLOR },
		{ name: SERIES_B_NAME, values: SERIES_B_VALUES, colorHex: SERIES_B_COLOR },
	],
};

/** `c:dPt` marker overrides on points 1-4 (never point 0), matching the real deck. */
function seriesADataPoints(): string {
	return [1, 2, 3, 4]
		.map(
			(idx) =>
				`<c:dPt><c:idx val="${idx}"/><c:marker><c:spPr><a:solidFill><a:srgbClr val="${SERIES_A_COLOR}"/></a:solidFill></c:spPr></c:marker><c:bubble3D val="0"/></c:dPt>`,
		)
		.join('');
}

function lineSeries(
	idx: number,
	order: number,
	name: string,
	colorHex: string,
	dPts: string,
): string {
	return (
		`<c:ser><c:idx val="${idx}"/><c:order val="${order}"/>${txCache(name)}` +
		`<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill></a:ln></c:spPr>` +
		`<c:marker><c:spPr><a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill></c:spPr></c:marker>` +
		`${dPts}` +
		`<c:cat>${strCache(CHART_INPUT.categories)}</c:cat>` +
		`<c:val>${numCache(CHART_INPUT.series.find((s) => s.name === name)?.values ?? [])}</c:val>` +
		`<c:smooth val="0"/></c:ser>`
	);
}

/**
 * The exact construct: stacked grouping, non-sequential `c:idx` (1, 2), a
 * marker-enabled line chart, series A's partial `c:dPt` marker overrides.
 */
function stackedLineChartXml(): string {
	const seriesA = lineSeries(1, 0, SERIES_A_NAME, SERIES_A_COLOR, seriesADataPoints()),
		seriesB = lineSeries(2, 1, SERIES_B_NAME, SERIES_B_COLOR, ''),
		body =
			`<c:lineChart><c:grouping val="stacked"/><c:varyColors val="0"/>${seriesA}${seriesB}` +
			`<c:marker val="1"/><c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:lineChart>`;
	return wrapClassic(CHART_INPUT, body + catValAxes());
}

function chartGraphicFrameXml(rId: string, shapeId: number): string {
	const x = 60 * 9525,
		y = 60 * 9525,
		cx = 700 * 9525,
		cy = 420 * 9525;
	return (
		`<p:graphicFrame><p:nvGraphicFramePr>` +
		`<p:cNvPr id="${shapeId}" name="Stacked Line Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
		`<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>` +
		`</a:graphicData></a:graphic></p:graphicFrame>`
	);
}

function injectGraphicFrame(slideXml: string, frameXml: string): string {
	const marker = '</p:spTree>',
		at = slideXml.lastIndexOf(marker);
	if (at < 0) {
		throw new Error('slide XML missing </p:spTree>');
	}
	return slideXml.slice(0, at) + frameXml + slideXml.slice(at);
}

function addChartRel(relsXml: string, target: string): { xml: string; rId: string } {
	const ids = [...relsXml.matchAll(/Id="rId(?<n>\d+)"/gu)].map((m) =>
			Number.parseInt(m.groups?.n ?? '0', 10),
		),
		next = (ids.length > 0 ? Math.max(...ids) : 0) + 1,
		rId = `rId${next}`,
		relType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
		rel = `<Relationship Id="${rId}" Type="${relType}" Target="${target}"/>`;
	return { xml: relsXml.replace('</Relationships>', `${rel}</Relationships>`), rId };
}

function addContentTypeOverride(ctXml: string, partName: string): string {
	const contentType = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml',
		override = `<Override PartName="/${partName}" ContentType="${contentType}"/>`;
	return ctXml.replace('</Types>', `${override}</Types>`);
}

export async function generateStackedLineLegendFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Stacked Line Legend Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(
		createSlide('Blank')
			.addShape('rect', { x: 0, y: 0, width: 1, height: 1, fill: { type: 'none' } })
			.build(),
	);
	const baseBytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(baseBytes);

	const chartPartName = 'ppt/charts/chart1.xml';
	zip.file(chartPartName, stackedLineChartXml());

	const relsPath = 'ppt/slides/_rels/slide1.xml.rels',
		relsXml = await zip.file(relsPath)!.async('string'),
		{ xml: newRels, rId } = addChartRel(relsXml, '../charts/chart1.xml');
	zip.file(relsPath, newRels);

	const slidePath = 'ppt/slides/slide1.xml',
		slideXml = await zip.file(slidePath)!.async('string');
	zip.file(slidePath, injectGraphicFrame(slideXml, chartGraphicFrameXml(rId, 101)));

	const contentTypes = addContentTypeOverride(
		await zip.file('[Content_Types].xml')!.async('string'),
		chartPartName,
	);
	zip.file('[Content_Types].xml', contentTypes);

	const bytes: Uint8Array = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'stacked-line-legend.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-stacked-line-legend-fixture.ts');
if (invokedDirectly) {
	generateStackedLineLegendFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
