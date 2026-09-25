/**
 * An outline that authors a colour but no width (`<a:ln><a:solidFill/>
 * </a:ln>`, no `@w`, no `<p:style><a:lnRef>` to resolve one) parses with an
 * undefined width. The writer's `|| 1` fallback turned that into
 * `w="9525"` on every rewritten slide (`text-body.pptx`,
 * `preset-text-insets.pptx`). An absent width now stays absent; an authored
 * one is still written.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const shape = (id: number, ln: string): string =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Box ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>${ln}</p:spPr></p:sp>`;

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${shape(10, '<a:ln><a:solidFill><a:srgbClr val="808080"/></a:solidFill></a:ln>')}${shape(11, '<a:ln w="25400"><a:solidFill><a:srgbClr val="808080"/></a:solidFill></a:ln>')}
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('an outline with no authored width', () => {
	it('is not given w="9525" on a rewritten slide', async () => {
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
		const lines = [...xml.matchAll(/<a:ln\b[^>]*>/g)].map((m) => m[0]);

		expect(lines).toStrictEqual(['<a:ln>', '<a:ln w="25400">']);
		expect(xml).toContain('val="808080"');
	});
});
