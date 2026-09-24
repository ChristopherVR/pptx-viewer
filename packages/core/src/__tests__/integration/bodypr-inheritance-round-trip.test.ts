/**
 * Core round-trip audit, item 1: a slide rewrite must never MATERIALIZE a
 * `a:bodyPr` value the shape never authored.
 *
 * `master-layout-inheritance-fills.pptx` (corpus fixture) has a body
 * placeholder ("Content Placeholder 2", slide 2) whose own `p:txBody` is a
 * bare `<a:bodyPr/>`: every vertical anchor, inset, autofit mode and
 * `rtlCol` it renders with comes from the slide master's body placeholder
 * (`vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720"
 * rtlCol="0"` plus `<a:normAutofit/>`). Before the fix, rewriting the slide
 * (any edit that marks it dirty) copied every one of those resolved values
 * onto the placeholder's own `a:bodyPr`, pinning it to today's master and
 * flipping the inherited `a:normAutofit` into `a:spAutoFit` (PowerPoint:
 * AutoSize goes from "Shrink text on overflow" to "Resize shape to fit
 * text").
 *
 * A second, unrelated shape on the same fixture ("Rectangle: Rounded
 * Corners 2"-equivalent injected below) has its OWN `anchor="ctr"` but NO
 * text at all (only `<a:endParaRPr/>`): before the fix, a text-less shape's
 * `textStyle` was dropped entirely, so its authored anchor was actively
 * DELETED on save (PowerPoint: vertical alignment flips from middle to top).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../fixtures/corpus/master-layout-inheritance-fills.pptx', import.meta.url),
);

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return toArrayBuffer(new Uint8Array(buf));
}

/** Inject a text-less shape with its OWN `anchor="ctr"` bodyPr into slide 2. */
async function fixtureWithTextlessAnchoredShape(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(fixtureBytes());
	const slidePath = 'ppt/slides/slide2.xml';
	const xml = await zip.file(slidePath)!.async('string');
	const sp =
		'<p:sp><p:nvSpPr><p:cNvPr id="90" name="Textless Anchored"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
		'<p:spPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="500000" cy="500000"/></a:xfrm>' +
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
		'<p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/>' +
		'<a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>';
	expect(xml).toContain('</p:spTree>');
	const injected = xml.replace('</p:spTree>', `${sp}</p:spTree>`);
	zip.file(slidePath, injected);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return toArrayBuffer(bytes);
}

describe('a:bodyPr inheritance is not materialized on save', () => {
	it('leaves an inherited anchor/insets/rtlCol/autofit off an untouched placeholder', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());

		// Nothing about the deck is edited; only marked dirty, as any editor
		// does when the user touches something ELSE on the same slide.
		for (const slide of data.slides) {
			(slide as { isDirty?: boolean }).isDirty = true;
		}
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const slideXml = await savedZip.file('ppt/slides/slide2.xml')!.async('string');

		// The apostrophe in the source text round-trips as the `&apos;` entity,
		// so the marker avoids it rather than special-casing XML escaping.
		const marker = 'off-white font colour.';
		expect(slideXml).toContain(marker);
		const bodyPrStart = slideXml.lastIndexOf('<a:bodyPr', slideXml.indexOf(marker));
		const bodyPrEnd = slideXml.indexOf('>', bodyPrStart);
		const bodyPrTag = slideXml.slice(bodyPrStart, bodyPrEnd + 1);

		expect(bodyPrTag).not.toContain('anchor=');
		expect(bodyPrTag).not.toContain('lIns=');
		expect(bodyPrTag).not.toContain('tIns=');
		expect(bodyPrTag).not.toContain('rIns=');
		expect(bodyPrTag).not.toContain('bIns=');
		expect(bodyPrTag).not.toContain('rtlCol=');

		// The bodyPr element as a whole (open tag through its matching close,
		// or the self-close) must not have gained a:normAutofit / a:spAutoFit
		// children either.
		const bodyPrSelfClosed = bodyPrTag.endsWith('/>');
		const bodyPrBlock = bodyPrSelfClosed
			? bodyPrTag
			: slideXml.slice(bodyPrStart, slideXml.indexOf('</a:bodyPr>', bodyPrStart));
		expect(bodyPrBlock).not.toContain('a:normAutofit');
		expect(bodyPrBlock).not.toContain('a:spAutoFit');
	});

	it('keeps a text-less shape`s own anchor instead of deleting it', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithTextlessAnchoredShape());

		for (const slide of data.slides) {
			(slide as { isDirty?: boolean }).isDirty = true;
		}
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const slideXml = await savedZip.file('ppt/slides/slide2.xml')!.async('string');

		const nameIdx = slideXml.indexOf('Textless Anchored');
		expect(nameIdx).toBeGreaterThan(-1);
		const bodyPrStart = slideXml.indexOf('<a:bodyPr', nameIdx);
		const bodyPrEnd = slideXml.indexOf('>', bodyPrStart);
		const bodyPrTag = slideXml.slice(bodyPrStart, bodyPrEnd + 1);
		expect(bodyPrTag).toContain('anchor="ctr"');
	});
});
