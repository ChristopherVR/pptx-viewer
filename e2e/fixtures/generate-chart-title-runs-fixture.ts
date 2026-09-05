/**
 * Generates `chart-title-runs.pptx`: a single-slide deck with one pie chart
 * whose title is TWO runs - "Sales " (bold) and "Overview" (italic, red) -
 * for `e2e/chart-title-runs.spec.ts`.
 *
 * The chart is deliberately a PIE, not a cartesian type: `ChartAxisOptions`
 * and `ChartAxisStyleOptions` (every binding's inspector) render nothing when
 * `chartData.axes` is empty, and a pie chart has no axes at all
 * (`ChartAxisOptions.tsx`'s own comment: "pie charts have none"). That keeps
 * the inspector's chart-data "Title" field (`pptx.chart.title`, labelled
 * "Title") the ONLY field on the panel labelled "Title" - the axis title
 * field (`pptx.chart.axisTitle`) shares that exact English string, so a
 * cartesian chart would make the inspector's title input ambiguous to locate.
 *
 * WHY this generator hand-authors the chart part instead of using the SDK's
 * `addChart` (mirrors `generate-chart-fixture.ts`): the core save pipeline
 * only *updates* an existing chart XML part, and the SDK's typed chart model
 * has no per-run rich-text title at all. `buildPieChartXml` (`./chart-xml.ts`)
 * gives a valid single-run pie chart; this generator string-replaces its
 * generated single-run `<c:title>` block with a two-run `<c:rich>` body, which
 * the core chart parser reads into `PptxChartData.titleRuns`
 * (`resolveChartTitleRunSpans` in `packages/shared/src/render/chart-title-
 * runs.ts` turns that into per-run `<tspan>` descriptors every binding paints).
 *
 * Re-runnable; not wired into `global-setup.ts` (its bytes are checked in,
 * like `chart-gallery.pptx`'s sibling fixtures).
 *
 * Run with: bun run e2e/fixtures/generate-chart-title-runs-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type JSZipType from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { buildPieChartXml } from './chart-xml';
import type { ChartXmlInput } from './chart-xml';
import { writeFixtureDeterministic } from './write-fixture';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The chart's flat title, as authored by `buildPieChartXml`'s single-run placeholder. */
const FLAT_TITLE = 'Sales Overview';
/** First run: bold, default colour. */
export const CHART_TITLE_RUN_1 = 'Sales ';
/** Second run: italic, red. */
export const CHART_TITLE_RUN_2 = 'Overview';
export const CHART_TITLE_RUN_2_HEX = 'FF0000';
export const PIE_SERIES_NAME = 'Revenue';
export const PIE_CATEGORIES = ['Q1', 'Q2', 'Q3', 'Q4'];
export const PIE_VALUES = [45, 62, 58, 71];
/** New flat title an editing test commits through the inspector. */
export const EDITED_TITLE = 'Full Year Sales';

const CHART_INPUT: ChartXmlInput = {
	title: FLAT_TITLE,
	categories: PIE_CATEGORIES,
	series: [{ name: PIE_SERIES_NAME, values: PIE_VALUES, colorHex: '4472C4' }],
};

/** Two-run rich title, replacing `buildPieChartXml`'s single-run placeholder. */
function twoRunTitleXml(): string {
	return (
		`<c:title><c:tx><c:rich><a:bodyPr/><a:p>` +
		`<a:r><a:rPr lang="en-US" b="1"/><a:t>${CHART_TITLE_RUN_1}</a:t></a:r>` +
		`<a:r><a:rPr lang="en-US" i="1"><a:solidFill><a:srgbClr val="${CHART_TITLE_RUN_2_HEX}"/></a:solidFill></a:rPr><a:t>${CHART_TITLE_RUN_2}</a:t></a:r>` +
		`</a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
	);
}

/** The single-run title block `buildPieChartXml` actually emits for `FLAT_TITLE`. */
function flatTitleXml(): string {
	return (
		`<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${FLAT_TITLE}</a:t></a:r></a:p></c:rich></c:tx>` +
		`<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
	);
}

function chartGraphicFrameXml(rId: string, shapeId: number): string {
	const x = 60 * 9525;
	const y = 60 * 9525;
	const cx = 700 * 9525;
	const cy = 420 * 9525;
	return (
		`<p:graphicFrame><p:nvGraphicFramePr>` +
		`<p:cNvPr id="${shapeId}" name="Pie Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
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

export async function generateChartTitleRunsFixture(): Promise<string> {
	// 1. Base deck: one blank slide with a tiny invisible anchor shape, so the
	// engine emits a proper slide part + `.rels` skeleton.
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Chart Title Runs Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(
		createSlide('Blank')
			.addShape('rect', { x: 0, y: 0, width: 1, height: 1, fill: { type: 'none' } })
			.build(),
	);
	const baseBytes = await handler.save(data.slides);

	// 2. Inject the chart part (two-run title), frame, rels and content-type.
	const zip = await JSZip.loadAsync(baseBytes);

	const flat = flatTitleXml();
	const chartXml = buildPieChartXml(CHART_INPUT);
	if (!chartXml.includes(flat)) {
		throw new Error('buildPieChartXml did not emit the expected single-run title block');
	}
	const richChartXml = chartXml.replace(flat, twoRunTitleXml());

	const chartPartName = 'ppt/charts/chart1.xml';
	zip.file(chartPartName, richChartXml);

	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	const { xml: newRels, rId } = addChartRel(relsXml, '../charts/chart1.xml');
	zip.file(relsPath, newRels);

	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	zip.file(slidePath, injectGraphicFrame(slideXml, chartGraphicFrameXml(rId, 101)));

	const contentTypes = addContentTypeOverride(
		await zip.file('[Content_Types].xml')!.async('string'),
		chartPartName,
	);
	zip.file('[Content_Types].xml', contentTypes);

	const bytes: Uint8Array = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'chart-title-runs.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-chart-title-runs-fixture.ts');
if (invokedDirectly) {
	generateChartTitleRunsFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
