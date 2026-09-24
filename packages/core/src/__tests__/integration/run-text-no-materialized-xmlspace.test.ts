/**
 * `createTextNode` stamped `xml:space="preserve"` onto any `a:t` whose text
 * had leading/trailing whitespace, even when that run's text was completely
 * untouched and the source never had the attribute. `xml:space="preserve"`
 * is not a usable signal here (see `utils/xml-whitespace.ts`): it appears
 * zero times across the corpus of real decks in this repository, including
 * ones PowerPoint itself wrote, because the OOXML parser runs with
 * `trimValues: false` plus its own whitespace-preserving allow-list, so
 * round-tripping never depended on it. Measured on a real deck: a run
 * reading "4 HUMANS. " (trailing space, no `xml:space` in source) gained one
 * on any save that rewrote its shape, even when only a SIBLING shape was
 * edited.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="TextBox 9"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>4 HUMANS. </a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('a:t boundary whitespace does not materialize xml:space', () => {
	it('re-emits a trailing-space run without xml:space="preserve" on a rewritten shape', async () => {
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

		expect(savedXml).toContain('<a:t>4 HUMANS. </a:t>');
		expect(savedXml).not.toContain('xml:space');

		// The whitespace itself must still survive the round trip.
		const reloaded = await handler.load(saved.buffer.slice(0) as ArrayBuffer);
		const shape = reloaded.slides[0]!.elements.find((element) => element.type === 'text');
		expect(shape?.type).toBe('text');
		expect(shape?.type === 'text' ? shape.text : undefined).toBe('4 HUMANS. ');
	});
});
