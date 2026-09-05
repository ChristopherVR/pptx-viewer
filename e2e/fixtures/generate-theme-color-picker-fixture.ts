/**
 * Generates `theme-color-picker.pptx`: one slide, one rectangle, and a theme
 * whose `accent1` is a distinctive, easily-recognised green (`#2E7D32`) rather
 * than the Office default blue - so a spec that clicks the "Accent 1, Lighter
 * 80%" swatch (`packages/shared/src/render/theme-color-swatches.ts`'s
 * `describeThemeColorSwatch`) can tell a genuinely theme-resolved colour apart
 * from a hard-coded Office palette a binding might paint instead.
 *
 * `THEME_COLOR_MAP` mirrors the raw `a:clrScheme` this fixture authors (the
 * slide master's `p:clrMap` below is the identity mapping, same as every other
 * hand-authored fixture in this directory), so a spec can feed it straight
 * into `buildThemeColorSwatchGrid` from `pptx-viewer-shared` to compute the
 * exact resolved hex a swatch pick must produce, without hand-deriving the
 * lumMod/lumOff maths itself.
 *
 * Run with: bun run e2e/fixtures/generate-theme-color-picker-fixture.ts
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
export const THEME_SHAPE_NAME = 'ThemeShape';
/** The shape's authored (pre-edit) fill, distinct from every theme swatch. */
export const THEME_SHAPE_INITIAL_FILL = 'FF00FF';
/** A custom hex a spec picks AFTER the theme swatch, to prove `a:srgbClr` still saves. */
export const THEME_SHAPE_CUSTOM_HEX = '#123456';

/**
 * The raw `a:clrScheme` this fixture's theme authors, keyed exactly as
 * `PptxData.themeColorMap` resolves it (the master's `p:clrMap` below is the
 * identity mapping). Feed straight into `buildThemeColorSwatchGrid`.
 */
export const THEME_COLOR_MAP: Readonly<Record<string, string>> = {
	dk1: '000000',
	lt1: 'FFFFFF',
	dk2: '1F2937',
	lt2: 'F3F4F6',
	accent1: '2E7D32',
	accent2: 'C2410C',
	accent3: '6B7280',
	accent4: 'CA8A04',
	accent5: '0EA5E9',
	accent6: '9333EA',
	hlink: '2563EB',
	folHlink: '7C3AED',
};

const rel = (id: string, type: string, target: string): string =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

function clrSchemeXml(): string {
	const c = THEME_COLOR_MAP;
	return (
		`<a:clrScheme name="T">` +
		`<a:dk1><a:srgbClr val="${c.dk1}"/></a:dk1>` +
		`<a:lt1><a:srgbClr val="${c.lt1}"/></a:lt1>` +
		`<a:dk2><a:srgbClr val="${c.dk2}"/></a:dk2>` +
		`<a:lt2><a:srgbClr val="${c.lt2}"/></a:lt2>` +
		`<a:accent1><a:srgbClr val="${c.accent1}"/></a:accent1>` +
		`<a:accent2><a:srgbClr val="${c.accent2}"/></a:accent2>` +
		`<a:accent3><a:srgbClr val="${c.accent3}"/></a:accent3>` +
		`<a:accent4><a:srgbClr val="${c.accent4}"/></a:accent4>` +
		`<a:accent5><a:srgbClr val="${c.accent5}"/></a:accent5>` +
		`<a:accent6><a:srgbClr val="${c.accent6}"/></a:accent6>` +
		`<a:hlink><a:srgbClr val="${c.hlink}"/></a:hlink>` +
		`<a:folHlink><a:srgbClr val="${c.folHlink}"/></a:folHlink>` +
		`</a:clrScheme>`
	);
}

function themeXml(): string {
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
		`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T">` +
		`<a:themeElements>${clrSchemeXml()}` +
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
		`<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`
	);
}

function slideXml(): string {
	const x = 400 * EMU_PER_PX;
	const y = 250 * EMU_PER_PX;
	const w = 480 * EMU_PER_PX;
	const h = 270 * EMU_PER_PX;
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
		`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
		`xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
		`<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
		`<p:grpSpPr/>` +
		`<p:sp><p:nvSpPr><p:cNvPr id="2" name="${THEME_SHAPE_NAME}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
		`<a:solidFill><a:srgbClr val="${THEME_SHAPE_INITIAL_FILL}"/></a:solidFill>` +
		`<a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>` +
		`</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
	);
}

export async function generateThemeColorPickerFixture(): Promise<string> {
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
	zip.file('ppt/theme/theme1.xml', themeXml());
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

	const outPath = resolve(__dirname, 'theme-color-picker.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-theme-color-picker-fixture.ts')) {
	generateThemeColorPickerFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
