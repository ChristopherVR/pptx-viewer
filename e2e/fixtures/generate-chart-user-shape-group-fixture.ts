/**
 * Generates `chart-user-shape-group.pptx`: a one-slide deck with one bar
 * chart carrying a `c:userShapes` drawing overlay whose FIRST
 * `cdr:relSizeAnchor` wraps a `cdr:grpSp` of two `cdr:sp` text-box callouts
 * ("Alpha" / "Beta"), for the cross-binding `chart-user-shape-group.spec.ts`.
 *
 * WHY a generated fixture: no deck in the corpus (nor any prior e2e fixture)
 * exercises a GROUPED `c:userShapes` overlay shape at all; every existing
 * chart fixture either has no drawing overlay or (in unit tests only) a
 * synthetic in-memory one. This is the one place the shared `grpSp` inspector
 * tree (W2-F: `listChartUserShapeRows` / `withChartUserShapeRowUpdated` in
 * `pptx-viewer-shared`) gets exercised against a real, loadable `.pptx`.
 *
 * Two MORE anchors follow the Alpha/Beta group (top-level indices 1 and 2),
 * added for rotation/flip support (W5-Y): a standalone rotated `cdr:sp`
 * ("Gamma", `a:xfrm rot="1800000"` = 30deg, no `off`/`ext` of its own -
 * matching real PowerPoint's own markup for a rotated top-level overlay
 * shape, see `PptxChartUserShape.rotation`'s doc) and a `cdr:grpSp` whose OWN
 * `grpSpPr/a:xfrm` carries `rot="900000"` (15deg) around a single child
 * ("Delta") that fully occupies the group's box, so the group's rotation
 * composes onto Delta with no position shift (an exact, non-flaky assertion
 * target; see `chart-user-shapes-parser.test.ts`'s "fully occupies its box"
 * unit test for the same technique). Both sit in the chart's TOP band
 * (y in [0.02, 0.18]), clear of the Alpha/Beta group's lower band and the
 * plot area, so none of the pre-existing Alpha/Beta assertions are affected.
 *
 * Same two-step approach as `generate-chart-fixture.ts` (core's save
 * pipeline cannot author a brand-new chart part): build a blank one-slide
 * deck, then inject the chart part, its `c:userShapes` reference, the
 * drawing part, the chart-part relationship, and the content-type override
 * directly into the saved zip.
 *
 * Run with: bun run e2e/fixtures/generate-chart-user-shape-group-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type JSZipType from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { buildBarChartXml } from './chart-xml';
import { writeFixtureDeterministic } from './write-fixture';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

const __dirname = dirname(fileURLToPath(import.meta.url));

const CHART_USER_SHAPES_REL_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartUserShapes';
const CHART_USER_SHAPES_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml';
const CHART_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
const CHART_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

/**
 * The overlay drawing part: one `relSizeAnchor` wrapping a `grpSp` of two
 * text-box children, positioned in the chart's lower band (below the plot,
 * y in [0.6, 0.95]) so it never overlaps the bars. The group's `chOff`/
 * `chExt` deliberately match its `off`/`ext` (an identity transform, which
 * is enough for an e2e text-edit spec); the non-identity case is covered by
 * `chart-user-shapes-parser.test.ts`'s unit test instead.
 */
