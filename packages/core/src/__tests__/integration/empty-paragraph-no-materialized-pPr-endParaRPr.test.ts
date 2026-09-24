/**
 * `assembleParagraphXml` used to unconditionally assign `a:pPr` (even an
 * empty `{}`) and fall back to a synthesized `<a:endParaRPr lang="en-US"/>`
 * whenever no end properties were captured, regardless of whether the source
 * paragraph authored either at all.
 *
 * `<a:pPr/>` (no attributes, no children) parses identically to "no `a:pPr`
 * at all": fast-xml-parser gives a childless, attribute-less element back as
 * `''`, which `!pPr` treats the same as `undefined`. That collapsed
 * distinction is fine for READING, but the writer must not use "nothing was
 * captured" as license to invent `<a:pPr></a:pPr>` where the source had
 * neither shape.
 *
 * A paragraph with real run content and no authored `a:endParaRPr` is
 * likewise untouched content, not a blank line; the blank-line stub belongs
 * only to a genuinely empty paragraph (no runs at all), which is what
 * PowerPoint itself writes a bare `<a:endParaRPr/>` for.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>COLLAGE OF THE ERA 2</a:t></a:r></a:p><a:p><a:pPr/><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Second line</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('empty a:pPr / missing a:endParaRPr are not materialized on real-content paragraphs', () => {
	it('re-emits paragraphs with real content and no source pPr/endParaRPr without inventing either', async () => {
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

		// Neither paragraph authored a pPr (one had none at all, the other a
		// bare self-closed `<a:pPr/>`, which parses identically): no empty
		// `<a:pPr></a:pPr>` should appear anywhere in the shape.
		expect(savedXml).not.toContain('<a:pPr/>');
		expect(savedXml).not.toContain('<a:pPr></a:pPr>');
		// Neither paragraph authored an endParaRPr, and both have real run
		// content, so neither is a blank line: no fabricated stub either.
		expect(savedXml).not.toContain('a:endParaRPr');
		expect(savedXml).toContain('COLLAGE OF THE ERA 2');
		expect(savedXml).toContain('Second line');
	});
});
