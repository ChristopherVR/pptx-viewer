import { mkdirSync } from 'node:fs';
/**
 * Generates `chart-gallery.pptx` - a multi-slide deck with exactly one chart
 * per slide, covering the breadth of chart kinds the viewers render. Used by
 * `chart-rendering.spec.ts` to visually verify chart parity across the
 * every maintained viewer binding.
 *
 * Why this generator post-processes the package zip instead of using the SDK's
 * `addChart`: the core save pipeline only *updates* an existing chart XML part
 * (it keys off `chartData.chartPartPath`) and has no path to author a brand-new
 * chart part, so `handler.save()` silently drops from-scratch charts
 * (`SAVE_ELEMENT_SKIPPED`). To get real, loadable charts we:
 *
 *   1. Build a valid base deck via `PptxHandler.createBlank` - one slide per
 *      chart, each carrying a tiny anchor shape so the engine emits a proper
 *      slide part + `.rels` skeleton (masters, layouts, theme, content-types).
 *   2. Re-open the saved package with JSZip and, per slide, inject a chart
 *      `p:graphicFrame`, a slide→chart relationship, the chart XML part
 *      (authored by `chart-xml.ts`), and the `[Content_Types].xml` override.
 *
 * Every chart is deterministic (fixed values, fixed categories, explicit
 * per-series colours), and all five bindings turn the parsed `PptxChartData`
 * into SVG via the shared `buildChartViewModel` engine - so any divergence the
 * spec catches is a real per-framework rendering bug.
 *
 * The slide order is the contract the spec iterates over; keep
 * {@link CHART_SLIDES} in sync with `chart-rendering.spec.ts`.
 *
 * Re-runnable; the spec invokes it from globalSetup.
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// JSZip is a dependency of `pptx-viewer-core` (the core package bundles it but
// does not re-export it) and is not a direct dependency of the e2e harness.
// Resolve it from the core package's own resolution scope, which is guaranteed
// present, rather than adding a separate e2e dependency.
import type JSZipType from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxChartType } from 'pptx-viewer-core';

import {
	buildAreaChartXml,
	buildBarChartXml,
	buildBubbleChartXml,
	buildCxChartXml,
	buildLineChartXml,
	buildPieChartXml,
	buildRadarChartXml,
	buildScatterChartXml,
} from './chart-xml';
import type { ChartXmlInput, ChartXmlSeries } from './chart-xml';
import { writeFixtureDeterministic } from './write-fixture';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
// jszip uses `export = JSZip`; the required value is the constructor itself.
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Deterministic, high-contrast palette (hex without '#') applied per series. */
const PALETTE = ['4472C4', 'ED7D31', '70AD47', 'FFC000'] as const;
const CATEGORIES = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const SERIES_NAMES = ['Revenue', 'Cost', 'Profit'] as const;
const VALUE_BANK: readonly number[][] = [
	[45, 62, 58, 71],
	[30, 41, 38, 52],
	[18, 24, 29, 33],
];

/**
 * One chart slide. `key` is the contract `chart-rendering.spec.ts` iterates
 * over (and the screenshot filename). `seriesCount` / `categoryCount` let the
 * parity spec derive expected primitive counts without re-deriving data.
 */
export interface ChartSlideSpec {
	key: string;
	title: string;
	chartType: PptxChartType;
	seriesCount: number;
	categoryCount: number;
}

export const CHART_SLIDES: readonly ChartSlideSpec[] = [
	{
		key: 'clustered-bar',
		title: 'Clustered Bar',
		chartType: 'bar',
		seriesCount: 2,
		categoryCount: 4,
	},
	{
		key: 'line',
		title: 'Line (with trendline)',
		chartType: 'line',
		seriesCount: 2,
		categoryCount: 4,
	},
	{ key: 'area', title: 'Area', chartType: 'area', seriesCount: 2, categoryCount: 4 },
	{ key: 'pie', title: 'Pie', chartType: 'pie', seriesCount: 1, categoryCount: 4 },
	{ key: 'doughnut', title: 'Doughnut', chartType: 'doughnut', seriesCount: 1, categoryCount: 4 },
	{ key: 'radar', title: 'Radar', chartType: 'radar', seriesCount: 2, categoryCount: 4 },
	{ key: 'scatter', title: 'Scatter', chartType: 'scatter', seriesCount: 2, categoryCount: 4 },
	{ key: 'bubble', title: 'Bubble', chartType: 'bubble', seriesCount: 2, categoryCount: 4 },
	{ key: 'stacked-bar', title: 'Stacked Bar', chartType: 'bar', seriesCount: 3, categoryCount: 4 },
	{
		key: 'percent-stacked-bar',
		title: 'Percent Stacked Bar',
		chartType: 'bar',
		seriesCount: 3,
		categoryCount: 4,
	},
	{ key: 'funnel', title: 'Funnel', chartType: 'funnel', seriesCount: 1, categoryCount: 4 },
	{ key: 'sunburst', title: 'Sunburst', chartType: 'sunburst', seriesCount: 2, categoryCount: 4 },
	{
		key: 'histogram',
		title: 'Histogram',
		chartType: 'histogram',
		seriesCount: 1,
		categoryCount: 4,
	},
	{
		key: 'box-whisker',
		title: 'Box-Whisker',
		chartType: 'boxWhisker',
		seriesCount: 3,
		categoryCount: 4,
	},
];

