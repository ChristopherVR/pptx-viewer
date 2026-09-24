/**
 * Core round-trip audit, item 2: bullets pinned from the master, plus
 * buClrTx/buSzTx/buFontTx/tabLst/defRPr dropped alongside `a:buNone`.
 *
 * `resolveParagraphBulletInfo` walks the paragraph's own `a:pPr`, the
 * shape's `a:lstStyle`, the inherited placeholder and the master's
 * `a:defPPr` / `p:txStyles`, first-match-wins, so its result can equally be
 * the paragraph's OWN declaration or a purely cascaded one. Before the fix,
 * the writer re-emitted whichever it got without distinguishing the two: a
 * body placeholder paragraph with no `a:pPr` at all (so nothing on the
 * slide says anything about its bullet) had the MASTER's bullet
 * (`buFont="Arial"` / `buChar="•"`) stamped onto a freshly-created
 * `a:pPr` the moment the slide was rewritten.
 *
 * Separately, a paragraph that authors `<a:buNone/>` may still author the
 * INDEPENDENT `buClrTx`/`buSzTx`/`buFontTx` "inherit from text" markers
 * alongside it (their own EG_TextBulletColor/Size/Typeface choice groups),
 * plus an empty `<a:tabLst/>` and an empty `<a:defRPr/>`. Before the fix all
 * five were dropped: `applyBulletProperties` returned immediately after
 * writing `a:buNone`, and an EMPTY XML element parses to the empty string
 * (fast-xml-parser), which `extractParagraphOwnProperties` could not tell
 * apart from "the element is absent" for `a:tabLst` / `a:defRPr`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fixtureBytes(relativePath: string): ArrayBuffer {
	const buf = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)));
	return toArrayBuffer(new Uint8Array(buf));
}

describe('bullet resolution is not materialized on save', () => {
	it('does not stamp the master bullet onto a body placeholder paragraph with no own a:pPr', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(
			fixtureBytes('../fixtures/corpus/master-layout-inheritance-fills.pptx'),
		);

		for (const slide of data.slides) {
			(slide as { isDirty?: boolean }).isDirty = true;
		}
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const slideXml = await savedZip.file('ppt/slides/slide2.xml')!.async('string');

		const marker = 'off-white font colour.';
		expect(slideXml).toContain(marker);
		const pPrStart = slideXml.lastIndexOf('<a:pPr', slideXml.indexOf(marker));
		const openTagEnd = slideXml.indexOf('>', pPrStart);
		const selfClosed = slideXml[openTagEnd - 1] === '/';
		const pPrBlock = selfClosed
			? slideXml.slice(pPrStart, openTagEnd + 1)
			: slideXml.slice(pPrStart, slideXml.indexOf('</a:pPr>', pPrStart) + '</a:pPr>'.length);

		expect(pPrBlock).not.toContain('a:buFont');
		expect(pPrBlock).not.toContain('a:buChar');
		expect(pPrBlock).not.toContain('a:buClr');
	});

	it('preserves buClrTx/buSzTx/buFontTx, an empty tabLst and an empty defRPr alongside a:buNone', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(
			fixtureBytes('../../../../../e2e/fixtures/anatidae-animation.pptx'),
		);

		for (const slide of data.slides) {
			(slide as { isDirty?: boolean }).isDirty = true;
		}
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const slideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		expect(slideXml).toContain('<a:buNone');
		expect(slideXml).toContain('<a:buClrTx');
		expect(slideXml).toContain('<a:buSzTx');
		expect(slideXml).toContain('<a:buFontTx');
		expect(slideXml).toMatch(/<a:tabLst\s*\/>|<a:tabLst><\/a:tabLst>/u);
		expect(slideXml).toMatch(/<a:defRPr\s*\/>|<a:defRPr><\/a:defRPr>/u);
	});
});
