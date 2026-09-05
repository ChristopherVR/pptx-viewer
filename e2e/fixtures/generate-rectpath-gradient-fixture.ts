/**
 * Generates `rectpath-gradient.pptx`: a single `a:custGeom` (freeform) shape
 * whose `a:gradFill` authors `a:path path="rect"` - PowerPoint's "shade toward
 * the shape's own rectangle" gradient, whose isolines are concentric squared
 * rectangles (a Chebyshev field), not circles.
 *
 * `packages/shared/src/render/path-gradient-rect.ts`'s `buildRectPathGradientSvg`
 * renders this as a small self-contained SVG of ~40 nested `<rect>` bands,
 * embedded as a `data:image/svg+xml,...` URI. React (which paints structured
 * custom geometry as an inline SVG rather than a CSS box) wraps that URI in an
 * SVG `<pattern><image>` paint server (`svg-gradient-rect-path.ts`); every
 * other binding paints the exact same URI as a plain CSS `background-image`
 * on the shape's own clipped box. Either way the URI's DECODED markup is
 * produced by the identical shared function, so it should be byte-identical
 * across all five - this fixture exists to pin exactly that.
 *
 * Run with: bun run e2e/fixtures/generate-rectpath-gradient-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeFixtureDeterministic } from './write-fixture';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip');

const __dirname = dirname(fileURLToPath(import.meta.url));

const EMU_PER_PX = 9525;
const SLIDE_W = 1280 * EMU_PER_PX;
const SLIDE_H = 720 * EMU_PER_PX;

/** Name of the one shape on the slide, for locating it without text content. */
export const RECTPATH_SHAPE_NAME = 'RectPathGradientShape';

const rel = (id: string, type: string, target: string): string =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

/** A freeform (`a:custGeom`) rectangle outline, in a 200000 x 200000 local space. */
function custGeomXml(): string {
	return (
		'<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="0" b="0"/>' +
		'<a:pathLst><a:path w="200000" h="200000">' +
		'<a:moveTo><a:pt x="0" y="0"/></a:moveTo>' +
		'<a:lnTo><a:pt x="200000" y="0"/></a:lnTo>' +
		'<a:lnTo><a:pt x="200000" y="200000"/></a:lnTo>' +
		'<a:lnTo><a:pt x="0" y="200000"/></a:lnTo>' +
		'<a:close/></a:path></a:pathLst></a:custGeom>'
	);
}

/** `a:gradFill` with `a:path path="rect"`: three colour stops, an inset `fillToRect`. */
function rectPathGradFillXml(): string {
	return (
		'<a:gradFill flip="none" rotWithShape="1">' +
		'<a:gsLst>' +
		'<a:gs pos="0"><a:srgbClr val="FF0000"/></a:gs>' +
		'<a:gs pos="50000"><a:srgbClr val="00FF00"/></a:gs>' +
		'<a:gs pos="100000"><a:srgbClr val="0000FF"/></a:gs>' +
		'</a:gsLst>' +
		'<a:path path="rect"><a:fillToRect l="30000" t="30000" r="30000" b="30000"/></a:path>' +
		'</a:gradFill>'
	);
}

function slideXml(): string {
	const x = 300 * EMU_PER_PX;
	const y = 150 * EMU_PER_PX;
	const w = 500 * EMU_PER_PX;
	const h = 350 * EMU_PER_PX;
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
		`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
		`xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
		`<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
		`<p:grpSpPr/>` +
		`<p:sp><p:nvSpPr><p:cNvPr id="2" name="${RECTPATH_SHAPE_NAME}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
		`${custGeomXml()}${rectPathGradFillXml()}` +
		`<a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>` +
		`</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
	);
}

export async function generateRectPathGradientFixture(): Promise<string> {
	const zip = new JSZip();
	zip.file(
		'[Content_Types].xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
			`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
			`<Default Extension="xml" ContentType="application/xml"/>` +
			`<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
			`<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
			`<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
			`<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
			`<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>` +
			`</Types>`,
	);
	zip.file(
		'_rels/.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'ppt/presentation.xml')}</Relationships>`,
	);
	zip.file(
		'ppt/presentation.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
			`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
			`xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
			`<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
			`<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>` +
			`<p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/></p:presentation>`,
	);
	zip.file(
		'ppt/_rels/presentation.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml')}${rel('rId2', 'slide', 'slides/slide1.xml')}</Relationships>`,
	);
	zip.file(
		'ppt/theme/theme1.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T"><a:themeElements>` +
			`<a:clrScheme name="T"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>` +
			`<a:dk2><a:srgbClr val="000000"/></a:dk2><a:lt2><a:srgbClr val="FFFFFF"/></a:lt2>` +
			`<a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
			`<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
			`<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
			`<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>` +
			`<a:fontScheme name="T"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
			`<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
			`<a:fmtScheme name="T"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
			`<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>` +
			`<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>` +
			`<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>` +
			`<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>` +
			`<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>` +
			`<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>` +
			`<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
			`<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
	);
	zip.file(
		'ppt/slideMasters/slideMaster1.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
			`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
			`xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
			`<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` +
			`<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
			`<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" ` +
			`accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
			`<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
	);
	zip.file(
		'ppt/slideMasters/_rels/slideMaster1.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}${rel('rId2', 'theme', '../theme/theme1.xml')}</Relationships>`,
	);
	zip.file(
		'ppt/slideLayouts/slideLayout1.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
			`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
			`xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">` +
			`<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
			`<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
	);
	zip.file(
		'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')}</Relationships>`,
	);
	zip.file('ppt/slides/slide1.xml', slideXml());
	zip.file(
		'ppt/slides/_rels/slide1.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
			`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}</Relationships>`,
	);

	const outPath = resolve(__dirname, 'rectpath-gradient.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-rectpath-gradient-fixture.ts')) {
	generateRectPathGradientFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
