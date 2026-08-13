/**
 * Generates `canvas-interaction.pptx`: one slide holding the four shapes the
 * on-canvas direct-manipulation contract needs, for `canvas-interaction.spec.ts`.
 *
 * WHY a generated fixture: no deck in the corpus authors the three things this
 * spec asserts, and each of them is invisible unless the deck states it.
 *
 *  - "Box A" and "Box B" joined by a `p:cxnSp` that carries real `a:stCxn` /
 *    `a:endCxn` bindings. `connector-arrows.pptx` has connectors but no
 *    bindings, so dragging a shape there proves nothing. Note the binding is by
 *    `p:cNvPr/@id` ("2", "3"), which is how PowerPoint spells it and is NOT the
 *    viewer's own element id.
 *  - "Rounded", a `roundRect` with an explicit `a:avLst/a:gd name="adj"`: one
 *    adjustable parameter, so exactly one amber adjust handle.
 *  - "Arrow", a `rightArrow`: TWO adjustable parameters (`adj1` the shaft
 *    thickness, `adj2` the head length), so it must offer two handles. Shared
 *    used to return a single descriptor for every shape, so a preset's second
 *    and later guides were unreachable in all five bindings.
 *  - "Pinned", carrying `a:spLocks noMove/noResize/noRot`. It stays selectable
 *    (so a user can unlock it) but must refuse every geometry gesture.
 *
 * Run with: bun run e2e/fixtures/generate-canvas-interaction-fixture.ts
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip');

const EMU_PER_PT = 12700;
const SLIDE_W = 720 * EMU_PER_PT;
const SLIDE_H = 405 * EMU_PER_PT;

const rel = (id: string, type: string, target: string) =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

const xfrm = (x: number, y: number, w: number, h: number) =>
	`<a:xfrm><a:off x="${x * EMU_PER_PT}" y="${y * EMU_PER_PT}"/><a:ext cx="${w * EMU_PER_PT}" cy="${h * EMU_PER_PT}"/></a:xfrm>`;

const txBody = (label: string) =>
	`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1400"/><a:t>${label}</a:t></a:r></a:p></p:txBody>`;

/** A preset shape. `locks` goes on `p:cNvSpPr`, `avLst` inside `a:prstGeom`. */
const shape = (options: {
	id: number;
	name: string;
	prst: string;
	x: number;
	y: number;
	w: number;
	h: number;
	fill: string;
	locks?: string;
	avLst?: string;
}) =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${options.id}" name="${options.name}"/><p:cNvSpPr>${
		options.locks ?? ''
	}</p:cNvSpPr><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(options.x, options.y, options.w, options.h)}<a:prstGeom prst="${
		options.prst
	}">${
		options.avLst ?? '<a:avLst/>'
	}</a:prstGeom><a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="1F3864"/></a:solidFill></a:ln></p:spPr>${txBody(options.name)}</p:sp>`;

/**
 * A connector bound to two shapes. `a:stCxn/@idx` indexes the target's
 * connection sites, which for a plain rectangle are top / right / bottom / left
 * in that order: idx 2 leaves Box A's bottom edge, idx 0 arrives at Box B's top.
 */
const connector = (
	id: number,
	name: string,
	startId: number,
	startIdx: number,
	endId: number,
	endIdx: number,
	x: number,
	y: number,
	w: number,
	h: number,
) =>
	`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr><a:stCxn id="${startId}" idx="${startIdx}"/><a:endCxn id="${endId}" idx="${endIdx}"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm(
		x,
		y,
		w,
		h,
	)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="28575"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`;

// Box A bottom-centre is (130, 130); Box B top-centre is (490, 240). The
// connector's authored box is exactly that span, so the spec's "before"
// measurement already agrees with the bindings' own routing.
const body = [
	shape({ id: 2, name: 'Box A', prst: 'rect', x: 60, y: 60, w: 140, h: 70, fill: 'DDEBF7' }),
	shape({ id: 3, name: 'Box B', prst: 'rect', x: 420, y: 240, w: 140, h: 70, fill: 'DDEBF7' }),
	connector(4, 'Link', 2, 2, 3, 0, 130, 130, 360, 110),
	shape({
		id: 5,
		name: 'Rounded',
		prst: 'roundRect',
		x: 60,
		y: 250,
		w: 220,
		h: 110,
		fill: 'FFF2CC',
		avLst: '<a:avLst><a:gd name="adj" fmla="val 16667"/></a:avLst>',
	}),
	shape({
		id: 7,
		name: 'Arrow',
		prst: 'rightArrow',
		x: 320,
		y: 250,
		w: 220,
		h: 110,
		fill: 'E2EFDA',
	}),
	shape({
		id: 6,
		name: 'Pinned',
		prst: 'rect',
		x: 420,
		y: 60,
		w: 140,
		h: 70,
		fill: 'F8CBAD',
		locks: '<a:spLocks noMove="1" noResize="1" noRot="1"/>',
	}),
].join('');

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

const out = fileURLToPath(new URL('./canvas-interaction.pptx', import.meta.url));
writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer' }));
console.log(`wrote ${out}`);
