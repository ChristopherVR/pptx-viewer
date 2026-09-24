/**
 * PowerPoint's "Insert" UI stamps every shape with a stable `a16:creationId`
 * inside a URI-guarded `<a:ext>`, declaring `xmlns:a16` locally on that leaf.
 * A reader that does not understand the extension's URI skips the whole
 * `a:ext` block, so this shape of `a16:` usage needs no root-level
 * `mc:Ignorable` declaration at all.
 *
 * `PptxHandlerRuntimeSaveSlideWriter` used to call `ensureA16NamespaceOnSlideRoot`
 * whenever `slideContainsA16Element` found ANY `a16:`-prefixed key anywhere in
 * the slide, which fired for `a16:creationId` too and materialized
 * `xmlns:a16` + `mc:Ignorable="a16"` on the slide root of every rewritten
 * slide that merely carried PowerPoint's own creation-id metadata, even
 * though nothing in the slide needed it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="TextBox 9"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{B5EEF575-0000-0000-0000-000000000001}"/></a:ext></a:extLst></p:cNvPr><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('a16:creationId does not materialize a root mc:Ignorable', () => {
	it('re-emits the slide root without xmlns:a16 / mc:Ignorable on an untouched rewrite', async () => {
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

		// The a16:creationId leaf keeps its own inline xmlns:a16 declaration...
		expect(savedXml).toMatch(/<a16:creationId xmlns:a16="[^"]+"/);
		// ...but the slide ROOT gets neither xmlns:a16 nor mc:Ignorable, since
		// nothing on this slide relies on the root declaring either.
		const rootTag = savedXml.match(/<p:sld[^>]*>/)?.[0] ?? '';
		expect(rootTag).not.toContain('xmlns:a16');
		expect(rootTag).not.toContain('mc:Ignorable');
	});
});
