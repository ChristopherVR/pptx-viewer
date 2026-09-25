/**
 * A picture's `a:blip` may carry `a:extLst` entries this codebase does not
 * model at all (a vendor extension, distinct from the `a14` picture-editing
 * extension `image-a14-effects-writer.ts` rebuilds and the `asvg:svgBlip`
 * variant `extractSvgBlipRelId` reads). `applyA14ImageExtension` is the only
 * thing that touches a blip's `a:extLst` on save, and it is written to
 * preserve every OTHER `a:ext` entry verbatim (`blipExtensionEntries`) while
 * it rebuilds just the `a14` one. This test covers that an unmodelled vendor
 * extension survives a full-shape rewrite (`isDirty`) intact, including when
 * the picture ALSO carries a real `a14` effect the writer does rebuild.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { isImageLikeElement } from '../../core/types';
import { PptxHandler } from '../../index';

const VENDOR_URI = '{11111111-2222-3333-4444-555555555555}';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:pic><p:nvPicPr><p:cNvPr id="2" name="Picture 1"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"><a:extLst><a:ext uri="${VENDOR_URI}"><vnd:widget xmlns:vnd="urn:example:vendor" val="1"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="571500" y="571500"/><a:ext cx="1905000" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/accessibility-images.pptx', import.meta.url),
);

async function loadWithCustomSlide(): Promise<Uint8Array> {
	const zip = await JSZip.loadAsync(readFileSync(fixture));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes;
}

describe('a vendor a:blip/a:extLst entry the model does not know about', () => {
	it('survives a full-shape rewrite untouched', async () => {
		const bytes = await loadWithCustomSlide();
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);

		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		expect(savedXml).toContain(`<a:ext uri="${VENDOR_URI}">`);
		expect(savedXml).toMatch(/<vnd:widget[^>]*xmlns:vnd="urn:example:vendor"[^>]*val="1"/);
	});

	it('survives alongside a real a14 effect the writer rebuilds', async () => {
		const bytes = await loadWithCustomSlide();
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);

		const picture = data.slides[0]!.elements.find(isImageLikeElement);
		if (!picture) {
			throw new Error('no picture on the slide');
		}
		picture.imageEffects = { ...picture.imageEffects, brightness: 0.2 };
		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		expect(savedXml).toContain('bright="200"');
		expect(savedXml).toContain(`<a:ext uri="${VENDOR_URI}">`);
		expect(savedXml).toMatch(/<vnd:widget[^>]*xmlns:vnd="urn:example:vendor"[^>]*val="1"/);
	});
});