function seriesFor(slide: ChartSlideSpec): ChartXmlSeries[] {
	return Array.from({ length: slide.seriesCount }, (_, i) => ({
		name: SERIES_NAMES[i] ?? `Series ${i + 1}`,
		values: [...(VALUE_BANK[i] ?? VALUE_BANK[0])],
		colorHex: PALETTE[i % PALETTE.length],
	}));
}

/** Author the chart XML part for a slide spec. */
function chartXmlFor(slide: ChartSlideSpec): string {
	const input: ChartXmlInput = {
		title: slide.title,
		categories: [...CATEGORIES],
		series: seriesFor(slide),
	};
	switch (slide.key) {
		case 'clustered-bar':
			return buildBarChartXml(input, 'clustered');
		case 'stacked-bar':
			return buildBarChartXml(input, 'stacked');
		case 'percent-stacked-bar':
			return buildBarChartXml(input, 'percentStacked');
		case 'line':
			return buildLineChartXml(input, true);
		case 'area':
			return buildAreaChartXml(input);
		case 'pie':
			return buildPieChartXml(input, false);
		case 'doughnut':
			return buildPieChartXml(input, true);
		case 'radar':
			return buildRadarChartXml(input);
		case 'scatter':
			return buildScatterChartXml(input);
		case 'bubble':
			return buildBubbleChartXml(input);
		case 'funnel':
			return buildCxChartXml(input, 'funnel');
		case 'sunburst':
			return buildCxChartXml(input, 'sunburst');
		case 'histogram':
			return buildCxChartXml(input, 'histogram');
		case 'box-whisker':
			return buildCxChartXml(input, 'boxWhisker');
		default:
			return buildBarChartXml(input, 'clustered');
	}
}

/**
 * A chart part comes in two entirely separate flavours, and all three of the
 * package-level bindings below have to agree with the part's root element.
 *
 * The classic 2006 DrawingML chart is `<c:chartSpace>`. The 2014 "chartex"
 * chart (funnel, sunburst, histogram, box-whisker, treemap, waterfall,
 * region-map) is `<cx:chartSpace>` in a Microsoft extension namespace, and it
 * needs its OWN content type, relationship type and `graphicData/@uri`.
 *
 * This generator used to declare all fourteen parts as classic charts while
 * writing `cx:chartSpace` content into four of them, on the theory that the
 * classic uri kept `parseGraphicFrameType` happy. It did, but it also made the
 * deck un-openable: PowerPoint validates chart1.xml..chart14.xml against the
 * `c:` schema, hits `cx:chartSpace` in chart11, and refuses the whole file. The
 * fixture was the one deck in this repo that PowerPoint would not open even
 * before we saved it. Core resolves the chartex uri on its own
 * (`PptxGraphicFrameParser` matches `/2014/chartex`), so the honest wiring
 * costs nothing.
 */
const CHART_BINDINGS = {
	classic: {
		contentType: 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml',
		relType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
		graphicDataUri: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
		prefix: 'c',
		namespace: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
	},
	chartex: {
		contentType: 'application/vnd.ms-office.chartex+xml',
		relType: 'http://schemas.microsoft.com/office/2014/relationships/chartEx',
		graphicDataUri: 'http://schemas.microsoft.com/office/drawing/2014/chartex',
		prefix: 'cx',
		namespace: 'http://schemas.microsoft.com/office/drawing/2014/chartex',
	},
} as const;

/** The chart-slide keys whose part is authored by `buildCxChartXml`. */
const CHARTEX_KEYS = new Set(['funnel', 'sunburst', 'histogram', 'box-whisker']);

