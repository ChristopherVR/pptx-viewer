/**
 * `a:buFont` is a CT_TextFont, the same complex type as `a:latin`/`a:ea`/
 * `a:cs`/`a:sym` (which already round-trip `@panose`/`@pitchFamily`/
 * `@charset` via `TextStyle.latinFontPanose` etc.), but nothing modeled the
 * bullet's own copies of those attributes at all: `BulletInfo` carried only
 * `fontFamily`. A Wingdings bullet (`solution-explorer.pptx` authors exactly
 * this: `<a:buFont typeface="Wingdings" panose="05000000000000000000"
 * pitchFamily="2" charset="2"/>` on a paragraph's own `a:pPr`) silently lost
 * its PANOSE/pitch-family/charset fallback hints on any save that rewrote
 * the paragraph.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="Bulleted list"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:buFont typeface="Wingdings" panose="05000000000000000000" pitchFamily="2" charset="2"/><a:buChar char="&#61558;"/></a:pPr><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Wingdings bullet item</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('bullet a:buFont panose/pitchFamily/charset round-trip', () => {
	it('parses and re-emits the bullet font-matching hints', async () => {
		const zip = await JSZip.loadAsync(readFileSync(fixture));
		zip.file('ppt/slides/slide1.xml', SLIDE_XML);
		zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
		const bytes = await zip.generateAsync({ type: 'uint8array' });
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);

		const shape = data.slides[0]?.elements.find((element) => element.type === 'text');
		expect(shape?.type).toBe('text');
		const bullet = shape?.type === 'text' ? shape.textSegments?.[0]?.bulletInfo : undefined;
		expect(bullet?.fontFamily).toBe('Wingdings');
		expect(bullet?.fontPanose).toBe('05000000000000000000');
		expect(bullet?.fontPitchFamily).toBe(2);
		expect(bullet?.fontCharset).toBe(2);

		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');
		expect(savedXml).toMatch(
			/<a:buFont[^>]*typeface="Wingdings"[^>]*panose="05000000000000000000"[^>]*pitchFamily="2"[^>]*charset="2"/,
		);
	});
});
