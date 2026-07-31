import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSlide } from '../../core/types/presentation';

/**
 * PowerPoint's "Hide Slide" (`p:sld/@show="0"`) must survive save + reload.
 *
 * The show-navigation rule that skips hidden slides is only as good as the flag
 * behind it: if the flag evaporates on the first save, a presenter who hides a
 * backup slide, saves and reopens the deck presents it to the room anyway. The
 * writer also has to REMOVE the attribute when a slide is un-hidden, which is
 * the half that a naive "write when true" implementation silently gets wrong.
 */
describe('hidden slide (p:sld/@show) round-trip', () => {
	async function buildDeck(): Promise<{ handler: PptxHandler; slides: PptxSlide[] }> {
		const { handler, data } = await PptxHandler.createBlank({ initialSlideCount: 3 });
		return { handler, slides: data.slides };
	}

	async function reload(handler: PptxHandler, slides: PptxSlide[]) {
		const bytes = await handler.save(slides);
		const next = new PptxHandler();
		const data = await next.load(bytes.buffer as ArrayBuffer);
		return { handler: next, slides: data.slides, bytes };
	}

	it('writes p:sld/@show="0" for a hidden slide and nothing for a visible one', async () => {
		const { handler, slides } = await buildDeck();
		slides[1] = { ...slides[1], hidden: true, isDirty: true };
		const bytes = await handler.save(slides);
		const zip = await JSZip.loadAsync(bytes);

		const hiddenXml = await zip.file(slides[1].id.replace(/^\//u, ''))!.async('string');
		expect(hiddenXml).toMatch(/<p:sld[^>]*\sshow="0"/u);

		const visibleXml = await zip.file(slides[0].id.replace(/^\//u, ''))!.async('string');
		expect(visibleXml).not.toMatch(/<p:sld[^>]*\sshow="0"/u);
	});

	it('reloads the hidden flag on exactly the slide it was set on', async () => {
		const { handler, slides } = await buildDeck();
		slides[1] = { ...slides[1], hidden: true, isDirty: true };

		const reloaded = await reload(handler, slides);
		expect(reloaded.slides.map((slide) => Boolean(slide.hidden))).toStrictEqual([
			false,
			true,
			false,
		]);
	});

	it('survives a second save + reload cycle', async () => {
		const { handler, slides } = await buildDeck();
		slides[2] = { ...slides[2], hidden: true, isDirty: true };

		const first = await reload(handler, slides);
		const second = await reload(first.handler, first.slides);
		expect(second.slides.map((slide) => Boolean(slide.hidden))).toStrictEqual([false, false, true]);
	});

	it('clears the flag when a slide is un-hidden', async () => {
		const { handler, slides } = await buildDeck();
		slides[0] = { ...slides[0], hidden: true, isDirty: true };
		const first = await reload(handler, slides);
		expect(first.slides[0].hidden).toBeTruthy();

		const unhidden = first.slides.map((slide, index) =>
			index === 0 ? { ...slide, hidden: false, isDirty: true } : slide,
		);
		const second = await reload(first.handler, unhidden);
		expect(Boolean(second.slides[0].hidden)).toBeFalsy();

		const zip = await JSZip.loadAsync(second.bytes);
		const xml = await zip.file(second.slides[0].id.replace(/^\//u, ''))!.async('string');
		expect(xml).not.toMatch(/<p:sld[^>]*\sshow="0"/u);
	});

	it('reads the p:sldIdLst/p:sldId/@show fallback PowerPoint also accepts', async () => {
		const { handler, slides } = await buildDeck();
		const bytes = await handler.save(slides);
		const zip = await JSZip.loadAsync(bytes);
		const presXml = await zip.file('ppt/presentation.xml')!.async('string');
		// Tag the SECOND p:sldId entry as not-shown, leaving p:sld untouched.
		let seen = 0;
		const patched = presXml.replace(/<p:sldId\s/gu, (match) => {
			seen += 1;
			return seen === 2 ? '<p:sldId show="0" ' : match;
		});
		zip.file('ppt/presentation.xml', patched);
		const patchedBytes = await zip.generateAsync({ type: 'uint8array' });

		const next = new PptxHandler();
		const data = await next.load(patchedBytes.buffer as ArrayBuffer);
		expect(data.slides.map((slide) => Boolean(slide.hidden))).toStrictEqual([false, true, false]);
	});
});
