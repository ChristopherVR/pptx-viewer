/**
 * Generates `connection-sites.pptx`: two shape+connector pairs, for
 * `connector-connection-sites.spec.ts`.
 *
 * `p:cxnSp` connectors only re-resolve their bound endpoint against
 * `getShapeConnectionSites` when the target shape actually MOVES (see
 * `packages/shared/src/render/connector-reroute.ts`); the authored `a:xfrm` on
 * a freshly-loaded connector is otherwise just carried verbatim. So each pair
 * here starts with a connector whose OWN authored box already matches the true
 * site (a passive load proves nothing about the site math), and the spec drags
 * the anchor shape to force a reroute, which is what actually calls
 * `getShapeConnectionSites`.
 *
 *  - "Triangle Anchor": a default (`adj=50000`, isosceles) `triangle`. Site
 *    index 0 is its ECMA `cxnLst` apex, which sits at `x = left + width/2` -
 *    the historical bug used HALF that offset (`w/4`, off-centre), so this is
 *    a real regression guard, not a tautology.
 *  - "ChartPlus Anchor": a `chartPlus` mark, whose preset has NO `cxnLst` at
 *    all (see `preset-connection-sites-table.ts`), so site index 1 must fall
 *    back to the plain 4-cardinal box (index order: top, left, bottom, right),
 *    landing at `x = left, y = top + height/2`.
 *
 * Each connector's far end is left UNBOUND (no `a:endCxn`), so rerouting only
 * ever moves the bound end; the spec drags the anchor DOWN-RIGHT, keeping it
 * left-of/above the fixed far corner so the connector's on-screen top-left
 * corner is exactly the resolved site (see `computeConnectorGeometry`).
 *
 * Run with: bun run e2e/fixtures/generate-connection-sites-fixture.ts
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip');

const EMU_PER_PX = 9525;
const SLIDE_W = 1280 * EMU_PER_PX;
const SLIDE_H = 720 * EMU_PER_PX;

const rel = (id: string, type: string, target: string) =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

const xfrm = (x: number, y: number, w: number, h: number) =>
	`<a:xfrm><a:off x="${x * EMU_PER_PX}" y="${y * EMU_PER_PX}"/><a:ext cx="${w * EMU_PER_PX}" cy="${h * EMU_PER_PX}"/></a:xfrm>`;

const txBody = (label: string) =>
	`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1200"/><a:t>${label}</a:t></a:r></a:p></p:txBody>`;

const shape = (options: {
	id: number;
	name: string;
	prst: string;
	x: number;
	y: number;
	w: number;
	h: number;
	fill: string;
}) =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${options.id}" name="${options.name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
	`<p:spPr>${xfrm(options.x, options.y, options.w, options.h)}<a:prstGeom prst="${options.prst}"><a:avLst/></a:prstGeom>` +
	`<a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="1F3864"/></a:solidFill></a:ln></p:spPr>${txBody(options.name)}</p:sp>`;

/** A connector bound to ONE shape (`stCxn` only); its far end is a fixed point. */
const connector = (
	id: number,
	name: string,
	startId: number,
	startIdx: number,
	x: number,
	y: number,
	w: number,
	h: number,
) =>
	`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr><a:stCxn id="${startId}" idx="${startIdx}"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr>` +
	`<p:spPr>${xfrm(x, y, w, h)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>` +
	'<a:ln w="19050"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>';

// Triangle Anchor: box (60,60,200,120) -> apex (default adj) at (160,60).
// Far end fixed at (560,420): connector xfrm x=160,y=60,w=400,h=360.
const trianglePair = [
	shape({
		id: 2,
		name: 'Triangle Anchor',
		prst: 'triangle',
		x: 60,
		y: 60,
		w: 200,
		h: 120,
		fill: 'DDEBF7',
	}),
	connector(3, 'Tri Link', 2, 0, 160, 60, 400, 360),
].join('');

// ChartPlus Anchor: box (700,60,160,160) -> idx 1 (left-centre, 4-cardinal
// fallback) at (700,140). Far end fixed at (1180,460): connector
// xfrm x=700,y=140,w=480,h=320.
const chartPlusPair = [
	shape({
		id: 4,
		name: 'ChartPlus Anchor',
		prst: 'chartPlus',
		x: 700,
		y: 60,
		w: 160,
		h: 160,
		fill: 'FCE4D6',
	}),
	connector(5, 'ChartPlus Link', 4, 1, 700, 140, 480, 320),
].join('');

const body = [trianglePair, chartPlusPair].join('');

const zip = new JSZip();
zip.file(
	'[Content_Types].xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
);
zip.file(
	'_rels/.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'ppt/presentation.xml')}</Relationships>`,
);
zip.file(
	'ppt/presentation.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/></p:presentation>`,
);
zip.file(
	'ppt/_rels/presentation.xml.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml')}${rel('rId2', 'slide', 'slides/slide1.xml')}</Relationships>`,
);
zip.file(
	'ppt/theme/theme1.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T"><a:themeElements><a:clrScheme name="T"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="000000"/></a:dk2><a:lt2><a:srgbClr val="FFFFFF"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="T"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="T"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
);
zip.file(
	'ppt/slideMasters/slideMaster1.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
);
zip.file(
	'ppt/slideMasters/_rels/slideMaster1.xml.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}${rel('rId2', 'theme', '../theme/theme1.xml')}</Relationships>`,
);
zip.file(
	'ppt/slideLayouts/slideLayout1.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
);
zip.file(
	'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')}</Relationships>`,
);
zip.file(
	'ppt/slides/slide1.xml',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
);
zip.file(
	'ppt/slides/_rels/slide1.xml.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}</Relationships>`,
);

const out = fileURLToPath(new URL('./connection-sites.pptx', import.meta.url));
writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer' }));
console.log(`wrote ${out}`);
