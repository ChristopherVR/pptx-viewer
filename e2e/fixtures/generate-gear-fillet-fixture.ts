/**
 * Generates `gear-fillet.pptx`: one slide with four `gear6`/`gear9` preset
 * shapes, each pair sharing a size and position column but differing only in
 * `adj2` (the tooth-to-root fillet guide, COM-verified range `0..5358` for
 * `gear6` and `0..2679` for `gear9`; see `preset-shape-definitions-gear6.ts`
 * / `-gear9.ts`), for `e2e/gear-fillet.spec.ts`.
 *
 * WHY a generated fixture: no deck in the corpus authors a gear preset with a
 * non-default `adj2` at all, so there is no ground truth exercising the
 * shared adjustment-aware clip-path path (`getResolvedShapeClipPathFor`,
 * consumed by every binding through `shape-geometry.ts`) for these two
 * presets specifically.
 *
 * Each shape carries a plain text label naming it, so the spec can pair
 * elements across the five bindings by text (`support/fingerprint`'s element
 * key) without depending on DOM order.
 *
 * Run with: bun run e2e/fixtures/generate-gear-fillet-fixture.ts
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { writeFixtureDeterministic } from './write-fixture';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip');

const EMU_PER_PT = 12700;
const SLIDE_W = 720 * EMU_PER_PT;
const SLIDE_H = 540 * EMU_PER_PT;

const rel = (id: string, type: string, target: string) =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

const xfrm = (x: number, y: number, w: number, h: number) =>
	`<a:xfrm><a:off x="${x * EMU_PER_PT}" y="${y * EMU_PER_PT}"/><a:ext cx="${w * EMU_PER_PT}" cy="${h * EMU_PER_PT}"/></a:xfrm>`;

const txBody = (label: string) =>
	`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1200"/><a:t>${label}</a:t></a:r></a:p></p:txBody>`;

/** A `gear6`/`gear9` preset shape with an explicit `adj1`/`adj2` pair. */
function gearShape(options: {
	id: number;
	name: string;
	prst: 'gear6' | 'gear9';
	x: number;
	y: number;
	size: number;
	adj1: number;
	adj2: number;
}): string {
	const { id, name, prst, x, y, size, adj1, adj2 } = options;
	const avLst = `<a:avLst><a:gd name="adj1" fmla="val ${adj1}"/><a:gd name="adj2" fmla="val ${adj2}"/></a:avLst>`;
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr>${xfrm(x, y, size, size)}<a:prstGeom prst="${prst}">${avLst}</a:prstGeom>` +
		`<a:solidFill><a:srgbClr val="4472C4"/></a:solidFill>` +
		`<a:ln w="9525"><a:solidFill><a:srgbClr val="1F3864"/></a:solidFill></a:ln></p:spPr>` +
		`${txBody(name)}</p:sp>`
	);
}

/** Names the spec pairs elements by (see its own `GEAR_LABELS`). */
export const GEAR_LABELS = {
	gear6Zero: 'Gear6 Adj2 Zero',
	gear6Large: 'Gear6 Adj2 Large',
	gear9Zero: 'Gear9 Adj2 Zero',
	gear9Large: 'Gear9 Adj2 Large',
} as const;

const SIZE = 200;
const body = [
	gearShape({
		id: 2,
		name: GEAR_LABELS.gear6Zero,
		prst: 'gear6',
		x: 40,
		y: 40,
		size: SIZE,
		adj1: 15000,
		adj2: 0,
	}),
	gearShape({
		id: 3,
		name: GEAR_LABELS.gear6Large,
		prst: 'gear6',
		x: 280,
		y: 40,
		size: SIZE,
		adj1: 15000,
		adj2: 5358,
	}),
	gearShape({
		id: 4,
		name: GEAR_LABELS.gear9Zero,
		prst: 'gear9',
		x: 40,
		y: 280,
		size: SIZE,
		adj1: 10000,
		adj2: 0,
	}),
	gearShape({
		id: 5,
		name: GEAR_LABELS.gear9Large,
		prst: 'gear9',
		x: 280,
		y: 280,
		size: SIZE,
		adj1: 10000,
		adj2: 2679,
	}),
].join('');

export async function generateGearFilletFixture(): Promise<string> {
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

	const out = fileURLToPath(new URL('./gear-fillet.pptx', import.meta.url));
	const bytes: Uint8Array = await zip.generateAsync({ type: 'uint8array' });
	await writeFixtureDeterministic(out, bytes);
	return out;
}

const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-gear-fillet-fixture.ts');
if (invokedDirectly) {
	generateGearFilletFixture()
		.then((p) => console.log(`wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
