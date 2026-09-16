/**
 * Issue #288: `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="CEE0F3">
 * <a:alpha val="43211"/></a:srgbClr></a:solidFill></p:bgPr></p:bg>` rendered
 * as fully opaque `#CEE0F3`. `extractBackgroundColor`
 * (`PptxHandlerRuntimeBackgroundParsing.ts`) now blends the alpha onto white
 * (PowerPoint always composites a semi-transparent slide background over
 * white), so `slide.backgroundColor` becomes the blended `#EAF2FA`.
 *
 * That blended value must not leak back into the file on save: an untouched
 * slide's `slide.backgroundColor` no longer matches the raw `a:srgbClr/@val`,
 * so a writer that rebuilds `<a:solidFill>` from the flat model colour alone
 * would drop `a:alpha` on the very first save/reload cycle. This test proves
 * `PptxSlideBackgroundBuilder` preserves the original `<p:bgPr>` (including
 * `a:alpha`) verbatim when nothing about the background actually changed.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/sample-deck.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function fixtureWithSemiTransparentBackground(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(fixtureBytes());
	const slidePath = Object.keys(zip.files).find((p) => /^ppt\/slides\/slide\d+\.xml$/u.test(p))!;
	const xml = await zip.file(slidePath)!.async('string');
	const original = '<a:srgbClr val="FFFFFF"></a:srgbClr>';
	expect(xml).toContain(original);
	zip.file(
		slidePath,
		xml.replace(original, '<a:srgbClr val="CEE0F3"><a:alpha val="43211"/></a:srgbClr>'),
	);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Second slide's background swapped from `a:solidFill` to a semi-transparent
 * `a:pattFill`: `a:fgClr` carries the same #CEE0F3 @ 43211 alpha as the solid
 * case above, `a:bgClr` is a fully opaque white. Targets slide 2 (not slide 1,
 * used by the solid-fill test above) so the two fixtures stay independent.
 */
async function fixtureWithSemiTransparentPatternBackground(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(fixtureBytes());
	const slidePath = 'ppt/slides/slide2.xml';
	const xml = await zip.file(slidePath)!.async('string');
	const bgMatch = /<p:bg>[\s\S]*?<\/p:bg>/u.exec(xml);
	expect(bgMatch).not.toBeNull();
	const patternBg =
		'<p:bg><p:bgPr><a:pattFill prst="pct50">' +
		'<a:fgClr><a:srgbClr val="CEE0F3"><a:alpha val="43211"/></a:srgbClr></a:fgClr>' +
		'<a:bgClr><a:srgbClr val="FFFFFF"></a:srgbClr></a:bgClr>' +
		'</a:pattFill><a:effectLst></a:effectLst></p:bgPr></p:bg>';
	zip.file(slidePath, xml.replace(bgMatch![0], patternBg));
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('background a:solidFill a:alpha', () => {
	it('blends the alpha onto white for slide.backgroundColor', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithSemiTransparentBackground());
		expect(data.slides[0]?.backgroundColor).toBe('#EAF2FA');
	});

	it('round-trips a:alpha through a full save/reload of an untouched slide', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithSemiTransparentBackground());
		const slide = data.slides[0]!;
		expect(slide.backgroundColor).toBe('#EAF2FA');

		// Mark the slide dirty (as any editor would after touching something
		// elsewhere on it) WITHOUT touching the background: this is the
		// "untouched background, edited slide" case issue #288 describes.
		slide.isDirty = true;
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const slidePath = Object.keys(savedZip.files).find((p) =>
			/^ppt\/slides\/slide\d+\.xml$/u.test(p),
		)!;
		const savedXml = await savedZip.file(slidePath)!.async('string');
		expect(savedXml).toContain('<a:srgbClr val="CEE0F3">');
		expect(savedXml).toContain('<a:alpha val="43211"');

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.slides[0]?.backgroundColor).toBe('#EAF2FA');
	});
});

describe('background a:pattFill a:alpha', () => {
	it('blends a:alpha onto white for both pattern colours', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithSemiTransparentPatternBackground());
		const slide = data.slides[1]!;
		expect(slide.backgroundPattern?.preset).toBe('pct50');
		expect(slide.backgroundPattern?.fgColor).toBe('#EAF2FA');
		expect(slide.backgroundPattern?.bgColor).toBe('#FFFFFF');
	});

	it('round-trips a:alpha through a full save/reload of an untouched pattern background', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithSemiTransparentPatternBackground());
		const slide = data.slides[1]!;
		expect(slide.backgroundPattern?.fgColor).toBe('#EAF2FA');

		// Same "untouched background, edited slide" scenario as the solid-fill
		// round-trip above: mark dirty without touching the background.
		slide.isDirty = true;
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/slides/slide2.xml')!.async('string');
		expect(savedXml).toContain('<a:pattFill prst="pct50">');
		expect(savedXml).toContain('<a:srgbClr val="CEE0F3">');
		expect(savedXml).toContain('<a:alpha val="43211"');

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.slides[1]?.backgroundPattern?.fgColor).toBe('#EAF2FA');
	});
});
