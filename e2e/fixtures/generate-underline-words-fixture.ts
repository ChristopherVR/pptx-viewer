/**
 * Generates `underline-words.pptx`: one slide holding a single text box whose
 * run is authored `a:rPr u="words"` - PowerPoint's "underline words only, not
 * the spaces" style, distinct from the continuous line of `u="sng"`.
 *
 * WHY a generated fixture: no deck in the corpus authors `u="words"`, and it
 * is invisible unless the deck states it. `packages/shared/src/render/
 * text-run-spacing.ts`'s `splitStyledRun` (with `text-decoration.ts`'s
 * `splitWordsForUnderline`) splits such a run into per-word and per-gap
 * pieces so only the words carry the decoration; a binding that renders the
 * run as one span underlines the inter-word gap too.
 *
 * The marker text is two words separated by a single space so the spec can
 * unambiguously classify each rendered text-node piece as "word" (must be
 * underlined) or "gap" (must not be).
 *
 * Run with: bun run e2e/fixtures/generate-underline-words-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The run's exact text: one space, two words, so a spec can classify pieces. */
export const UNDERLINE_WORDS_TEXT = 'ALPHA BETA';

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function slideXml(): string {
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		`<p:sld ${NS}><p:cSld><p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>',
		'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		'<p:sp><p:nvSpPr><p:cNvPr id="2" name="Underline Words"/>',
		'<p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
		'<p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="4572000" cy="914400"/></a:xfrm>',
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>',
		'<p:txBody><a:bodyPr wrap="none"><a:noAutofit/></a:bodyPr><a:lstStyle/>',
		'<a:p><a:r><a:rPr lang="en-US" sz="2400" u="words" dirty="0">',
		'<a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr>',
		`<a:t>${UNDERLINE_WORDS_TEXT}</a:t></a:r></a:p>`,
		'</p:txBody></p:sp>',
		'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
	].join('');
}

export async function generateUnderlineWordsFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Underline Words Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', slideXml());

	const outPath = resolve(__dirname, 'underline-words.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-underline-words-fixture.ts')) {
	generateUnderlineWordsFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
