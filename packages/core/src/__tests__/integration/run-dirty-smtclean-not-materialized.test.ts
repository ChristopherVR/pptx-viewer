/**
 * Two related `a:rPr` materialization bugs:
 *
 * 1. `createRunPropertiesFromTextStyle` initialised its return object with a
 *    hardcoded `'@_dirty': '0'`, so a run whose own `a:rPr` never authored
 *    `@dirty` still came back with one on any save that rewrote its shape.
 *
 * 2. `segmentStyle` is assembled as `{...runScopedTextStyle, ...segment.style,
 *    ...uniformSegmentOverrides}` (`PptxHandlerRuntimeSaveParagraphs`): a key
 *    `segment.style` never sets at all is not overridden by that spread. A
 *    boolean flag (`smartTagClean`, here) that ANOTHER run in the same shape
 *    resolved to `false` leaked through `runScopedTextStyle` onto a run that
 *    never authored it, and `differsFromBaseline` then compared that leaked
 *    `false` against the paragraph's `undefined` baseline and called it a
 *    difference, so `owns('smartTagClean')` wrote `smtClean="0"` onto a run
 *    whose source never had it (measured on a real mixed zh-CN/en-US deck:
 *    the run BETWEEN two smtClean-authoring runs gained one it never had).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="TextBox 9"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" altLang="en-US" sz="2800" dirty="0" smtClean="0"><a:latin typeface="Arial"/></a:rPr><a:t>one</a:t></a:r><a:r><a:rPr lang="zh-CN" sz="2800"><a:latin typeface="Arial"/></a:rPr><a:t>two</a:t></a:r><a:r><a:rPr lang="zh-CN" altLang="en-US" sz="2800" dirty="0" smtClean="0"><a:latin typeface="Arial"/></a:rPr><a:t>three</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('a:rPr@dirty / @smtClean are not materialized onto runs that never authored them', () => {
	it('leaves the middle run without smtClean/dirty while the outer runs keep theirs', async () => {
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

		const runs = [...savedXml.matchAll(/<a:rPr([^>]*)>[\s\S]*?<a:t>(\w+)<\/a:t>/g)];
		expect(runs).toHaveLength(3);
		const [one, two, three] = runs.map((m) => ({ attrs: m[1]!, text: m[2] }));

		expect(one!.text).toBe('one');
		expect(one!.attrs).toContain('smtClean="0"');
		expect(one!.attrs).toContain('dirty="0"');

		expect(two!.text).toBe('two');
		// The middle run authored neither attribute: it must not gain either
		// one just because its neighbours have them.
		expect(two!.attrs).not.toContain('smtClean');
		expect(two!.attrs).not.toContain('dirty');

		expect(three!.text).toBe('three');
		expect(three!.attrs).toContain('smtClean="0"');
		expect(three!.attrs).toContain('dirty="0"');
	});
});