function bindingFor(slide: ChartSlideSpec): (typeof CHART_BINDINGS)[keyof typeof CHART_BINDINGS] {
	return CHARTEX_KEYS.has(slide.key) ? CHART_BINDINGS.chartex : CHART_BINDINGS.classic;
}

/**
 * A chart graphic frame referencing relationship `rId`, bound to the flavour
 * the referenced part actually is. Positioned at 60,60 / 840x420 px in EMU.
 */
function chartGraphicFrameXml(
	binding: (typeof CHART_BINDINGS)[keyof typeof CHART_BINDINGS],
	rId: string,
	shapeId: number,
	name: string,
): string {
	const x = 60 * 9525;
	const y = 60 * 9525;
	const cx = 840 * 9525;
	const cy = 420 * 9525;
	return (
		`<p:graphicFrame><p:nvGraphicFramePr>` +
		`<p:cNvPr id="${shapeId}" name="${name}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="${binding.graphicDataUri}">` +
		`<${binding.prefix}:chart xmlns:${binding.prefix}="${binding.namespace}" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>` +
		`</a:graphicData></a:graphic></p:graphicFrame>`
	);
}

/** Inject a chart `p:graphicFrame` immediately before `</p:spTree>`. */
function injectGraphicFrame(slideXml: string, frameXml: string): string {
	const marker = '</p:spTree>';
	const at = slideXml.lastIndexOf(marker);
	if (at < 0) {
		throw new Error('slide XML missing </p:spTree>');
	}
	return slideXml.slice(0, at) + frameXml + slideXml.slice(at);
}

/** Add a chart relationship to a slide `.rels`, returning the new rId. */
function addChartRel(
	relsXml: string,
	target: string,
	relType: string,
): { xml: string; rId: string } {
	const ids = [...relsXml.matchAll(/Id="rId(?<n>\d+)"/gu)].map((m) =>
		Number.parseInt(m.groups?.n ?? '0', 10),
	);
	const next = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
	const rId = `rId${next}`;
	const rel = `<Relationship Id="${rId}" Type="${relType}" Target="${target}"/>`;
	const xml = relsXml.replace('</Relationships>', `${rel}</Relationships>`);
	return { xml, rId };
}

/** Append the chart part content-type override to `[Content_Types].xml`. */
function addContentTypeOverride(ctXml: string, partName: string, contentType: string): string {
	const override = `<Override PartName="/${partName}" ContentType="${contentType}"/>`;
	return ctXml.replace('</Types>', `${override}</Types>`);
}

export async function generateChartFixture(): Promise<string> {
	// 1. Build a valid base deck skeleton: one slide per chart, each with a tiny
	//    anchor shape so the engine emits proper slide + .rels parts.
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Chart Gallery Fixture',
		initialSlideCount: 0,
	});
	for (const slide of CHART_SLIDES) {
		data.slides.push(
			createSlide('Blank')
				.addShape('rect', {
					x: 0,
					y: 0,
					width: 1,
					height: 1,
					fill: { type: 'none' },
					text: slide.title,
				})
				.build(),
		);
	}
	const baseBytes = await handler.save(data.slides);

	// 2. Re-open and inject chart parts + frames + rels + content-types.
	const zip = await JSZip.loadAsync(baseBytes);

	let contentTypes = await zip.file('[Content_Types].xml')!.async('string');

	for (let i = 0; i < CHART_SLIDES.length; i++) {
		const slide = CHART_SLIDES[i];
		const n = i + 1;
		const chartPartName = `ppt/charts/chart${n}.xml`;
		const slidePath = `ppt/slides/slide${n}.xml`;
		const relsPath = `ppt/slides/_rels/slide${n}.xml.rels`;
		const binding = bindingFor(slide);

		// Chart part.
		zip.file(chartPartName, chartXmlFor(slide));

		// Slide rels → chart (target is relative to ppt/slides/).
		const relsXml = await zip.file(relsPath)!.async('string');
		const { xml: newRels, rId } = addChartRel(relsXml, `../charts/chart${n}.xml`, binding.relType);
		zip.file(relsPath, newRels);

		// Slide spTree ← chart graphic frame.
		const slideXml = await zip.file(slidePath)!.async('string');
		const frame = chartGraphicFrameXml(binding, rId, 100 + n, `Chart ${n}`);
		zip.file(slidePath, injectGraphicFrame(slideXml, frame));

		// Content-type override.
		contentTypes = addContentTypeOverride(contentTypes, chartPartName, binding.contentType);
	}

	zip.file('[Content_Types].xml', contentTypes);

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'chart-gallery.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the format-painter generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-chart-fixture.ts');
if (invokedDirectly) {
	generateChartFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
