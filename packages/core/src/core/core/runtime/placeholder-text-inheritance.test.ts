/**
 * The footer PowerPoint shows and our canvas did not.
 *
 * `header-footer-shows.pptx` was authored by PowerPoint. Its slide master
 * carries the footer string ("Fixture Footer") and each slide carries an EMPTY
 * `ftr` placeholder, which is exactly how PowerPoint expresses "show the
 * master's footer here" (confirmed through COM; see `header-footer-parts.ts`).
 *
 * Two defects met on that shape:
 *
 *   1. The four header/footer placeholders are singletons per part, and
 *      PowerPoint does not keep their `@idx` aligned down the inheritance chain
 *      (this deck: 10/11/12 on the layout, 2/3/4 on the master). The lookup
 *      matched on `idx` only, so nothing above the layout was ever found: the
 *      slide's `dt` and `sldNum` placeholders resolved NO transform and parsed
 *      at 0x0 pixels, and the `ftr` shape, having neither a transform nor text,
 *      was dropped from the model entirely.
 *   2. Even with a transform, an empty `ftr` body would have rendered empty,
 *      because the ancestor's text was only consulted when the slide had no
 *      `p:txBody` at all.
 *
 * The save side is asserted in both directions, because the obvious fix breaks
 * the file: writing the resolved string back into the slide pins that slide to
 * the master text captured at load and silently detaches it from the Header &
 * Footer dialog.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { requireFixture } from '../../../__tests__/require-fixture';
import { PptxHandler } from '../../PptxHandler';
import type { PptxElement, PptxSlide } from '../../types';

const fixturePath = requireFixture(
	fileURLToPath(
		new URL('../../../../../../e2e/fixtures/header-footer-shows.pptx', import.meta.url),
	),
);

function fixtureBuffer(): ArrayBuffer {
	const bytes = readFileSync(fixturePath);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function loadFixture(): Promise<{
	handler: PptxHandler;
	slides: PptxSlide[];
}> {
	const handler = new PptxHandler();
	const data = await handler.load(fixtureBuffer());
	return { handler, slides: data.slides };
}

function placeholder(slide: PptxSlide, type: string): PptxElement | undefined {
	return slide.elements.find((element) => element.placeholderType === type);
}

/** The saved slide's `ftr` shape, as XML text. */
async function savedFooterShapeXml(saved: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	const match = /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?type="ftr"[\s\S]*?<\/p:sp>/u.exec(xml);
	expect(match, 'the saved slide must still carry its ftr placeholder').not.toBeNull();
	return match![0];
}

describe('header/footer placeholder inheritance', () => {
	it('keeps the empty ftr placeholder and resolves the master footer onto it', async () => {
		const { slides } = await loadFixture();
		// Before the fix slide 1 parsed to three elements and no footer at all.
		const footer = placeholder(slides[0], 'ftr');
		expect(footer).toBeDefined();
		expect(footer).toHaveProperty('text', 'Fixture Footer');
		expect(footer!.width).toBeGreaterThan(0);
		expect(footer!.height).toBeGreaterThan(0);
	}, 30_000);

	it('tags the inherited footer runs as footer FIELDS so the dialog stays live', async () => {
		const { slides } = await loadFixture();
		const footer = placeholder(slides[0], 'ftr');
		const segments = (footer as { textSegments?: Array<{ text: string; fieldType?: string }> })
			.textSegments;
		expect(segments?.some((segment) => segment.fieldType === 'footer')).toBeTruthy();
	}, 30_000);

	it('resolves date and slide-number transforms through the type-matched master placeholder', async () => {
		const { slides } = await loadFixture();
		// The layout declares both with no `a:xfrm`; only the master has one, and
		// under a different `idx`. Both parsed at 0x0 (invisible) before the fix.
		// `placeholderType` is normalised to lower case, as `p:ph/@type` is.
		for (const type of ['dt', 'sldnum']) {
			const element = placeholder(slides[0], type);
			expect(element, `no ${type} placeholder`).toBeDefined();
			expect(element!.width, `${type} width`).toBeGreaterThan(0);
			expect(element!.height, `${type} height`).toBeGreaterThan(0);
		}
	}, 30_000);

	it('leaves the slide footer body EMPTY on a no-edit save', async () => {
		const { handler, slides } = await loadFixture();
		const saved = await handler.save(slides, {});
		const footerXml = await savedFooterShapeXml(saved);
		// Writing the resolved string here is the regression this guards: the
		// slide would stop following the master and the Header & Footer dialog.
		expect(footerXml).not.toContain('Fixture Footer');
		expect(footerXml).toContain('<a:endParaRPr');
	}, 30_000);

	it('writes a per-slide override once the footer text is actually edited', async () => {
		const { handler, slides } = await loadFixture();
		const footer = placeholder(slides[0], 'ftr') as {
			text?: string;
			textSegments?: unknown;
		};
		// What an inline edit produces: new text, and the rich segments replaced.
		footer.text = 'Edited On This Slide';
		footer.textSegments = [{ text: 'Edited On This Slide', style: {} }];
		const saved = await handler.save(slides, {});
		const footerXml = await savedFooterShapeXml(saved);
		expect(footerXml).toContain('Edited On This Slide');
	}, 30_000);
});
