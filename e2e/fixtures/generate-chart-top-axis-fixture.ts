import { mkdirSync } from 'node:fs';
/**
 * Generates `chart-top-axis.pptx`: a single-slide deck with one bar chart that
 * reproduces a real-world construct found in a user-supplied deck (slide 20 of
 * a `ppt/charts/chart2.xml` part):
 *
 *   - `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/>` with ONE
 *     series and several categories.
 *   - `<c:catAx>` is the chart's ONLY category axis and carries
 *     `<c:axPos val="t"/>`: PowerPoint draws its tick labels ABOVE the plot,
 *     not below. This is not a secondary-category-axis combo (there is no
 *     bottom `c:catAx` counterpart), it is the primary axis relocated.
 *   - `<c:valAx><c:scaling><c:orientation val="maxMin"/>`: the value axis is
 *     reversed (0 at the top, growing downward), which combined with the top
 *     category axis makes the bars visually hang down from the labels.
 *   - `<c:chartSpace>` carries NO `<c:spPr>` at all (the common case: only a
 *     deliberately re-styled chart writes one), and `<c:plotArea>`'s own
 *     `<c:spPr>` is `<a:ln><a:noFill/></a:ln>` with no fill element. Real
 *     PowerPoint renders both fully transparent.
 *
 * Two real bugs reproduced by this construct, both fixed in
 * `packages/shared/src/render`:
 *   1. Category-axis label clipping: `computePlotLayout` reserved the
 *      category-label band at the BOTTOM of the plot unconditionally, so a
 *      top-positioned axis's labels had no reserved space above the plot and
 *      clipped against the chart SVG's own top edge (chart-view-model-layout.ts,
 *      chart-axis.ts's `isPrimaryCategoryAxisAtTop`/`computeLayoutOptions`).
 *   2. Grey plot background: `chartAreaFill` painted a synthetic
 *      `#0f172a11` wash whenever `c:chartSpace` had no `c:spPr`, which is not
 *      what PowerPoint renders (chart-area-fill.ts).
 *
 * Used by `chart-top-axis.spec.ts` for a framework-neutral regression check
 * across all five bindings.
 *
 * WHY a generated fixture instead of committing the real user deck: the
 * source deck is personal content unrelated to this repo; this fixture
 * reproduces only the OOXML construct that triggers the bug, with synthetic
 * data.
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

export const CHART_TOP_AXIS_TITLE = 'Top Axis Bar';
export const CHART_TOP_AXIS_CATEGORIES = [
	'PART 1',
	'PART 2',
	'PART 3',
	'PART 4',
	'PART 5',
	'PART 6',
	'PART 7',
	'PART 8',
] as const;
const VALUES = [3, 5, 7, 9, 8, 5, 8, 5] as const;

const CAT_AX_ID = 38396416;
const VAL_AX_ID = 36333824;

/**
 * The chart XML part, matching the real-world shape as closely as practical:
 * single series, top-positioned (and only) category axis, reversed value
 * axis, no `c:chartSpace/c:spPr`, and a `c:plotArea/c:spPr` that declares a
 * line style but no fill.
 */
function chartXml(): string {
	const catPts = CHART_TOP_AXIS_CATEGORIES.map(
		(v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`,
	).join('');
	const valPts = VALUES.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
		`xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
		`<c:chart><c:autoTitleDeleted val="1"/>` +
		`<c:plotArea><c:layout/>` +
		`<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
		`<c:ser><c:idx val="0"/><c:order val="0"/>` +
		`<c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0">` +
		`<c:v>${CHART_TOP_AXIS_TITLE}</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
		`<c:spPr><a:solidFill><a:srgbClr val="00B0F0"/></a:solidFill></c:spPr>` +
		`<c:invertIfNegative val="0"/>` +
		`<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$${CHART_TOP_AXIS_CATEGORIES.length + 1}</c:f>` +
		`<c:strCache><c:ptCount val="${CHART_TOP_AXIS_CATEGORIES.length}"/>${catPts}</c:strCache></c:strRef></c:cat>` +
		`<c:val><c:numRef><c:f>Sheet1!$B$2:$B$${VALUES.length + 1}</c:f>` +
		`<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${VALUES.length}"/>${valPts}</c:numCache></c:numRef></c:val>` +
		`</c:ser>` +
		`<c:gapWidth val="150"/><c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:barChart>` +
		// The ONLY category axis, positioned at the TOP - the construct under test.
		`<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="t"/><c:numFmt formatCode="General" sourceLinked="0"/>` +
		`<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
		`<c:crossAx val="${VAL_AX_ID}"/><c:crosses val="autoZero"/><c:auto val="1"/>` +
		`<c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
		// The value axis is REVERSED (maxMin): 0 at the top, growing downward.
		`<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="maxMin"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="l"/><c:numFmt formatCode="General" sourceLinked="1"/>` +
		`<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
		`<c:crossAx val="${CAT_AX_ID}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>` +
		`<c:majorUnit val="1"/></c:valAx>` +
		// `c:plotArea/c:spPr` declares a line style but NO fill element at all:
		// per spec this means transparent, not a default grey wash.
		`<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>` +
		`</c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
		// No `c:spPr` on `c:chartSpace` at all (the common, deliberately-unstyled
		// case): real PowerPoint renders this fully transparent too.
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

export async function generateChartTopAxisFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Chart Top Axis Fixture',
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
				text: CHART_TOP_AXIS_TITLE,
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
	const outPath = resolve(__dirname, 'chart-top-axis.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-chart-top-axis-fixture.ts');
if (invokedDirectly) {
	generateChartTopAxisFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
