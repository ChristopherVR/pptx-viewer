/**
 * Generates `text-body.pptx` - one slide isolating the `a:bodyPr` text-BODY
 * features, plus the geometry text rectangle.
 *
 * Every property here was implemented in at most ONE binding before wave 4:
 *
 *  1. `Columns`      `a:bodyPr/@numCol` + `@spcCol` - React only; the other
 *                    four laid a two-column body out as one column.
 *  2. `Tabs`         `a:pPr/@defTabSz` + `a:tabLst` - React only; the other
 *                    four fell back to the browser's 8-character default.
 *  3. `AnchorCtr`    `a:bodyPr/@anchorCtr` - NO binding; the text sat at the
 *                    left inset instead of centred on the shape.
 *  4. `ClipOverflow` `a:bodyPr/@vertOverflow="clip"` - NO binding; an
 *                    over-long body spilled outside its shape.
 *  5. `Rotated`      `a:bodyPr/@rot` - React only; the other four painted a
 *                    rotated body upright.
 *  6. `Chevron`      a preset whose `a:rect` insets the text between the two
 *                    arrow points. NO binding read the rectangle at all, so the
 *                    text was laid out against the full bounding box and ran
 *                    over the geometry. The 0.25/0.75 inset used here is
 *                    PowerPoint's own, measured through COM.
 *
 * The bodies are hand-authored OOXML rather than SDK-built because the builder
 * has no surface for `numCol`, `anchorCtr`, `vertOverflow`, `rot` or a
 * `a:tabLst`, and those absences are exactly the inputs under test. A blank SDK
 * deck supplies the package around them.
 *
 * Re-runnable; `global-setup.ts` invokes it before every Playwright run.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Marker text per shape; specs locate elements by these. */
export const TEXT_BODY_SHAPES = {
	columns: 'Column body text that has to flow from the first column into the second one',
	tabs: 'Item\tPrice',
	anchorCtr: 'Centred box',
	clip: 'This body is authored vertOverflow clip so the overflow must not escape the shape at all',
	rotated: 'Rotated body',
	// Long and LEFT-aligned on purpose: a short centred label would sit in the
	// middle of the shape whether or not the text rectangle was honoured, so it
	// would prove nothing. A wrapped left-aligned paragraph fills the rectangle,
	// which makes both of its edges observable.
	chevron: 'Chevron label wrapping inside the arrow points of its own geometry',
} as const;

/** `@numCol` authored on the `Columns` shape. */
export const COLUMN_COUNT = 2;
/** `@spcCol` authored on the `Columns` shape, in EMU (0.25in). */
export const COLUMN_SPACING_EMU = 228600;
/** `@defTabSz` authored on the `Tabs` shape, in EMU (1in). */
export const DEFAULT_TAB_SIZE_EMU = 914400;
/** `@rot` authored on the `Rotated` shape, in 60000ths of a degree. */
export const BODY_ROTATION = 2700000;

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

interface ShapeSpec {
	name: string;
	prst: string;
	x: number;
	y: number;
	cx: number;
	cy: number;
	bodyPr: string;
	paragraphs: string;
}

function shape(id: number, spec: ShapeSpec): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${spec.name}"/>` +
		`<p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${spec.x}" y="${spec.y}"/>` +
		`<a:ext cx="${spec.cx}" cy="${spec.cy}"/></a:xfrm>` +
		`<a:prstGeom prst="${spec.prst}"><a:avLst/></a:prstGeom><a:noFill/>` +
		`<a:ln><a:solidFill><a:srgbClr val="808080"/></a:solidFill></a:ln></p:spPr>` +
		`<p:txBody>${spec.bodyPr}<a:lstStyle/>${spec.paragraphs}</p:txBody></p:sp>`
	);
}

/** A run in Arial at `sz` hundredths of a point. */
function run(text: string, sz: number): string {
	return (
		`<a:r><a:rPr lang="en-US" sz="${sz}" dirty="0"><a:latin typeface="Arial"/>` +
		`<a:cs typeface="Arial"/></a:rPr><a:t>${text}</a:t></a:r>`
	);
}

