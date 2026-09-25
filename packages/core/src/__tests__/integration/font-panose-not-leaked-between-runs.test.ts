/**
 * `segmentStyle` is assembled as `{...runScopedTextStyle, ...segment.style,
 * ...uniformSegmentOverrides}` (`PptxHandlerRuntimeSaveParagraphs`): a
 * metadata field a run's own font node never set is not overridden by that
 * spread, so a `@panose` value ANOTHER run in the same shape resolved leaked
 * through `runScopedTextStyle` onto a run whose own `<a:ea>` carried none.
 *
 * Measured on a real deck: a run's `<a:ea typeface="Abraham Lincoln"
 * pitchFamily="2" charset="0"/>` (no panose) came back stamped with the
 * PANOSE of an unrelated CJK font ("宋体") used by an earlier run in the
 * same shape.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="TextBox 9"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" sz="2000"><a:latin typeface="Calibri"/><a:ea typeface="&#23435;&#20307;" panose="02010600030101010101" pitchFamily="2" charset="-122"/></a:rPr><a:t>one</a:t></a:r><a:r><a:rPr lang="en-US" sz="2000"><a:latin typeface="Calibri"/><a:ea typeface="Abraham Lincoln" pitchFamily="2" charset="0"/></a:rPr><a:t>two</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('a:ea/a:latin/a:cs @panose is not leaked between runs in the same shape', () => {
	it('leaves the second run without a panose it never authored', async () => {
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

		const eaNodes = [...savedXml.matchAll(/<a:ea([^>]*)\/?>/g)].map((m) => m[1]!);
		expect(eaNodes).toHaveLength(2);
		expect(eaNodes[0]).toContain('panose="02010600030101010101"');
		expect(eaNodes[1]).toContain('Abraham Lincoln');
		expect(eaNodes[1]).not.toContain('panose');
	});
});
