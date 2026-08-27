/**
 * End-to-end guard for the legacy `<p:bgPr shadeToTitle="1">` background
 * effect: loads a synthetic deck through the real `PptxHandler` parse
 * pipeline (gradient background + a title placeholder with a distinct text
 * colour) and checks that {@link getSlideBackgroundStyle} - the single
 * choke point every binding renders a slide's background through - reflects
 * the shaded gradient described in `background-shade-to-title.ts`.
 *
 * No fixture in this project's real-world corpus carries `shadeToTitle`, so
 * this deck is hand-built from `e2e/fixtures/sample-deck.pptx` rather than a
 * captured PowerPoint file (see `docs/guide/limitations.md`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getSlideBackgroundStyle } from './slide-background';

const FIXTURE = fileURLToPath(
	new URL('../../../../e2e/fixtures/sample-deck.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/**
 * Build a synthetic slide1.xml: a two-stop gradient background flagged
 * `shadeToTitle="1"`, and the deck's existing "TextBox 2" shape turned into a
 * `type="title"` placeholder with a distinct (magenta) run colour.
 */
async function syntheticDeckWithShadeToTitle(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(fixtureBytes());
	const slidePath = Object.keys(zip.files).find((p) => /^ppt\/slides\/slide1\.xml$/u.test(p));
	if (!slidePath) {
		throw new Error('sample-deck.pptx has no ppt/slides/slide1.xml');
	}
	let xml = await zip.file(slidePath)!.async('string');

	expect(xml).toContain('<p:bgPr>');
	xml = xml.replace(
		/<p:bgPr>[\s\S]*?<\/p:bgPr>/u,
		'<p:bgPr shadeToTitle="1">' +
			'<a:gradFill>' +
			'<a:gsLst>' +
			'<a:gs pos="0"><a:srgbClr val="000000"></a:srgbClr></a:gs>' +
			'<a:gs pos="100000"><a:srgbClr val="0000FF"></a:srgbClr></a:gs>' +
			'</a:gsLst>' +
			'<a:lin ang="5400000" scaled="1"></a:lin>' +
			'</a:gradFill>' +
			'</p:bgPr>',
	);

	expect(xml).toContain('<p:cNvPr id="2" name="TextBox 2"></p:cNvPr>');
	xml = xml.replace(
		/(<p:cNvPr id="2" name="TextBox 2"><\/p:cNvPr>\s*<p:cNvSpPr txBox="1"><\/p:cNvSpPr>\s*)<p:nvPr><\/p:nvPr>/u,
		'$1<p:nvPr><p:ph type="title"></p:ph></p:nvPr>',
	);

	// Both runs of "TextBox 2" (now the title) are the only lowercase
	// `ffffff` colours in the fixture; the background's own white fill uses
	// uppercase `FFFFFF`, so this cannot bleed into anything else.
	expect(xml.match(/srgbClr val="ffffff"/gu) ?? []).toHaveLength(2);
	xml = xml.replaceAll('srgbClr val="ffffff"', 'srgbClr val="FF00FF"');

	zip.file(slidePath, xml);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('shadeToTitle background, end to end', () => {
	it('shades the loaded slide background gradient toward the title colour', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await syntheticDeckWithShadeToTitle());
		const slide = data.slides[0]!;

		expect(slide.backgroundShadeToTitle).toBeTruthy();
		expect(slide.backgroundGradient).toBeTruthy();
		expect(slide.backgroundGradient).not.toContain('#FF00FF');

		const style = getSlideBackgroundStyle(slide);
		expect(style['background-image']).toContain('#FF00FF');
		expect(style['background-image']).not.toBe(slide.backgroundGradient);
	});
});
