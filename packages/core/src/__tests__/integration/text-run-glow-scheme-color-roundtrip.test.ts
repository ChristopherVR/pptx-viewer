/**
 * `a:glow`'s colour choice was always resolved to a flat hex and re-emitted
 * as `<a:srgbClr>` on save, even when the source authored a theme colour
 * (`<a:schemeClr val="accent1">`). That silently cut the glow off from
 * Recolor / Reset to Theme / a later theme swap, the same class of bug the
 * shape-fill colour-preservation code (`color-xml-preservation.ts`) was
 * built to fix for `a:solidFill`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="Glow text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"><a:effectLst><a:glow rad="63500"><a:schemeClr val="accent1"/></a:glow></a:effectLst></a:rPr><a:t>Glowing</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('text run glow theme colour round-trip', () => {
	it('re-emits a:schemeClr (not a:srgbClr) for an untouched glow', async () => {
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
		const runStyle = shape?.type === 'text' ? shape.textSegments?.[0]?.style : undefined;
		expect(runStyle?.textGlowColorXml).toStrictEqual({ 'a:schemeClr': { '@_val': 'accent1' } });

		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		expect(savedXml).toContain('<a:glow');
		expect(savedXml).toMatch(/<a:glow[^>]*>\s*<a:schemeClr val="accent1"/);
		expect(savedXml).not.toMatch(/<a:glow[^>]*>\s*<a:srgbClr/);
	});
});
