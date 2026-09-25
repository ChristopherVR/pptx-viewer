/**
 * Generates `cjk-line-breaking.pptx`: twelve text boxes, each 4.6em wide with
 * zero insets, holding 20pt Yu Gothic kana whose fifth character never fits,
 * so each box shows how PowerPoint breaks at it. Every box's `lines` are what
 * PowerPoint itself produced (COM `TextRange.Lines()`, 2026-09 limitations
 * wave), which the spec compares every binding against:
 *
 *  - `hangingPunct="1"`: an overflowing `。` stays on line 1, past the margin,
 *    unless a closing bracket follows it under kinsoku, when the mark, the
 *    bracket and the character before them wrap together (`け。」`).
 *  - `hangingPunct="0"`: `え。` wraps together (kinsoku).
 *  - `eaLnBrk="0"`: kinsoku off, so `」` or a small kana starts line 2.
 *  - The `x`-prefixed boxes split the same text into two differently
 *    formatted runs AT the break: PowerPoint ignores the run boundary.
 *
 * Browsers implement none of this in CSS (see `packages/shared/src/render/
 * text-east-asian-breaks.ts`), so the spec pins every binding to it.
 *
 * Run with: bun run e2e/fixtures/generate-cjk-line-breaking-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** One run of a box: its text, and an optional colour / bold to set it apart. */
interface CjkRun {
	text: string;
	color?: string;
	bold?: boolean;
}

/** One box: its paragraph flags, runs, and the lines PowerPoint breaks it into. */
export interface CjkBreakBox {
	name: string;
	props: string;
	runs: readonly CjkRun[];
	/** COM ground truth: `TextRange.Lines(i).Text` for each line. */
	lines: readonly string[];
	/** The box expects its line-1 mark to hang past the right margin. */
	hangs?: boolean;
}

const HANG = 'hangingPunct="1" eaLnBrk="1"';
const NOHANG = 'hangingPunct="0" eaLnBrk="1"';
const ANYWHERE = 'hangingPunct="0" eaLnBrk="0"';
const HANG_ANYWHERE = 'hangingPunct="1" eaLnBrk="0"';

/** The boxes, in slide order, shared with the spec. */
export const CJK_BREAK_BOXES: readonly CjkBreakBox[] = [
	{
		name: 'HANG',
		props: HANG,
		runs: [{ text: 'あいうえ。きくけこ' }],
		lines: ['あいうえ。', 'きくけこ'],
		hangs: true,
	},
	{
		name: 'NOHANG',
		props: NOHANG,
		runs: [{ text: 'あいうえ。さしすせ' }],
		lines: ['あいう', 'え。さし', 'すせ'],
	},
	{
		name: 'BREAK',
		props: ANYWHERE,
		runs: [{ text: 'あいうえ」たちつて' }],
		lines: ['あいうえ', '」たちつ', 'て'],
	},
	{
		name: 'XBREAK',
		props: ANYWHERE,
		runs: [{ text: 'まみむめ' }, { text: '」やゆよわ', color: 'C00000' }],
		lines: ['まみむめ', '」やゆよ', 'わ'],
	},
	{
		name: 'XBREAK_KANA',
		props: ANYWHERE,
		runs: [{ text: 'さしすせ' }, { text: 'ょそたち', bold: true }],
		lines: ['さしすせ', 'ょそたち'],
	},
	{
		name: 'XKINSOKU',
		props: NOHANG,
		runs: [{ text: 'なにぬね' }, { text: '」はひふへ', color: 'C00000' }],
		lines: ['なにぬ', 'ね」はひ', 'ふへ'],
	},
	{
		name: 'XHANG_START',
		props: HANG,
		runs: [{ text: 'らりるれ' }, { text: '。をんあい', color: 'C00000' }],
		lines: ['らりるれ。', 'をんあい'],
		hangs: true,
	},
	{
		name: 'XHANG_END',
		props: HANG,
		runs: [{ text: 'がぎぐげ。' }, { text: 'ざじずぜ', color: 'C00000' }],
		lines: ['がぎぐげ。', 'ざじずぜ'],
		hangs: true,
	},
	{
		name: 'HANG_BRACKET',
		props: HANG,
		runs: [{ text: 'かきくけ。」こさし' }],
		lines: ['かきく', 'け。」こ', 'さし'],
	},
	{
		name: 'HANG_TEN_BRACKET',
		props: HANG,
		runs: [{ text: 'たちつて、」となに' }],
		lines: ['たちつ', 'て、」と', 'なに'],
	},
	{
		name: 'XHANG_BRACKET',
		props: HANG,
		runs: [{ text: 'ばびぶべ。' }, { text: '」ぼぱぴ', color: 'C00000' }],
		lines: ['ばびぶ', 'べ。」ぼ', 'ぱぴ'],
	},
	{
		name: 'HANG_BRACKET_ANYWHERE',
		props: HANG_ANYWHERE,
		runs: [{ text: 'はひふへ。」ほまみ' }],
		lines: ['はひふへ。', '」ほまみ'],
		hangs: true,
	},
];

/** A box's whole text, as the spec finds its element by. */
export function cjkBoxText(spec: CjkBreakBox): string {
	return spec.runs.map((run) => run.text).join('');
}

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const EMU_PER_PT = 12700;

function runXml(run: CjkRun): string {
	const fill = run.color ? `<a:solidFill><a:srgbClr val="${run.color}"/></a:solidFill>` : '';
	return [
		`<a:r><a:rPr lang="ja-JP" sz="2000"${run.bold ? ' b="1"' : ''} dirty="0">${fill}`,
		'<a:latin typeface="Yu Gothic"/><a:ea typeface="Yu Gothic"/></a:rPr>',
		`<a:t>${run.text}</a:t></a:r>`,
	].join('');
}

function box(id: number, x: number, y: number, spec: CjkBreakBox): string {
	return [
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${spec.name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`,
		`<p:spPr><a:xfrm><a:off x="${x * EMU_PER_PT}" y="${y * EMU_PER_PT}"/>`,
		`<a:ext cx="${92 * EMU_PER_PT}" cy="${110 * EMU_PER_PT}"/></a:xfrm>`,
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>',
		'<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>',
		`<a:lstStyle/><a:p><a:pPr ${spec.props}/>${spec.runs.map(runXml).join('')}</a:p></p:txBody></p:sp>`,
	].join('');
}

function slideXml(): string {
	const shapes = CJK_BREAK_BOXES.map((spec, i) =>
		box(i + 2, 40 + (i % 4) * 230, 30 + Math.floor(i / 4) * 160, spec),
	);
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		`<p:sld ${NS}><p:cSld><p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>',
		'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		...shapes,
		'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
	].join('');
}

export async function generateCjkLineBreakingFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'CJK Line Breaking Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', slideXml());

	const outPath = resolve(__dirname, 'cjk-line-breaking.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-cjk-line-breaking-fixture.ts')) {
	generateCjkLineBreakingFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
