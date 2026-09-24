/**
 * Core round-trip audit, item 4: a slide-level `<p:bgRef idx="…">
 * <a:schemeClr .../></p:bgRef>` (a background that follows the theme's
 * `a:bgFillStyleLst` rather than carrying a literal fill) was flattened to
 * `<p:bgPr><a:solidFill><a:srgbClr .../></a:solidFill></p:bgPr>` the moment
 * the slide was rewritten, even when the background itself was never
 * touched. The master/layout save path already guards this exact choice
 * (`master-save-helpers.applyBackgroundColorToCSld`: untouched means leave
 * `<p:bg>` alone entirely); the slide path only had the equivalent guard for
 * the `p:bgPr` shape of `<p:bg>` (`AuthoredSlideBackground.rawBgPr`), not
 * for `p:bgRef`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/sample-deck.pptx', import.meta.url),
);

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return toArrayBuffer(new Uint8Array(buf));
}

async function fixtureWithSlideBgRef(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(fixtureBytes());
	const slidePath = 'ppt/slides/slide1.xml';
	const xml = await zip.file(slidePath)!.async('string');
	const bgMatch = /<p:bg>[\s\S]*?<\/p:bg>/u.exec(xml);
	expect(bgMatch).not.toBeNull();
	const themedBg = '<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg2"/></p:bgRef></p:bg>';
	zip.file(slidePath, xml.replace(bgMatch![0], themedBg));
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return toArrayBuffer(bytes);
}

describe('slide-level p:bgRef is not flattened on save', () => {
	it('restores an untouched p:bgRef verbatim through a full save/reload cycle', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithSlideBgRef());

		// Mark the slide dirty (as any editor would after touching something
		// else on it) WITHOUT touching the background.
		const slide = data.slides[0]!;
		(slide as { isDirty?: boolean }).isDirty = true;
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const slideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		const bgMatch = /<p:bg>[\s\S]*?<\/p:bg>/u.exec(slideXml);
		expect(bgMatch).not.toBeNull();
		const bgBlock = bgMatch![0];
		expect(bgBlock).toContain('<p:bgRef idx="1001">');
		expect(bgBlock).toContain('<a:schemeClr val="bg2">');
		expect(bgBlock).not.toContain('a:srgbClr');
		expect(bgBlock).not.toContain('p:bgPr');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.slides[0]?.backgroundColor).toBeTruthy();
	});
});
