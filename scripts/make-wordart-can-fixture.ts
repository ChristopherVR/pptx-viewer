import { mkdir, writeFile } from 'node:fs/promises';
/**
 * Generates the WordArt `can` measurement deck used by
 * `measure-wordart-can-com.ps1` (PowerPoint COM ground truth) and
 * `measure-wordart-can-viewer.mjs` (headless viewer render + ink-mask score).
 * See docs/guide/visual-effects.md "WordArt envelope glyph-outline warping".
 *
 * One WordArt text box per slide, black bold text on white, so every slide's
 * ink mask is exactly one warped caption. The sweep is
 *   font   x preset x adj x string
 * where the fonts pick the outline source the viewer uses:
 *   - `Noto Sans` (a Google Fonts catalogue family), `Verdana` (no catalogue
 *     entry) and `Arial` (catalogue metric clone Arimo). All three are
 *     installed on Windows, so in this deck the viewer fetches no webfont for
 *     them and every glyph takes the traced-outline path
 *     (`text-warp-glyph-trace.ts`) over the very glyphs PowerPoint draws.
 *   - `embed-wordart-can-fonts-com.ps1` re-saves the deck with PowerPoint's
 *     "embed fonts" on; that copy drives the parsed font-file outline path
 *     for every face PowerPoint embeds (Noto Sans and Verdana; PowerPoint
 *     does not embed Arial).
 * A few `textInflate`/`textDeflate` slides (Arial) follow as controls.
 * `adj` values sit inside each preset's own `pin` range (`textCanUp` pins to
 * [66667, 100000], `textCanDown` to [0, 33333]): an out-of-range value is
 * silently clamped, so e.g. 15000 and 50000 render identically on `textCanUp`.
 *
 * `stems` mode instead writes a dense `adj` sweep of an 8-stem `IIIIIIII`
 * caption (Arial), for locating each stem's top and bottom ink edge directly.
 *
 *   bun run scripts/make-wordart-can-fixture.ts <outDir> [stems]
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const outDir = resolve(process.argv[2] ?? '.');
const stems = process.argv[3] === 'stems';
const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as new () => import('jszip');

const EMU_PER_PT = 12700;
const SLIDE_W_PT = 720;
const SLIDE_H_PT = 405;
const BOX = { x: 60, y: 60, w: 600, h: 285 };

export const FONTS = ['Noto Sans', 'Verdana', 'Arial'] as const;
export const CASES: { prst: string; adj: number }[] = [
	{ prst: 'textCanUp', adj: 66667 },
	{ prst: 'textCanUp', adj: 80000 },
	{ prst: 'textCanUp', adj: 92000 },
	{ prst: 'textCanDown', adj: 8000 },
	{ prst: 'textCanDown', adj: 20000 },
	{ prst: 'textCanDown', adj: 33333 },
];
export const STRINGS = ['WORDART', 'Hamburgefonts'] as const;
/** Non-can envelope controls (Arial only), so a can-driven law change is checked against them. */
export const CONTROL_CASES: { prst: string; adj: number }[] = [
	{ prst: 'textInflate', adj: 10000 },
	{ prst: 'textInflate', adj: 20000 },
	{ prst: 'textDeflate', adj: 18750 },
	{ prst: 'textDeflate', adj: 37500 },
];

interface SlideSpec {
	index: number;
	font: string;
	prst: string;
	adj: number;
	text: string;
}

