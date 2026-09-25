/**
 * `a:tab@algn="l"` and `a:tab@leader="none"` are the schema defaults, and the
 * tab-stop writer omits them. That is right for a tab stop the editor made,
 * but a source that spelled the default out lost the attribute on every
 * rewrite (text-body.pptx and underline-words-ruby-tab.pptx slide 1).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { parseTabStops, serializeTabStop } from '../../core/utils/tab-stops';
import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Text 1"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4000000" cy="900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:tabLst><a:tab pos="1828800" algn="l"/><a:tab pos="2743200" algn="r" leader="none"/><a:tab pos="3657600"/></a:tabLst></a:pPr><a:r><a:rPr lang="en-US"/><a:t>Item	Price	Qty</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('authored tab-stop defaults survive a dirty rewrite', () => {
	it('re-emits algn="l" and leader="none" only where the source wrote them', async () => {
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
		const xml = (await savedZip.file('ppt/slides/slide1.xml')!.async('string')).replace(
			/<([\w:]+)([^<>]*)><\/\1>/g,
			'<$1$2/>',
		);
		expect(xml).toContain(
			'<a:tabLst><a:tab pos="1828800" algn="l"/><a:tab pos="2743200" algn="r" leader="none"/><a:tab pos="3657600"/></a:tabLst>',
		);
	});

	it('keeps omitting the defaults for a tab stop the source did not spell out', () => {
		expect(serializeTabStop({ position: 96, align: 'l' })).toStrictEqual({ '@_pos': '914400' });
		expect(serializeTabStop({ position: 96, align: 'l', leader: 'none' })).toStrictEqual({
			'@_pos': '914400',
		});
		const [parsed] = parseTabStops({
			'a:tabLst': { 'a:tab': { '@_pos': '914400', '@_algn': 'l' } },
		})!;
		expect(parsed).toStrictEqual({ position: 96, align: 'l', alignAuthored: true });
		expect(serializeTabStop(parsed!)).toStrictEqual({ '@_pos': '914400', '@_algn': 'l' });
	});
});
