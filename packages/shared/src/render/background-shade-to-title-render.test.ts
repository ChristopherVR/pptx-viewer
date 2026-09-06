/**
 * End-to-end guard for the legacy `<p:bgPr shadeToTitle="1">` background
 * flag: loads a synthetic deck through the real `PptxHandler` parse pipeline
 * (gradient background + a title placeholder) and checks that
 * {@link getSlideBackgroundStyle} - the single choke point every binding
 * renders a slide's background through - anchors the gradient on the title
 * placeholder's bounds as a rectangular path gradient, matching PowerPoint's
 * COM-measured real render (see `background-shade-to-title.ts`).
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
 * `shadeToTitle="1"`, and the deck's existing "TextBox 2" shape (a real
 * `<a:xfrm>` at x=533400 y=2381250 cx=3429000 cy=1714500 EMU, i.e. a
 * 56,250,360,180 px box on this fixture's 1280x720 px slide) turned into a
 * `type="title"` placeholder.
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

	zip.file(slidePath, xml);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Same synthetic gradient background as {@link syntheticDeckWithShadeToTitle},
 * but the slide's own `p:spTree` is left with no title/ctrTitle placeholder at
 * all (the existing "TextBox 2" shape stays a plain text box). Locks in the
 * COM-measured finding in the module docstring of `background-shade-to-title.ts`:
 * real PowerPoint does not anchor this effect on a layout- or master-inherited
 * title, so a slide with no title shape of its own must render the plain
 * authored gradient even when the caller supplies a slide size.
 */
async function syntheticDeckWithShadeToTitleAndNoOwnTitle(): Promise<ArrayBuffer> {
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

	zip.file(slidePath, xml);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('shadeToTitle background, end to end', () => {
	it('anchors the gradient on the title placeholder when the caller supplies the slide size', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await syntheticDeckWithShadeToTitle());
		const slide = data.slides[0]!;

		expect(slide.backgroundShadeToTitle).toBeTruthy();
		expect(slide.backgroundGradient).toBeTruthy();
		expect(data.width).toBe(1280);
		expect(data.height).toBe(720);

		const title = slide.elements.find((element) => element.placeholderType === 'title');
		expect(title).toMatchObject({ x: 56, y: 250, width: 360, height: 180 });

		const style = getSlideBackgroundStyle(slide, { widthPx: data.width, heightPx: data.height });
		const image = style['background-image'];
		expect(image).not.toBe(slide.backgroundGradient);
		expect(image).toMatch(/^url\("data:image\/svg\+xml,/u);
		const decoded = decodeURIComponent(String(image));
		// Original stop colours preserved unchanged (no recolouring toward any
		// title text colour), just laid out as nested rectangle bands instead of
		// the authored linear direction.
		expect(decoded).toContain('#000000');
		expect(decoded).toContain('#0000ff');
		expect(style['background-size']).toBe('100% 100%');
		expect(style['background-repeat']).toBe('no-repeat');
	});

	it('falls back to the plain authored gradient when the caller supplies no slide size', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await syntheticDeckWithShadeToTitle());
		const slide = data.slides[0]!;

		const style = getSlideBackgroundStyle(slide);
		expect(style['background-image']).toBe(slide.backgroundGradient);
	});

	it('falls back to the plain authored gradient when the slide has no title placeholder of its own, matching real PowerPoint', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await syntheticDeckWithShadeToTitleAndNoOwnTitle());
		const slide = data.slides[0]!;

		expect(slide.backgroundShadeToTitle).toBeTruthy();
		expect(slide.elements.some((element) => element.placeholderType === 'title')).toBeFalsy();

		// Even though the caller supplies a slide size, there is nothing to
		// anchor on, so the style must fall back unchanged, exactly as
		// real PowerPoint does (see the module docstring's COM measurement).
		const style = getSlideBackgroundStyle(slide, { widthPx: data.width, heightPx: data.height });
		expect(style['background-image']).toBe(slide.backgroundGradient);
	});
});