const slides: SlideSpec[] = [];
const STEM_ADJ = {
	textCanUp: [66667, 70000, 73333, 76667, 80000, 83333, 86667, 90000, 93333, 96667],
	textCanDown: [3333, 6667, 10000, 13333, 16667, 20000, 23333, 26667, 30000, 33333],
};
for (const [prst, adjs] of Object.entries(stems ? STEM_ADJ : {})) {
	for (const adj of adjs) {
		slides.push({ index: slides.length + 1, font: 'Arial', prst, adj, text: 'IIIIIIII' });
	}
}
for (const font of stems ? [] : FONTS) {
	for (const c of CASES) {
		for (const text of STRINGS) {
			slides.push({ index: slides.length + 1, font, prst: c.prst, adj: c.adj, text });
		}
	}
}
for (const c of stems ? [] : CONTROL_CASES) {
	for (const text of STRINGS) {
		slides.push({ index: slides.length + 1, font: 'Arial', prst: c.prst, adj: c.adj, text });
	}
}

const rel = (id: string, type: string, target: string) =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const emu = (pt: number) => Math.round(pt * EMU_PER_PT);

const slideXml = (s: SlideSpec) =>
	`${XML}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="warp"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(BOX.x)}" y="${emu(BOX.y)}"/><a:ext cx="${emu(BOX.w)}" cy="${emu(BOX.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="none"><a:prstTxWarp prst="${s.prst}"><a:avLst><a:gd name="adj" fmla="val ${s.adj}"/></a:avLst></a:prstTxWarp></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="4000" b="1"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="${s.font}"/></a:rPr><a:t>${s.text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

const THEME = `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T"><a:themeElements><a:clrScheme name="T"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="000000"/></a:dk2><a:lt2><a:srgbClr val="FFFFFF"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="T"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="T"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

const baseName = stems ? 'wordart-can-stems' : 'wordart-can';
const zip = new JSZip();
const slideOverrides = slides
	.map(
		(s) =>
			`<Override PartName="/ppt/slides/slide${s.index}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
	)
	.join('');
zip.file(
	'[Content_Types].xml',
	`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slideOverrides}</Types>`,
);
zip.file(
	'_rels/.rels',
	`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'ppt/presentation.xml')}</Relationships>`,
);
zip.file(
	'ppt/presentation.xml',
	`${XML}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides
		.map((s) => `<p:sldId id="${255 + s.index}" r:id="rId${s.index + 1}"/>`)
		.join(
			'',
		)}</p:sldIdLst><p:sldSz cx="${emu(SLIDE_W_PT)}" cy="${emu(SLIDE_H_PT)}"/><p:notesSz cx="${emu(SLIDE_H_PT)}" cy="${emu(SLIDE_W_PT)}"/></p:presentation>`,
);
zip.file(
	'ppt/_rels/presentation.xml.rels',
	`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml')}${slides
		.map((s) => rel(`rId${s.index + 1}`, 'slide', `slides/slide${s.index}.xml`))
		.join('')}</Relationships>`,
);
zip.file('ppt/theme/theme1.xml', THEME);
zip.file(
	'ppt/slideMasters/slideMaster1.xml',
	`${XML}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
);
zip.file(
	'ppt/slideMasters/_rels/slideMaster1.xml.rels',
	`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}${rel('rId2', 'theme', '../theme/theme1.xml')}</Relationships>`,
);
zip.file(
	'ppt/slideLayouts/slideLayout1.xml',
	`${XML}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
);
zip.file(
	'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
	`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')}</Relationships>`,
);
const slideRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}</Relationships>`;
for (const s of slides) {
	zip.file(`ppt/slides/slide${s.index}.xml`, slideXml(s));
	zip.file(`ppt/slides/_rels/slide${s.index}.xml.rels`, slideRels);
}

await mkdir(outDir, { recursive: true });
await writeFile(
	resolve(outDir, `${baseName}.pptx`),
	await zip.generateAsync({ type: 'uint8array' }),
);
await writeFile(
	resolve(outDir, `${baseName}.json`),
	JSON.stringify(
		{ slideWidthPt: SLIDE_W_PT, slideHeightPt: SLIDE_H_PT, box: BOX, slides },
		null,
		2,
	),
);
// oxlint-disable-next-line no-console -- generator CLI feedback
console.log(`wrote ${slides.length} slides to ${outDir}`);
