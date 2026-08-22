/**
 * Regression guard for issue: a group's own `p:grpSpPr/a:blipFill` image fill
 * parsed to `fillMode: 'image'` but never resolved `fillImageUrl`, so the fill
 * was a silent drop in the MODEL (round-trip/API/inspector all saw an
 * unresolved image) - and any `a:grpFill` child inheriting it never picked up
 * the image either, because `fillImageUrl` was not copied down alongside the
 * other fill fields.
 *
 * Same fixture-scaffolding approach as `group-fill-inheritance.test.ts`: a
 * real deck (`linked-textbox.pptx`) with a synthetic `slide1.xml` + rels.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxElement } from '../../types';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="ImageFilledGroup"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5000000" cy="3000000"/><a:chOff x="0" y="0"/><a:chExt cx="5000000" cy="3000000"/></a:xfrm><a:blipFill><a:blip r:embed="rId2"/><a:tile/></a:blipFill></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="11" name="DirectChild"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:grpFill/></p:spPr></p:sp>
</p:grpSp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
	<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/groupTexture.png"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

async function loadSlide(): Promise<PptxElement[]> {
	const zip = await JSZip.loadAsync(readFileSync(fixture));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });

	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return data.slides[0].elements;
}

describe("a group's own p:grpSpPr/a:blipFill image fill", () => {
	it('resolves fillImageUrl (archive path) and fillImageMode on the group itself', async () => {
		const elements = await loadSlide();
		const group = elements.find((el) => el.type === 'group');
		expect(group?.type).toBe('group');
		const groupFill = (
			group as
				| { groupFill?: { fillMode?: string; fillImageUrl?: string; fillImageMode?: string } }
				| undefined
		)?.groupFill;
		expect(groupFill?.fillMode).toBe('image');
		expect(groupFill?.fillImageUrl).toBe('ppt/media/groupTexture.png');
		expect(groupFill?.fillImageMode).toBe('tile');
	});

	it('propagates fillImageUrl/fillImageMode to an a:grpFill child', async () => {
		const elements = await loadSlide();
		const group = elements.find((el) => el.type === 'group') as
			| { type: 'group'; children: PptxElement[] }
			| undefined;
		const child = group?.children.find((el) => 'name' in el && el.name === 'DirectChild');
		const style = (child as { shapeStyle?: Record<string, unknown> } | undefined)?.shapeStyle;
		expect(style?.fillMode).toBe('image');
		expect(style?.fillImageUrl).toBe('ppt/media/groupTexture.png');
		expect(style?.fillImageMode).toBe('tile');
	});
});