const SHAPES: ShapeSpec[] = [
	{
		name: 'Columns',
		prst: 'rect',
		x: 457200,
		y: 274320,
		cx: 3657600,
		cy: 1371600,
		bodyPr:
			`<a:bodyPr wrap="square" numCol="${COLUMN_COUNT}" spcCol="${COLUMN_SPACING_EMU}">` +
			'<a:noAutofit/></a:bodyPr>',
		paragraphs: `<a:p>${run(TEXT_BODY_SHAPES.columns, 1200)}</a:p>`,
	},
	{
		name: 'Tabs',
		prst: 'rect',
		x: 4572000,
		y: 274320,
		cx: 3657600,
		cy: 731520,
		bodyPr: '<a:bodyPr wrap="square"><a:noAutofit/></a:bodyPr>',
		// An explicit stop at 2in, on top of a 1in default interval: a binding
		// with no `tab-size` advances by 8 characters of the current font.
		paragraphs:
			`<a:p><a:pPr defTabSz="${DEFAULT_TAB_SIZE_EMU}">` +
			'<a:tabLst><a:tab pos="1828800" algn="l"/></a:tabLst></a:pPr>' +
			`${run(TEXT_BODY_SHAPES.tabs, 1400)}</a:p>`,
	},
	{
		name: 'AnchorCtr',
		prst: 'rect',
		x: 457200,
		y: 1920240,
		cx: 3657600,
		cy: 731520,
		// `algn="l"` deliberately: `anchorCtr` centres the text BOUNDING BOX
		// independently of the paragraph alignment, so a binding that only reads
		// `@algn` leaves this hard against the left inset.
		bodyPr: '<a:bodyPr wrap="square" anchorCtr="1"><a:noAutofit/></a:bodyPr>',
		paragraphs: `<a:p><a:pPr algn="l"/>${run(TEXT_BODY_SHAPES.anchorCtr, 1600)}</a:p>`,
	},
	{
		name: 'ClipOverflow',
		prst: 'rect',
		x: 4572000,
		y: 1920240,
		// Far too short for the text: the point is what happens to the remainder.
		cx: 3657600,
		cy: 457200,
		bodyPr: '<a:bodyPr wrap="square" vertOverflow="clip"><a:noAutofit/></a:bodyPr>',
		paragraphs: `<a:p>${run(TEXT_BODY_SHAPES.clip, 1600)}</a:p>`,
	},
	{
		name: 'Rotated',
		prst: 'rect',
		x: 457200,
		y: 2926080,
		cx: 2743200,
		cy: 1371600,
		bodyPr: `<a:bodyPr wrap="square" rot="${BODY_ROTATION}"><a:noAutofit/></a:bodyPr>`,
		paragraphs: `<a:p>${run(TEXT_BODY_SHAPES.rotated, 1600)}</a:p>`,
	},
	{
		name: 'Chevron',
		prst: 'chevron',
		x: 4572000,
		y: 2926080,
		// 384x96 px at 9525 EMU/px. The chevron's notch depth is `ss` (the SHORT
		// side) times its 50000 default adjustment, so the text rectangle is
		// 48px in on each side: 0.125 .. 0.875 of the width.
		cx: 3657600,
		cy: 914400,
		bodyPr: '<a:bodyPr wrap="square" anchor="t"><a:noAutofit/></a:bodyPr>',
		paragraphs: `<a:p><a:pPr algn="l"/>${run(TEXT_BODY_SHAPES.chevron, 1200)}</a:p>`,
	},
];

function slideXml(): string {
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		`<p:sld ${NS}><p:cSld><p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>',
		'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		...SHAPES.map((spec, index) => shape(index + 2, spec)),
		'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
	].join('');
}

export async function generateTextBodyFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Text Body Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', slideXml());

	const outPath = resolve(__dirname, 'text-body.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-text-body-fixture.ts')) {
	generateTextBodyFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