const DRAWING_XML =
	'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
	'<c:userShapes ' +
	'xmlns:cdr="http://schemas.openxmlformats.org/drawingml/2006/chartDrawing" ' +
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
	'<cdr:relSizeAnchor>' +
	'<cdr:from><cdr:x>0.1</cdr:x><cdr:y>0.6</cdr:y></cdr:from>' +
	'<cdr:to><cdr:x>0.9</cdr:x><cdr:y>0.95</cdr:y></cdr:to>' +
	'<cdr:grpSp>' +
	'<cdr:nvGrpSpPr><cdr:cNvPr id="2" name="Callout Group"/><cdr:cNvGrpSpPr/></cdr:nvGrpSpPr>' +
	'<cdr:grpSpPr><a:xfrm>' +
	'<a:off x="0" y="0"/><a:ext cx="1000000" cy="400000"/>' +
	'<a:chOff x="0" y="0"/><a:chExt cx="1000000" cy="400000"/>' +
	'</a:xfrm></cdr:grpSpPr>' +
	'<cdr:sp>' +
	'<cdr:nvSpPr><cdr:cNvPr id="3" name="Alpha Label"/><cdr:cNvSpPr/></cdr:nvSpPr>' +
	'<cdr:spPr>' +
	'<a:xfrm><a:off x="0" y="0"/><a:ext cx="500000" cy="400000"/></a:xfrm>' +
	'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
	'<a:solidFill><a:srgbClr val="FFFFCC"/></a:solidFill>' +
	'</cdr:spPr>' +
	'<cdr:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Alpha</a:t></a:r></a:p></cdr:txBody>' +
	'</cdr:sp>' +
	'<cdr:sp>' +
	'<cdr:nvSpPr><cdr:cNvPr id="4" name="Beta Label"/><cdr:cNvSpPr/></cdr:nvSpPr>' +
	'<cdr:spPr>' +
	'<a:xfrm><a:off x="500000" y="0"/><a:ext cx="500000" cy="400000"/></a:xfrm>' +
	'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
	'<a:solidFill><a:srgbClr val="CCFFCC"/></a:solidFill>' +
	'</cdr:spPr>' +
	'<cdr:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Beta</a:t></a:r></a:p></cdr:txBody>' +
	'</cdr:sp>' +
	'</cdr:grpSp>' +
	'<cdr:clientData/>' +
	'</cdr:relSizeAnchor>' +
	// Standalone rotated leaf ("Gamma"): a top-level anchor's OWN a:xfrm
	// carries only rot (no off/ext), matching real PowerPoint's markup for a
	// rotated overlay shape (see this module's doc, and the COM-verified
	// ground truth in `chart-user-shapes-serializer.ts`'s doc).
	'<cdr:relSizeAnchor>' +
	'<cdr:from><cdr:x>0.1</cdr:x><cdr:y>0.02</cdr:y></cdr:from>' +
	'<cdr:to><cdr:x>0.35</cdr:x><cdr:y>0.15</cdr:y></cdr:to>' +
	'<cdr:sp>' +
	'<cdr:nvSpPr><cdr:cNvPr id="5" name="Gamma Label"/><cdr:cNvSpPr/></cdr:nvSpPr>' +
	'<cdr:spPr>' +
	'<a:xfrm rot="1800000"/>' +
	'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
	'<a:solidFill><a:srgbClr val="FFCCCC"/></a:solidFill>' +
	'</cdr:spPr>' +
	'<cdr:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Gamma</a:t></a:r></a:p></cdr:txBody>' +
	'</cdr:sp>' +
	'<cdr:clientData/>' +
	'</cdr:relSizeAnchor>' +
	// Rotated group ("Delta"): the group's OWN grpSpPr/a:xfrm carries rot;
	// Delta fully occupies the group's own box (off/ext == chOff/chExt), so
	// the composed rotation lands on Delta with no position shift.
	'<cdr:relSizeAnchor>' +
	'<cdr:from><cdr:x>0.65</cdr:x><cdr:y>0.02</cdr:y></cdr:from>' +
	'<cdr:to><cdr:x>0.9</cdr:x><cdr:y>0.15</cdr:y></cdr:to>' +
	'<cdr:grpSp>' +
	'<cdr:nvGrpSpPr><cdr:cNvPr id="6" name="Rotated Group"/><cdr:cNvGrpSpPr/></cdr:nvGrpSpPr>' +
	'<cdr:grpSpPr><a:xfrm rot="900000">' +
	'<a:off x="0" y="0"/><a:ext cx="1000000" cy="1000000"/>' +
	'<a:chOff x="0" y="0"/><a:chExt cx="1000000" cy="1000000"/>' +
	'</a:xfrm></cdr:grpSpPr>' +
	'<cdr:sp>' +
	'<cdr:nvSpPr><cdr:cNvPr id="7" name="Delta Label"/><cdr:cNvSpPr/></cdr:nvSpPr>' +
	'<cdr:spPr>' +
	'<a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="1000000"/></a:xfrm>' +
	'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
	'<a:solidFill><a:srgbClr val="CCCCFF"/></a:solidFill>' +
	'</cdr:spPr>' +
	'<cdr:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Delta</a:t></a:r></a:p></cdr:txBody>' +
	'</cdr:sp>' +
	'</cdr:grpSp>' +
	'<cdr:clientData/>' +
	'</cdr:relSizeAnchor>' +
	'</c:userShapes>';

