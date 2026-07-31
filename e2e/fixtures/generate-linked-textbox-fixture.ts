/**
 * Generates `linked-textbox.pptx` - four `a:linkedTxbx` chains that differ only
 * in where their boxes sit in the shape tree.
 *
 * Chain resolution used to walk the slide's top-level element list alone, so a
 * chain authored inside a `p:grpSp` resolved to no chain at all: its head box
 * painted the WHOLE chain's text, spilling past its own border, and the
 * successor rendered blank. Nothing in the corpus authors a grouped chain, so
 * there was nothing to catch it. Each chain here isolates one placement:
 *
 *   1. `ChainA`  both boxes top level                  (control: already worked)
 *   2. `ChainB`  both boxes inside one group
 *   3. `ChainC`  both boxes inside a group in a group
 *   4. `ChainD`  head inside a SCALED group, successor top level
 *
 * Chain D also pins coordinate space. Its group is authored with a child extent
 * twice its own (`a:chExt` = 2x `a:ext`), so the head is drawn at half size and
 * therefore holds visibly fewer characters than the identically authored boxes
 * of the other chains. A binding that split the chain on the box's UNSCALED
 * authored size would put the break in the same place as chain A.
 *
 * The bodies are hand-authored OOXML because the builder has no surface for
 * `a:linkedTxbx` at all; a blank SDK deck supplies the package around them.
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

/**
 * The text each chain's head carries. It is far longer than the head box, which
 * is the point: the head keeps the leading slice and the successor paints the
 * rest. Specs locate a chain by its first word.
 */
export const LINKED_TEXTBOX_TEXT = {
	topLevel: 'Alpha one two three four five six seven eight',
	grouped: 'Bravo one two three four five six seven eight',
	nested: 'Charlie one two three four five six seven eight',
	crossing: 'Delta one two three four five six seven eight',
} as const;

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

/** Every box is authored at this size; only chain D's group rescales one. */
const BOX_CX = 2_000_000;
const BOX_CY = 600_000;
const LEFT_X = 400_000;
const RIGHT_X = 2_600_000;

interface BoxSpec {
	id: number;
	name: string;
	x: number;
	y: number;
	cx?: number;
	cy?: number;
	/** `a:linkedTxbx/@id`: the chain this box belongs to. */
	chain: number;
	/** `a:linkedTxbx/@seq`: 0 is the head that holds the text. */
	seq: number;
	text?: string;
}

/**
 * One chain member. PowerPoint writes the whole chain's text into the head and
 * leaves every successor with an empty body, which is what `text: undefined`
 * reproduces here.
 */
function box(spec: BoxSpec): string {
	const body = spec.text
		? `<a:p><a:r><a:rPr lang="en-US" sz="1800" dirty="0"><a:latin typeface="Arial"/>` +
			`<a:cs typeface="Arial"/></a:rPr><a:t>${spec.text}</a:t></a:r></a:p>`
		: '<a:p><a:endParaRPr lang="en-US" sz="1800"/></a:p>';
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${spec.id}" name="${spec.name}"/>` +
		`<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${spec.x}" y="${spec.y}"/>` +
		`<a:ext cx="${spec.cx ?? BOX_CX}" cy="${spec.cy ?? BOX_CY}"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>` +
		`<a:ln w="12700"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill></a:ln></p:spPr>` +
		`<p:txBody><a:bodyPr wrap="square"><a:noAutofit/>` +
		`<a:linkedTxbx id="${spec.chain}" seq="${spec.seq}"/></a:bodyPr>` +
		`<a:lstStyle/>${body}</p:txBody></p:sp>`
	);
}

/**
 * A `p:grpSp` whose child coordinate space is stated explicitly. Passing a
 * `chExt` larger than `ext` scales the children down, which is how chain D
 * gets a half-size head out of an identically authored box.
 */
function grpSp(
	id: number,
	name: string,
	frame: { x: number; y: number; cx: number; cy: number },
	child: { x: number; y: number; cx: number; cy: number },
	inner: string,
): string {
	return (
		`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"/>` +
		`<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
		`<p:grpSpPr><a:xfrm><a:off x="${frame.x}" y="${frame.y}"/>` +
		`<a:ext cx="${frame.cx}" cy="${frame.cy}"/>` +
		`<a:chOff x="${child.x}" y="${child.y}"/>` +
		`<a:chExt cx="${child.cx}" cy="${child.cy}"/></a:xfrm></p:grpSpPr>` +
		`${inner}</p:grpSp>`
	);
}

/** Rows: one chain per band down the slide. */
const ROW_A = 300_000;
const ROW_B = 1_200_000;
const ROW_C = 2_100_000;
const ROW_D = 3_000_000;

/** A band wide enough for both boxes of a chain. */
const band = (y: number, cy = BOX_CY) => ({ x: LEFT_X, y, cx: RIGHT_X + BOX_CX - LEFT_X, cy });

const CHAIN_A =
	box({
		id: 10,
		name: 'ChainA-head',
		x: LEFT_X,
		y: ROW_A,
		chain: 1,
		seq: 0,
		text: LINKED_TEXTBOX_TEXT.topLevel,
	}) + box({ id: 11, name: 'ChainA-tail', x: RIGHT_X, y: ROW_A, chain: 1, seq: 1 });

const CHAIN_B = grpSp(
	20,
	'GroupB',
	band(ROW_B),
	band(ROW_B),
	box({
		id: 21,
		name: 'ChainB-head',
		x: LEFT_X,
		y: ROW_B,
		chain: 2,
		seq: 0,
		text: LINKED_TEXTBOX_TEXT.grouped,
	}) + box({ id: 22, name: 'ChainB-tail', x: RIGHT_X, y: ROW_B, chain: 2, seq: 1 }),
);

const CHAIN_C = grpSp(
	30,
	'GroupC-outer',
	band(ROW_C),
	band(ROW_C),
	grpSp(
		31,
		'GroupC-inner',
		band(ROW_C),
		band(ROW_C),
		box({
			id: 32,
			name: 'ChainC-head',
			x: LEFT_X,
			y: ROW_C,
			chain: 3,
			seq: 0,
			text: LINKED_TEXTBOX_TEXT.nested,
		}) + box({ id: 33, name: 'ChainC-tail', x: RIGHT_X, y: ROW_C, chain: 3, seq: 1 }),
	),
);

// Half scale: the frame is half the child extent on both axes, so the head is
// drawn at 1,000,000 x 300,000 EMU and breaks the text much earlier.
const CHAIN_D =
	grpSp(
		40,
		'GroupD',
		{ x: LEFT_X, y: ROW_D, cx: BOX_CX / 2, cy: BOX_CY / 2 },
		{ x: LEFT_X, y: ROW_D, cx: BOX_CX, cy: BOX_CY },
		box({
			id: 41,
			name: 'ChainD-head',
			x: LEFT_X,
			y: ROW_D,
			chain: 4,
			seq: 0,
			text: LINKED_TEXTBOX_TEXT.crossing,
		}),
	) + box({ id: 42, name: 'ChainD-tail', x: RIGHT_X, y: ROW_D, chain: 4, seq: 1 });

function slideXml(): string {
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		`<p:sld ${NS}><p:cSld><p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>',
		'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		CHAIN_A,
		CHAIN_B,
		CHAIN_C,
		CHAIN_D,
		'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
	].join('');
}

export async function generateLinkedTextBoxFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Linked Text Box Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', slideXml());

	const outPath = resolve(__dirname, 'linked-textbox.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-linked-textbox-fixture.ts')) {
	generateLinkedTextBoxFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
