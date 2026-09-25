/**
 * `createRunPropertiesFromTextStyle` used to initialise its return object
 * with `{'@_lang': style?.language || 'en-US'}` unconditionally, so a run
 * whose source authored no `a:rPr` at all still came back with a fabricated
 * `<a:rPr lang="en-US"/>` on any save that rewrote its shape (~65 occurrences
 * across the fixture corpus, runs and `a:br` alike, since `a:rPr` is optional
 * on both `a:r` and `a:br`).
 *
 * A companion regression covers the opposite failure an earlier version of
 * this fix introduced: a shape whose sole run has EMPTY text but a real,
 * authored `a:rPr` (a common decorative-rectangle pattern, measured on
 * `sample-deck.pptx`) collapses to the plain-string fallback branch of
 * `createParagraphsFromTextContent` (`areTextSegmentsUniform` treats a single
 * run as trivially uniform). That branch must still call
 * `createRunPropertiesFromTextStyle` for the empty line rather than skip the
 * run outright, or the authored `a:rPr` is dropped instead of fabricated.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="TextBox 9"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>two</a:t></a:r><a:r><a:rPr sz="2800" b="1"><a:latin typeface="Arial"/></a:rPr><a:t>one</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="11" name="Rectangle 1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="1000000"/><a:ext cx="914400" cy="500000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t></a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('a:rPr is not materialized on a run that authored none, and not dropped from one that did', () => {
	it('leaves a run with no source a:rPr without one after a full-shape rewrite', async () => {
		const zip = await JSZip.loadAsync(readFileSync(fixture));
		zip.file('ppt/slides/slide1.xml', SLIDE_XML);
		zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
		const bytes = await zip.generateAsync({ type: 'uint8array' });
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);

		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		// The second run authored no `a:rPr` at all: it must round-trip as a
		// bare `<a:r><a:t>two</a:t></a:r>`, not gain a fabricated
		// `<a:rPr lang="en-US"/>` stub.
		expect(savedXml).toContain('<a:r><a:t>two</a:t></a:r>');

		// The first run keeps its authored properties.
		expect(savedXml).toMatch(/<a:rPr[^>]*sz="2800"[^>]*>[\s\S]*?<a:t>one<\/a:t>/);

		// "Rectangle 1"'s single empty-text run DID author `lang="en-US"`: the
		// collapsed plain-string save path must still preserve it rather than
		// drop the run entirely.
		expect(savedXml).toMatch(/<a:r><a:rPr lang="en-US"[^>]*>(<\/a:rPr>|\/>)<a:t[^>]*>/);
	});
});
