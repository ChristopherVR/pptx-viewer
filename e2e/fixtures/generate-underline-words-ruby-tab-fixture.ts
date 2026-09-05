/**
 * Generates `underline-words-ruby-tab.pptx`: two text boxes extending the
 * `u="words"` coverage of `generate-underline-words-fixture.ts` (a NEW
 * fixture, per the wave-3 brief - the wave-2 one is left untouched) into the
 * two paths a plain run does not go through:
 *
 *  - A `a:ruby` run whose BASE text is `u="words"`. The annotation reads over
 *    the whole base text, so `packages/shared/src/render/paragraph-run-build.ts`
 *    keeps the base as ONE run and hands a binding `underlineWordPieces`
 *    (word/gap sub-pieces) to render as NESTED spans inside it, instead of the
 *    ordinary per-word sibling-run split.
 *  - A run containing a literal tab character, with the paragraph declaring an
 *    explicit `a:tabLst` (required for the tab-stop layout path at all) and
 *    `u="words"`: `text-tab-run-build.ts`'s `buildRunTabLines` gives each
 *    tab-separated PIECE its own word/gap sub-pieces (`TabbedRunPiece.words`).
 *
 * Marker text uses different Latin letters per scenario (`ALFA`/`BETO` vs
 * `GAMA`/`DELTO`) precisely so a DOM text-node walk can classify a piece by
 * its own content without the ruby annotation's reading text (in Japanese,
 * so it can never collide with either English marker) being mistaken for a
 * base-text word.
 *
 * Run with: bun run e2e/fixtures/generate-underline-words-ruby-tab-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The ruby scenario's base-text words (word / gap / word). */
export const RUBY_BASE_TEXT = 'ALFA BETO';
/** The ruby annotation's own reading text (must never collide with a marker word). */
export const RUBY_ANNOTATION_TEXT = 'あるふぁべと';
/** The tab scenario's text: one tab-separated piece with an internal word gap, then a second piece. */
export const TAB_PIECE_TEXT = 'GAMA DELTO';
export const TAB_SECOND_PIECE_TEXT = 'EPSI';

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function rubyTextBoxXml(): string {
	return (
		'<p:sp><p:nvSpPr><p:cNvPr id="2" name="RubyWords"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
		'<p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="4572000" cy="914400"/></a:xfrm>' +
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
		'<p:txBody><a:bodyPr wrap="none"><a:noAutofit/></a:bodyPr><a:lstStyle/>' +
		// PowerPoint duplicates the base run's own formatting onto the OUTER `a:r`
		// that wraps `a:ruby` (a plain-text-reader fallback), so `u="words"` has to
		// be authored on BOTH runs here or core's ruby parser's "merge outer run
		// props over the base style" step (`PptxHandlerRuntimeShapeParagraph
		// ContentParsing.ts`) overwrites the inner rubyBase run's underline with
		// the outer run's un-set one.
		'<a:p><a:r><a:rPr lang="ja-JP" sz="2400" u="words" dirty="0"><a:latin typeface="Arial"/></a:rPr>' +
		'<a:ruby><a:rubyPr algn="ctr" hps="1200"/>' +
		`<a:rt><a:r><a:rPr lang="ja-JP" sz="1200"/><a:t>${RUBY_ANNOTATION_TEXT}</a:t></a:r></a:rt>` +
		'<a:rubyBase><a:r><a:rPr lang="en-US" sz="2400" u="words" dirty="0">' +
		`<a:latin typeface="Arial"/></a:rPr><a:t>${RUBY_BASE_TEXT}</a:t></a:r></a:rubyBase>` +
		'</a:ruby></a:r></a:p></p:txBody></p:sp>'
	);
}

function tabTextBoxXml(): string {
	return (
		'<p:sp><p:nvSpPr><p:cNvPr id="3" name="TabWords"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
		'<p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="4572000" cy="914400"/></a:xfrm>' +
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
		'<p:txBody><a:bodyPr wrap="none"><a:noAutofit/></a:bodyPr><a:lstStyle/>' +
		'<a:p><a:pPr><a:tabLst><a:tab pos="2743200" algn="l"/></a:tabLst></a:pPr>' +
		'<a:r><a:rPr lang="en-US" sz="2400" u="words" dirty="0"><a:latin typeface="Arial"/></a:rPr>' +
		`<a:t>${TAB_PIECE_TEXT}\t${TAB_SECOND_PIECE_TEXT}</a:t></a:r></a:p></p:txBody></p:sp>`
	);
}

function slideXml(): string {
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		`<p:sld ${NS}><p:cSld><p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>',
		'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		rubyTextBoxXml(),
		tabTextBoxXml(),
		'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
	].join('');
}

export async function generateUnderlineWordsRubyTabFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Underline Words (ruby + tab) Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', slideXml());

	const outPath = resolve(__dirname, 'underline-words-ruby-tab.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-underline-words-ruby-tab-fixture.ts')) {
	generateUnderlineWordsRubyTabFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
