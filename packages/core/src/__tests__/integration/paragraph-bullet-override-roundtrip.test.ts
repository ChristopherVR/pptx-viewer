/**
 * A paragraph may restyle an INHERITED bullet without declaring one: its own
 * `a:pPr` carries `a:buClr` (and/or `a:buSz*` / `a:buFont`) but no bullet type
 * (`a:buChar` / `a:buAutoNum` / `a:buBlip` / `a:buNone`). The bullet resolves
 * from the list style, the writer rightly declines to stamp that cascaded
 * bullet onto the paragraph, and the paragraph's own colour override used to
 * be dropped along with it (measured on solution-explorer.pptx slides 13/14).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const TREE_HEAD =
	'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>';

function slideXml(paragraphs: string): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${NS}><p:cSld><p:spTree>${TREE_HEAD}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Text 1"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4000000" cy="2000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr marL="171450" indent="-171450"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/></a:lvl1pPr></a:lstStyle>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
}

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

async function rewrite(paragraphs: string): Promise<string> {
	const zip = await JSZip.loadAsync(readFileSync(fixture));
	zip.file('ppt/slides/slide1.xml', slideXml(paragraphs));
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	data.slides[0]!.isDirty = true;
	const saved = await handler.save(data.slides);
	const savedZip = await JSZip.loadAsync(saved);
	const xml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');
	// Normalise `<x></x>` to `<x/>` so assertions do not depend on the
	// serializer's empty-element spelling.
	return xml.replace(/<([\w:]+)([^<>]*)><\/\1>/g, '<$1$2/>');
}

describe('paragraph bullet overrides survive a dirty rewrite', () => {
	it('keeps a buClr-only pPr on a paragraph whose bullet is inherited', async () => {
		const xml = await rewrite(
			'<a:p><a:pPr><a:buClr><a:srgbClr val="E74011"/></a:buClr></a:pPr><a:r><a:rPr lang="en-US"/><a:t>Item</a:t></a:r></a:p>',
		);
		expect(xml).toContain('<a:pPr><a:buClr><a:srgbClr val="E74011"/></a:buClr></a:pPr>');
		// The cascaded bullet itself is still NOT pinned onto the paragraph.
		expect(xml).not.toMatch(/<a:p>(?:(?!<\/a:p>).)*<a:buChar/);
	});

	it('keeps colour, size and font overrides in schema order', async () => {
		const xml = await rewrite(
			'<a:p><a:pPr marL="171450"><a:buClr><a:schemeClr val="accent2"/></a:buClr><a:buSzPct val="80000"/><a:buFont typeface="Wingdings" charset="2"/></a:pPr><a:r><a:rPr lang="en-US"/><a:t>Item</a:t></a:r></a:p>',
		);
		expect(xml).toContain(
			'<a:buClr><a:schemeClr val="accent2"/></a:buClr><a:buSzPct val="80000"/><a:buFont typeface="Wingdings" charset="2"/></a:pPr>',
		);
	});

	it('keeps an inherit-from-text marker authored without a bullet type', async () => {
		const xml = await rewrite(
			'<a:p><a:pPr><a:buClrTx/></a:pPr><a:r><a:rPr lang="en-US"/><a:t>Item</a:t></a:r></a:p>',
		);
		expect(xml).toContain('<a:pPr><a:buClrTx/></a:pPr>');
	});
});
