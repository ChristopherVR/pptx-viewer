/**
 * Generates `line-fill-fidelity.pptx`: the `a:ln` and `a:blipFill` features that
 * no deck in the corpus exercised, and that only ONE binding rendered.
 *
 * Every case here was a cross-binding divergence before the render pipeline was
 * consolidated in `pptx-viewer-shared`:
 *
 *   compound-dbl   rect, `a:ln/@cmpd="dbl"`   - painted as one solid line in
 *                                               vue/svelte/vanilla, and as one
 *                                               THICKER solid line in react
 *                                               (its inset-box-shadow strands
 *                                               could never draw the gap)
 *   compound-tri   rect, `a:ln/@cmpd="tri"`   - as above
 *   compound-sng   rect, `@cmpd="sng"` +
 *                  `a:miter/@lim`             - control for the compound cases,
 *                                               and the only `a:miter` in any
 *                                               fixture
 *   reflection-hold   `a:reflection/@stPos`   - honoured by four bindings,
 *                                               dropped by react
 *   reflection-plain  `a:reflection` w/o stPos - control for the above
 *   tile-plain     picture, `a:tile` sx/sy    - a tiled TEXTURE, rendered as one
 *                                               stretched copy everywhere but react
 *   tile-flip      picture, `a:tile` @flip
 *                  + @algn                    - mirrored tiles, anchored centre
 *   hollow-text    run with `a:rPr > a:noFill`
 *                  + an `a:ln` outline        - outline-only WordArt; react was
 *                                               the only binding with no branch
 *                                               for it and painted the interior
 *   solid-text     the same shape without
 *                  `a:noFill`                 - control: paints the inherited
 *                                               colour the hollow run must NOT
 *
 * The bitmap is a 16x16 four-quadrant PNG with a black diagonal, so it is
 * asymmetric on BOTH axes: a missing tile, a missing mirror and a wrong anchor
 * are each visible at a glance.
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
/** 6 pt: thick enough that the strands of a compound line are unambiguous. */
const LINE_W = 6 * EMU_PER_PT;

/** 16x16 RGB PNG: red / white / white / navy quadrants plus a black diagonal. */
const TILE_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAVklEQVR42pXL2wkAIAwDwGziKk7gPi7qOooUSunD1pC/5ABg9W67g9y3a17ANQmwJgfKlIA0VcDmA5AJQTgAbUzbENzNMy/gmgRYkwNlSkCaKmDzAcgcc+P7sNeARlgAAAAASUVORK5CYII=';

const rel = (id: string, type: string, target: string) =>
	`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

/** One shape under test: geometry plus the `spPr` children being exercised. */
interface ShapeSpec {
	name: string;
	x: number;
	y: number;
	w: number;
	h: number;
	/** `a:solidFill` etc, emitted before the line. */
	fill: string;
	/** The `<a:ln>` element (may be empty). */
	line: string;
	/** An `<a:effectLst>` (may be empty). */
	effects?: string;
}

const WHITE = '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>';
const BLUE = '<a:solidFill><a:srgbClr val="4472C4"/></a:solidFill>';

/** `a:ln` with a compound value; the child order follows CT_LineProperties. */
const COMPOUND = (cmpd: string, extra = '') =>
	`<a:ln w="${LINE_W}" cmpd="${cmpd}"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill>${extra}</a:ln>`;

/**
 * `a:reflection` in the shape's `a:effectLst`. `@stPos` holds the reflection at
 * full `@stA` until that fraction of the fade, which is the attribute React
 * dropped; `@endPos` sets where it has faded out completely.
 */
const REFLECTION = (stPos: number) =>
	`<a:effectLst><a:reflection blurRad="0" stA="60000" stPos="${stPos}" endA="0" endPos="100000" dist="0" dir="5400000" fadeDir="5400000" rotWithShape="0"/></a:effectLst>`;

const SHAPES: ShapeSpec[] = [
	{ name: 'compound-dbl', x: 40, y: 40, w: 190, h: 120, fill: WHITE, line: COMPOUND('dbl') },
	{ name: 'compound-tri', x: 265, y: 40, w: 190, h: 120, fill: WHITE, line: COMPOUND('tri') },
	{
		name: 'compound-sng',
		x: 490,
		y: 40,
		w: 190,
		h: 120,
		fill: WHITE,
		// `a:miter/@lim` is ST_PositivePercentage (1000ths of a percent): 8x.
		line: COMPOUND('sng', '<a:miter lim="800000"/>'),
	},
	{
		name: 'reflection-hold',
		x: 40,
		y: 210,
		w: 190,
		h: 70,
		fill: BLUE,
		line: '',
		effects: REFLECTION(50000),
	},
	{
		name: 'reflection-plain',
		x: 265,
		y: 210,
		w: 190,
		h: 70,
		fill: BLUE,
		line: '',
		effects: REFLECTION(0),
	},
];

/**
 * A text shape whose paragraph `lstStyle` supplies an INHERITED blue, so a
 * hollow run that fails to clear its fill is unmistakable on screen (and in the
 * computed style) rather than merely un-outlined.
 *
 * `a:ln/@w="19050"` is 2 px exactly, which keeps the expected
 * `-webkit-text-stroke` a round number across bindings.
 */
const textShapeXml = (name: string, x: number, hollow: boolean, index: number) =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${index}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${
		x * EMU_PER_PT
	}" y="${310 * EMU_PER_PT}"/><a:ext cx="${300 * EMU_PER_PT}" cy="${
		60 * EMU_PER_PT
	}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr sz="3200" b="1"><a:solidFill><a:srgbClr val="0000FF"/></a:solidFill></a:defRPr></a:lvl1pPr></a:lstStyle><a:p><a:r><a:rPr lang="en-US" sz="3200" b="1">${
		hollow ? '<a:noFill/>' : '<a:solidFill><a:srgbClr val="0000FF"/></a:solidFill>'
	}<a:ln w="19050"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill></a:ln></a:rPr><a:t>${
		hollow ? 'Hollow' : 'Solid'
	}</a:t></a:r></a:p></p:txBody></p:sp>`;

