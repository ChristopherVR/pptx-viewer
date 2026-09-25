/**
 * Generates `cjk-line-breaking.pptx`: three text boxes, each 4.6em wide with
 * zero insets, holding four kana, a mark, then more kana (20pt). The fifth
 * character never fits, so each box shows how PowerPoint breaks at it
 * (COM ground truth, 2026-09 limitations wave):
 *
 *  - `HANG`   `hangingPunct="1"`: the `。` stays on line 1, past the margin.
 *  - `NOHANG` `hangingPunct="0"`: `え。` wraps together (kinsoku).
 *  - `BREAK`  `eaLnBrk="0"`: kinsoku off, so `」` starts line 2 on its own.
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

/** The three boxes' names and texts, shared with the spec. */
export const CJK_BREAK_BOXES = {
	hang: { name: 'HANG', text: 'あいうえ。きくけこ', props: 'hangingPunct="1" eaLnBrk="1"' },
	noHang: { name: 'NOHANG', text: 'あいうえ。さしすせ', props: 'hangingPunct="0" eaLnBrk="1"' },
	breakAnywhere: {
		name: 'BREAK',
		text: 'あいうえ」たちつて',
		props: 'hangingPunct="0" eaLnBrk="0"',
	},
} as const;

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const EMU_PER_PT = 12700;

function box(id: number, x: number, spec: { name: string; text: string; props: string }): string {
	return [
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${spec.name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`,
		`<p:spPr><a:xfrm><a:off x="${x * EMU_PER_PT}" y="${60 * EMU_PER_PT}"/>`,
		`<a:ext cx="${92 * EMU_PER_PT}" cy="${160 * EMU_PER_PT}"/></a:xfrm>`,
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>',
		'<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>',
		`<a:lstStyle/><a:p><a:pPr ${spec.props}/><a:r><a:rPr lang="ja-JP" sz="2000" dirty="0">`,
		'<a:latin typeface="Yu Gothic"/><a:ea typeface="Yu Gothic"/></a:rPr>',
		`<a:t>${spec.text}</a:t></a:r></a:p></p:txBody></p:sp>`,
	].join('');
}

function slideXml(): string {
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		`<p:sld ${NS}><p:cSld><p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>',
		'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		box(2, 60, CJK_BREAK_BOXES.hang),
		box(3, 260, CJK_BREAK_BOXES.noHang),
		box(4, 460, CJK_BREAK_BOXES.breakAnywhere),
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
