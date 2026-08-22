/**
 * Regression coverage for `a:blipFill/@dpi`: a print-resolution hint with no
 * on-screen effect, parsed for round-trip / API fidelity only (see
 * `PptxImageProperties.dpi`). Covers both blip-carrying paths: a `p:pic`
 * (picture element) and a shape with an image fill (`p:sp/p:spPr/a:blipFill`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxElement } from '../../types';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:pic><p:nvPicPr><p:cNvPr id="10" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch><a:dpi/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>
<p:sp><p:nvSpPr><p:cNvPr id="11" name="ImageFillShape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:blipFill dpi="220"><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></a:blipFill></p:spPr></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
	<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/dpiTest.png"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

async function loadSlide(picBlipFillXml: string): Promise<PptxElement[]> {
	const zip = await JSZip.loadAsync(readFileSync(fixture));
	zip.file(
		'ppt/slides/slide1.xml',
		SLIDE_XML.replace(
			'<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch><a:dpi/></p:blipFill>',
			picBlipFillXml,
		),
	);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });

	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return data.slides[0].elements;
}

describe('a:blipFill/@dpi round-trip parsing', () => {
	it('parses dpi on a picture element (p:blipFill)', async () => {
		const elements = await loadSlide(
			'<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>',
		);
		const pic = elements.find((el) => (el as { name?: string }).name === 'Picture');
		expect((pic as { dpi?: number } | undefined)?.dpi).toBeUndefined();
	});

	it('parses a positive dpi value on a picture element', async () => {
		const elements = await loadSlide(
			'<p:blipFill dpi="150"><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>',
		);
		const pic = elements.find((el) => (el as { name?: string }).name === 'Picture');
		expect((pic as { dpi?: number } | undefined)?.dpi).toBe(150);
	});

	it('parses dpi on a shape-with-image-fill (spPr/a:blipFill)', async () => {
		const elements = await loadSlide(
			'<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>',
		);
		const shape = elements.find((el) => (el as { shapeId?: string }).shapeId === '11');
		expect((shape as { dpi?: number } | undefined)?.dpi).toBe(220);
	});
});
