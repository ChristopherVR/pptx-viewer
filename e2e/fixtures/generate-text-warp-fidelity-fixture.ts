/**
 * Generates `text-warp-fidelity.pptx`: WordArt (`a:prstTxWarp`) text boxes
 * covering the "envelope" (inflate/deflate/can) and former "simple"
 * (slant/fade/cascade) preset families, plus an arch control and a
 * multi-paragraph envelope case.
 *
 * Every single-paragraph shape here exercises the common WordArt authoring
 * path, which exposed two now-fixed bugs:
 *
 *   1. Vue, Svelte, and Angular each gated the true SVG `<textPath>` renderer
 *      on a narrower preset set than React and Vanilla used (a `classifyTextWarp`
 *      category check, or - in Angular's case - a deliberately narrower local
 *      copy of `SVG_WARP_PRESETS`), so the envelope/former-simple presets below
 *      rendered as a flat CSS-transform approximation in three of five bindings
 *      while React/Vanilla already rendered them as true SVG textPath.
 *   2. Several of `pptx-viewer-shared`'s per-line SVG path generators
 *      (`inflate`, `deflate`, `deflateInflateDeflate`, `fadeLeft`, `fadeRight`,
 *      `button`, `buttonPour`) modulated their curvature amplitude by a
 *      line-index term that is exactly zero for a single paragraph, so even
 *      the bindings that *did* route to `<textPath>` rendered these presets as
 *      a perfectly flat, unwarped baseline.
 *
 * `inflate-multi` exercises a THIRD, later-fixed residual: every binding used
 * to gate the true per-glyph two-curve envelope on `paragraphs.length === 1`
 * and fall back to a shared-baseline `<textPath>` per line for anything else,
 * so a multi-paragraph envelope block never got per-glyph height variation.
 * `buildGlyphEnvelope` (`pptx-viewer-shared`) now takes a `lineIndex`/
 * `lineCount` pair so paragraph `i` of `n` occupies the `[i/n, (i+1)/n]`
 * vertical slice of the envelope band, and every binding calls it once per
 * paragraph instead of gating on a single line.
 *
 * `arch-control` (`textArchUp`) is a control: a `path`-family preset that was
 * never affected by either bug, to prove a real per-binding difference would
 * still show up as a difference and not get lost in a broad "nothing warps"
 * assertion.
 *
 * The run carries an explicit `<a:latin typeface="Arial"/>` rather than
 * relying on the theme's minor font: `inflate`/`deflate`/`can-up` render via
 * the true per-glyph two-curve envelope (see `hasGlyphEnvelope` in
 * `pptx-viewer-shared`), which is pixel-comparable across bindings only when
 * every binding measures the SAME actual font. Each binding's WordArt
 * renderer used to fall back to its OWN default font-family constant when a
 * run carries none, and those constants differed (Angular's was `Calibri,
 * sans-serif`; Svelte's omitted "Helvetica Neue"; Vanilla had no fallback at
 * all) - now unified on the shared `DEFAULT_FONT_FAMILY` constant
 * (`pptx-viewer-shared`) across all five bindings, so this explicit typeface
 * is kept for determinism, not to route around a divergence.
 *
 * Re-runnable; `global-setup.ts` invokes it on every Playwright run.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EMU_PER_PT = 12700;
const SLIDE_W = 720 * EMU_PER_PT;
const SLIDE_H = 405 * EMU_PER_PT;

const rel = (id: string, type: string, target: string) =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

/** One WordArt shape under test: its `prstTxWarp` preset and optional `adj`. */
interface WarpSpec {
	name: string;
	prst: string;
	x: number;
	y: number;
	adj?: number;
	/** One or more paragraphs of text; defaults to a single "Warped" paragraph. */
	paragraphs?: string[];
	/** Box height override (pt); a multi-paragraph shape needs more vertical room. */
	heightPt?: number;
	/** Box width override (pt); a narrow box relative to `fontSizePt` forces wide glyphs. */
	widthPt?: number;
	/** Font size override (pt); large text in a narrow box is the "very wide glyph" residual. */
	fontSizePt?: number;
}

