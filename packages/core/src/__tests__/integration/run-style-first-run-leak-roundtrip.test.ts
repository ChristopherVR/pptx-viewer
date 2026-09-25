/**
 * The element-level text style is filled first-run-wins at load, and every
 * run's style used to be assembled on top of it. A later run that authored
 * neither `b` nor `err` therefore inherited the FIRST run's `b="1"` /
 * `err="1"`, and the writer, seeing a value its baseline lacked, wrote them
 * out: `solution-explorer.pptx` gained 85 `@b` and 113 `@err` over three
 * rewritten slides. A parsed run now inherits only element keys that were
 * actually edited.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="TextBox 9"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB" sz="1200" b="1" dirty="0" err="1"/><a:t>Possumus</a:t></a:r></a:p><a:p><a:r><a:rPr lang="en-US" sz="700" dirty="0"/><a:t>Philosophia </a:t></a:r><a:r><a:rPr lang="en-US" sz="700" dirty="0" err="1"/><a:t>efficiantur</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

async function rewrite(): Promise<string[]> {
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
	const xml = await (await JSZip.loadAsync(saved)).file('ppt/slides/slide1.xml')!.async('string');
	return [...xml.matchAll(/<a:rPr\b[^>]*>/g)].map((m) => m[0]);
}

describe("a later run does not inherit the first run's b / err", () => {
	it('writes each run with only the attributes it authored', async () => {
		const rPrs = await rewrite();
		expect(rPrs).toHaveLength(3);
		expect(rPrs[0]).toContain('b="1"');
		expect(rPrs[0]).toContain('err="1"');
		expect(rPrs[1]).not.toContain('b=');
		expect(rPrs[1]).not.toContain('err=');
		expect(rPrs[2]).not.toContain('b=');
		expect(rPrs[2]).toContain('err="1"');
	});
});
