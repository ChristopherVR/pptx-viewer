/**
 * `writeLineArrows` deleted `a:headEnd`/`a:tailEnd` whenever the resolved
 * arrow type was `'none'`, matching PowerPoint's own convention of omitting
 * an unstyled arrow end entirely. But PowerPoint's own connector tool ALSO
 * writes `<a:headEnd len="med" w="med" type="none"/>` (all three
 * attributes) for a genuinely authored "no arrowhead", and that shape was
 * indistinguishable from "no arrow-end element at all" by type alone, so
 * the explicitly authored element was silently dropped.
 *
 * `applyDrawingLineDash` had the equivalent bug for `<a:prstDash
 * val="solid"/>`: `'solid'` is ECMA-376's schema default, but the parser
 * only ever returns it from a real, present element, so treating it as "the
 * default, strip it" dropped an authored one too.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="10" name="Connector 9"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="500400" cy="0"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:noFill/><a:ln cap="flat" cmpd="sng" w="19050"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:prstDash val="solid"/><a:round/><a:headEnd len="med" w="med" type="none"/><a:tailEnd len="med" w="med" type="none"/></a:ln></p:spPr></p:cxnSp>
<p:sp><p:nvSpPr><p:cNvPr id="20" name="Other Shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('connector headEnd/tailEnd type="none" and prstDash="solid" are not dropped', () => {
	it('keeps the authored headEnd/tailEnd and prstDash on an unrelated dirty save', async () => {
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

		expect(savedXml).toContain('<a:prstDash val="solid"');
		expect(savedXml).toMatch(/<a:headEnd type="none" w="med" len="med"/);
		expect(savedXml).toMatch(/<a:tailEnd type="none" w="med" len="med"/);
	});
});