const WARPS: WarpSpec[] = [
	// Envelope family (was CSS-transform in vue/svelte/angular; inflate/deflate
	// were ALSO flat-line-degenerate in every binding at single-line).
	{ name: 'inflate', prst: 'textInflate', x: 20, y: 20 },
	{ name: 'deflate', prst: 'textDeflate', x: 260, y: 20 },
	{ name: 'can-up', prst: 'textCanUp', x: 500, y: 20 },
	// Former "simple" family (was CSS-transform in vue/svelte/angular).
	{ name: 'slant-up', prst: 'textSlantUp', x: 20, y: 120 },
	{ name: 'fade-right', prst: 'textFadeRight', x: 260, y: 120 },
	{ name: 'cascade-down', prst: 'textCascadeDown', x: 500, y: 120 },
	// Control: a `path`-family preset, unaffected by either bug.
	{ name: 'arch-control', prst: 'textArchUp', x: 20, y: 220 },
	// Control: no warp at all (flat text).
	{ name: 'plain-control', prst: 'textPlain', x: 260, y: 220 },
	// Multi-paragraph envelope residual: every binding used to gate the true
	// per-glyph two-curve envelope on a single paragraph and fall back to a
	// shared-baseline `<textPath>` per line for anything else. Both paragraphs
	// here must render via the glyph envelope, with "Top" occupying the upper
	// half of the envelope band and "Bottom" the lower half.
	{
		name: 'inflate-multi',
		prst: 'textInflate',
		x: 500,
		y: 220,
		paragraphs: ['Top', 'Bottom'],
		heightPt: 160,
	},
	// Wide-glyph residual: "for the `can` presets ... a realistic WordArt
	// caption ... now measures under ~1% almost everywhere ... an extremely
	// short caption (roughly 6-8 very wide glyphs filling the whole box) can
	// still show up to ~2-2.5%" (limitations.md). Three very wide caps
	// ("MOM") at a large point size in a narrow box, each glyph spanning
	// roughly a third of the line, on `textCanUp` at an extreme `adj` (the
	// steepest `arcTo` sweep): exactly the scenario
	// `chooseGlyphSliceCount` (pptx-viewer-shared) slices into multiple
	// clipped pieces per glyph instead of one affine per whole glyph.
	{
		name: 'wide-glyph-can',
		prst: 'textCanUp',
		x: 20,
		y: 300,
		adj: 66667,
		widthPt: 150,
		fontSizePt: 60,
		paragraphs: ['MOM'],
	},
];

const WIDTH_PT = 220;
const HEIGHT_PT = 80;
const DEFAULT_FONT_SIZE_PT = 32;

const paragraphXml = (text: string, fontSizePt: number) =>
	`<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${fontSizePt * 100}" b="1"><a:solidFill><a:srgbClr val="2E75B6"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${text}</a:t></a:r></a:p>`;

const warpShapeXml = (spec: WarpSpec, index: number) => {
	const avLst =
		spec.adj !== undefined
			? `<a:avLst><a:gd name="adj" fmla="val ${spec.adj}"/></a:avLst>`
			: '<a:avLst/>';
	const widthPt = spec.widthPt ?? WIDTH_PT;
	const heightPt = spec.heightPt ?? HEIGHT_PT;
	const fontSizePt = spec.fontSizePt ?? DEFAULT_FONT_SIZE_PT;
	const paragraphs = spec.paragraphs ?? ['Warped'];
	return `<p:sp><p:nvSpPr><p:cNvPr id="${index + 2}" name="${spec.name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${
		spec.x * EMU_PER_PT
	}" y="${spec.y * EMU_PER_PT}"/><a:ext cx="${widthPt * EMU_PER_PT}" cy="${
		heightPt * EMU_PER_PT
	}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="none"><a:prstTxWarp prst="${
		spec.prst
	}">${avLst}</a:prstTxWarp></a:bodyPr><a:lstStyle/>${paragraphs.map((p) => paragraphXml(p, fontSizePt)).join('')}</p:txBody></p:sp>`;
};

const THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T"><a:themeElements><a:clrScheme name="T"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="000000"/></a:dk2><a:lt2><a:srgbClr val="FFFFFF"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="T"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="T"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

export async function generateTextWarpFidelityFixture(): Promise<string> {
	// JSZip is a bundled dependency of `pptx-viewer-core`, resolved the same way
	// the other generators resolve it.
	const { createRequire } = await import('node:module');
	const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
	const JSZip = coreRequire('jszip') as new () => import('jszip');
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
	zip.file('ppt/theme/theme1.xml', THEME);
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
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${WARPS.map(
			warpShapeXml,
		).join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
	);
	zip.file(
		'ppt/slides/_rels/slide1.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}</Relationships>`,
	);

	const out = resolve(__dirname, 'text-warp-fidelity.pptx');
	await writeFixtureDeterministic(out, await zip.generateAsync({ type: 'uint8array' }));
	return out;
}

if (import.meta.main) {
	const out = await generateTextWarpFidelityFixture();
	// oxlint-disable-next-line no-console -- generator CLI feedback
	console.log(`wrote ${out}`);
}
