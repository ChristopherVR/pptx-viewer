/**
 * Generates `pattern-outline.pptx`: shapes whose OUTLINE is a preset pattern or
 * a gradient (`a:ln/a:pattFill`, `a:ln/a:gradFill`) rather than a solid colour.
 *
 * No deck in the corpus authored a patterned outline, so there was nothing to
 * regression-test the stroke-overlay renderer against. Slide 1 carries one shape
 * per case, each sized and positioned so a spec can address it by element id:
 *
 *   shape-0  rect,     `a:pattFill` `dkDnDiag`   (dark downward diagonal)
 *   shape-1  ellipse,  `a:pattFill` `smGrid`     (small grid, on a round outline)
 *   shape-2  rect,     `a:gradFill` two-tone     (control: the gradient path)
 *   shape-3  rect,     `a:solidFill` + `algn="in"` (control: keeps its CSS
 *                                               border; PowerPoint's default
 *                                               `a:ln/@algn` is `ctr` - stroke
 *                                               centred on the path - which even
 *                                               a solid line now paints through
 *                                               the shared SVG stroke overlay,
 *                                               so this control declares the
 *                                               inset alignment explicitly to
 *                                               keep testing the cheap CSS path)
 *
 * Run with: bun run e2e/fixtures/generate-pattern-outline-fixture.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';

const EMU_PER_PT = 12700;
const SLIDE_W = 720 * EMU_PER_PT;
const SLIDE_H = 405 * EMU_PER_PT;

const rel = (id: string, type: string, target: string) =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

/** One shape: geometry + the `a:ln` under test. */
interface Spec {
	name: string;
	prst: string;
	x: number;
	y: number;
	line: string;
}

const PATTERN = (prst: string) =>
	`<a:ln w="76200"><a:pattFill prst="${prst}"><a:fgClr><a:srgbClr val="1F4E79"/></a:fgClr><a:bgClr><a:srgbClr val="FFF2CC"/></a:bgClr></a:pattFill></a:ln>`;

const SPECS: Spec[] = [
	{ name: 'pattern-dkDnDiag', prst: 'rect', x: 40, y: 40, line: PATTERN('dkDnDiag') },
	{ name: 'pattern-smGrid', prst: 'ellipse', x: 260, y: 40, line: PATTERN('smGrid') },
	{
		name: 'gradient-outline',
		prst: 'rect',
		x: 40,
		y: 220,
		line: `<a:ln w="76200"><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FF0000"/></a:gs><a:gs pos="100000"><a:srgbClr val="0000FF"/></a:gs></a:gsLst><a:lin ang="0" scaled="1"/></a:gradFill></a:ln>`,
	},
	{
		name: 'solid-outline',
		prst: 'rect',
		x: 260,
		y: 220,
		// `algn="in"` (PowerPoint's inset pen alignment) is explicit here: an
		// omitted `@algn` defaults to `ctr` and now legitimately routes even a
		// solid line through the SVG stroke overlay (see
		// `line-fill-parity.spec.ts`'s `compound-sng` case for that path), so
		// this control needs the declared alignment to still exercise the plain
		// CSS `border` path it is named for.
		line: `<a:ln w="76200" algn="in"><a:solidFill><a:srgbClr val="00B050"/></a:solidFill></a:ln>`,
	},
];

const shapeXml = (spec: Spec, index: number) =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${index + 2}" name="${spec.name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${
		spec.x * EMU_PER_PT
	}" y="${spec.y * EMU_PER_PT}"/><a:ext cx="${180 * EMU_PER_PT}" cy="${
		140 * EMU_PER_PT
	}"/></a:xfrm><a:prstGeom prst="${
		spec.prst
	}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>${
		spec.line
	}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;

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
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${SPECS.map(
		shapeXml,
	).join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
);
zip.file(
	'ppt/slides/_rels/slide1.xml.rels',
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}</Relationships>`,
);

const out = fileURLToPath(new URL('./pattern-outline.pptx', import.meta.url));
writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer' }));
console.log(`wrote ${out} with ${SPECS.length} shapes: ${SPECS.map((s) => s.name).join(', ')}`);