/** Add one relationship to a `.rels` XML string, returning the new rId. */
function addRel(relsXml: string, target: string, relType: string): { xml: string; rId: string } {
	const ids = [...relsXml.matchAll(/Id="rId(?<n>\d+)"/gu)].map((m) =>
		Number.parseInt(m.groups?.n ?? '0', 10),
	);
	const rId = `rId${(ids.length > 0 ? Math.max(...ids) : 0) + 1}`;
	const rel = `<Relationship Id="${rId}" Type="${relType}" Target="${target}"/>`;
	return { xml: relsXml.replace('</Relationships>', `${rel}</Relationships>`), rId };
}

function addContentTypeOverride(ctXml: string, partName: string, contentType: string): string {
	return ctXml.replace(
		'</Types>',
		`<Override PartName="/${partName}" ContentType="${contentType}"/></Types>`,
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

function chartGraphicFrameXml(rId: string): string {
	const x = 60 * 9525;
	const y = 60 * 9525;
	const cx = 840 * 9525;
	const cy = 420 * 9525;
	return (
		`<p:graphicFrame><p:nvGraphicFramePr>` +
		`<p:cNvPr id="2" name="Chart 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
		`<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>` +
		`</a:graphicData></a:graphic></p:graphicFrame>`
	);
}

export async function generateChartUserShapeGroupFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Chart User-Shape Group Fixture',
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
				text: 'Grouped Overlay',
			})
			.build(),
	);
	const baseBytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(baseBytes);

	// Chart part, with a `c:userShapes` reference appended before the closing tag.
	const chartXml = buildBarChartXml(
		{
			title: 'Grouped Overlay',
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [4, 6], colorHex: '4472C4' }],
		},
		'clustered',
	).replace('</c:chartSpace>', '<c:userShapes r:id="rId1"/></c:chartSpace>');
	zip.file('ppt/charts/chart1.xml', chartXml);
	zip.file(
		'ppt/charts/_rels/chart1.xml.rels',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
			`<Relationship Id="rId1" Type="${CHART_USER_SHAPES_REL_TYPE}" Target="../drawings/drawing1.xml"/>` +
			'</Relationships>',
	);

	// Drawing overlay part.
	zip.file('ppt/drawings/drawing1.xml', DRAWING_XML);

	// Slide -> chart relationship + graphic frame.
	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	const { xml: newRels, rId } = addRel(relsXml, '../charts/chart1.xml', CHART_REL_TYPE);
	zip.file(relsPath, newRels);

	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	zip.file(slidePath, injectGraphicFrame(slideXml, chartGraphicFrameXml(rId)));

	// Content-type overrides for both new parts.
	let contentTypes = await zip.file('[Content_Types].xml')!.async('string');
	contentTypes = addContentTypeOverride(contentTypes, 'ppt/charts/chart1.xml', CHART_CONTENT_TYPE);
	contentTypes = addContentTypeOverride(
		contentTypes,
		'ppt/drawings/drawing1.xml',
		CHART_USER_SHAPES_CONTENT_TYPE,
	);
	zip.file('[Content_Types].xml', contentTypes);

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'chart-user-shape-group.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	// handler is unused beyond producing `baseBytes`; nothing to release.
	void handler;
	return outPath;
}

const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-chart-user-shape-group-fixture.ts');
if (invokedDirectly) {
	generateChartUserShapeGroupFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