/** One picture under test: the `a:tile` variant it carries. */
interface PictureSpec {
	name: string;
	x: number;
	y: number;
	tile: string;
}

const PICTURES: PictureSpec[] = [
	// `@sx`/`@sy` are ST_Percentage (1000ths of a percent): 25000 = 25%.
	{
		name: 'tile-plain',
		x: 490,
		y: 210,
		tile: '<a:tile tx="0" ty="0" sx="25000" sy="25000" flip="none" algn="tl"/>',
	},
	{
		name: 'tile-flip',
		x: 600,
		y: 210,
		tile: '<a:tile tx="0" ty="0" sx="25000" sy="25000" flip="xy" algn="ctr"/>',
	},
];

const shapeXml = (spec: ShapeSpec, index: number) =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${index + 2}" name="${spec.name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${
		spec.x * EMU_PER_PT
	}" y="${spec.y * EMU_PER_PT}"/><a:ext cx="${spec.w * EMU_PER_PT}" cy="${
		spec.h * EMU_PER_PT
	}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${spec.fill}${spec.line}${
		spec.effects ?? ''
	}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;

const pictureXml = (spec: PictureSpec, index: number) =>
	`<p:pic><p:nvPicPr><p:cNvPr id="${index + 2 + SHAPES.length}" name="${spec.name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/>${
		spec.tile
	}</p:blipFill><p:spPr><a:xfrm><a:off x="${spec.x * EMU_PER_PT}" y="${
		spec.y * EMU_PER_PT
	}"/><a:ext cx="${100 * EMU_PER_PT}" cy="${
		100 * EMU_PER_PT
	}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;

const THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T"><a:themeElements><a:clrScheme name="T"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="000000"/></a:dk2><a:lt2><a:srgbClr val="FFFFFF"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="T"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="T"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

export async function generateLineFillFidelityFixture(): Promise<string> {
	// JSZip is a bundled dependency of `pptx-viewer-core`, resolved the same way
	// the other generators resolve it.
	const { createRequire } = await import('node:module');
	const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
	const JSZip = coreRequire('jszip') as new () => import('jszip');
	const zip = new JSZip();

	zip.file(
		'[Content_Types].xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
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
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F2F2F2"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
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
	zip.file('ppt/media/image1.png', TILE_PNG_BASE64, { base64: true });
	zip.file(
		'ppt/slides/slide1.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${SHAPES.map(
			shapeXml,
		).join('')}${PICTURES.map(pictureXml).join('')}${textShapeXml(
			'hollow-text',
			40,
			true,
			2 + SHAPES.length + PICTURES.length,
		)}${textShapeXml('solid-text', 380, false, 3 + SHAPES.length + PICTURES.length)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
	);
	zip.file(
		'ppt/slides/_rels/slide1.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}${rel('rId2', 'image', '../media/image1.png')}</Relationships>`,
	);

	const out = resolve(__dirname, 'line-fill-fidelity.pptx');
	await writeFixtureDeterministic(out, await zip.generateAsync({ type: 'uint8array' }));
	return out;
}

if (import.meta.main) {
	const out = await generateLineFillFidelityFixture();
	// oxlint-disable-next-line no-console -- generator CLI feedback
	console.log(`wrote ${out}`);
}
