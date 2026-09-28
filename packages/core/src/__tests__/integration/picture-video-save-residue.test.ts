/**
 * Two bits of markup that used to be lost when a slide was rewritten:
 * - an empty `<a:extLst/>` on a picture's `a:blip` (the a14 writer treated
 *   "no entries" as "remove the list", even when the list was authored empty);
 * - a video's `p:cMediaNode@showWhenStopped="1"` (the writer deleted the
 *   attribute whenever `hideWhenNotPlaying` was false, but "1" is an
 *   explicitly authored value that merely equals the schema default).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { PptxSlide } from '../../index';

function fixture(name: string): string {
	return fileURLToPath(new URL(`../../../../../e2e/fixtures/${name}`, import.meta.url));
}

async function load(bytes: Uint8Array): Promise<{ handler: PptxHandler; slides: PptxSlide[] }> {
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return { handler, slides: data.slides };
}

async function savedSlide(
	handler: PptxHandler,
	slides: PptxSlide[],
	part: string,
): Promise<string> {
	const saved = await handler.save(slides);
	return (await JSZip.loadAsync(saved)).file(part)!.async('string');
}

const PIC_SLIDE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:pic><p:nvPicPr><p:cNvPr id="2" name="Picture 1"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"><a:extLst/></a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="571500" y="571500"/><a:ext cx="1905000" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

describe('picture and video markup survives a rewritten slide', () => {
	it('keeps an empty a:extLst on a picture blip', async () => {
		const zip = await JSZip.loadAsync(readFileSync(fixture('accessibility-images.pptx')));
		zip.file('ppt/slides/slide1.xml', PIC_SLIDE);
		const { handler, slides } = await load(await zip.generateAsync({ type: 'uint8array' }));
		slides[0]!.isDirty = true;
		const xml = await savedSlide(handler, slides, 'ppt/slides/slide1.xml');
		expect(xml).toMatch(/<a:blip [^>]*>\s*<a:extLst\s*(?:\/>|><\/a:extLst>)\s*<\/a:blip>/);
	});

	it('keeps showWhenStopped="1" on a video cMediaNode', async () => {
		const name = 'Image_JPG_PNG_Audio_M4_A_Video_MP_4_12_Slides_36_8_MB_ff1095731b.pptx';
		const { handler, slides } = await load(new Uint8Array(readFileSync(fixture(name))));
		const index = 10;
		slides[index]!.isDirty = true;
		const xml = await savedSlide(handler, slides, `ppt/slides/slide${index + 1}.xml`);
		expect(xml).toMatch(/<p:cMediaNode [^>]*showWhenStopped="1"/);
	});
});
