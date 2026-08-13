/**
 * Styling a shape whose `<p:spPr/>` is bare must reach the saved file.
 *
 * `<p:spPr/>` is how an unstyled or fully-inherited shape is authored, and
 * fast-xml-parser gives it to us as the empty STRING rather than `{}`. The save
 * writer gated its entire shape-style block on `shape['p:spPr']` being truthy,
 * so for those shapes a fill, an outline (colour / width / dash / arrows / join
 * / cap), a shadow, glow, reflection, 3D setting or `<p:style>` reference was
 * computed, applied to the model, shown in the UI - and then silently dropped
 * on save. No error, no warning.
 *
 * It hid for two reasons. Bare `<p:spPr/>` appears 623 times across the 45
 * committed decks but is invisible in a diff of our own output, because the
 * builder re-emits `''` as `<p:spPr></p:spPr>`, so a round-trip looks clean.
 * And every styling test used a deck with a populated `<p:spPr>`, which takes
 * the working branch. This test uses a REAL corpus deck that carries the bare
 * form instead of hand-building the markup, so it cannot drift away from what
 * PowerPoint actually writes.
 *
 * @module __tests__/integration/bare-sppr-style-write.test
 */
import { readFileSync } from 'node:fs';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import { fixturePath } from './fixture-corpus-manifest';

/** A genuine deck whose slides carry shapes authored `<p:spPr/>`. */
const DECK = fixturePath({ file: 'master-layout-inheritance-fills.pptx', dir: 'corpus' });

function toArrayBuffer(bytes: Buffer): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('a shape authored <p:spPr/> can still be styled', () => {
	it('writes a solid fill set on a bare-spPr shape into the saved slide part', async () => {
		const handler = new PptxHandler();
		const loaded = await handler.load(toArrayBuffer(readFileSync(DECK)));

		// Locate a shape whose own rawXml carries p:spPr as the empty string.
		// Asserting we found one is half the test: if the parser ever starts
		// materialising empty elements as objects, this guard fails loudly rather
		// than letting the regression test pass without exercising anything.
		let slideIndex = -1;
		let target: (typeof loaded.slides)[number]['elements'][number] | undefined;
		for (const [index, slide] of loaded.slides.entries()) {
			const found = slide.elements.find(
				(el) => el.rawXml && typeof el.rawXml === 'object' && el.rawXml['p:spPr'] === '',
			);
			if (found) {
				slideIndex = index;
				target = found;
				break;
			}
		}
		expect(target, 'no element with a bare <p:spPr/> in the fixture').toBeDefined();

		target!.shapeStyle = { ...target!.shapeStyle, fillMode: 'solid', fillColor: '#FF00FF' };
		const saved = await handler.save(loaded.slides);

		const part = `ppt/slides/slide${slideIndex + 1}.xml`;
		const savedXml = await (await JSZip.loadAsync(saved)).file(part)!.async('string');

		expect(savedXml).toContain('FF00FF');
	});
});
