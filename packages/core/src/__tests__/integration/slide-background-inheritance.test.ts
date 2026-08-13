/**
 * Integration: a slide that authored no `<p:bg>` must not gain one on save.
 *
 * `<p:bg>` is optional on `p:sld` (§19.3.1.38); a slide that omits it shows
 * what its layout and master provide, and the master usually defers to
 * `<p:bgRef>` into the theme. The loader flattens that chain because a renderer
 * needs one paintable value, so `slide.backgroundColor` came back as `#FFFFFF`
 * on a plain deck, and the writer read "the model holds a colour" as "the slide
 * has a background". Every slide gained
 * `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/>...` on the first save,
 * and because a slide-level background outranks the layout and the master, an
 * inherited themed or picture background became flat white permanently.
 *
 * Measured through PowerPoint COM on a stock deck, repointing the theme's
 * light-1 slot and reading `Slides(1).Background.Fill.ForeColor.RGB` back:
 *
 *   PowerPoint's own deck   followMaster=-1  0xFFFFFF -> 0x2266AA  followed
 *   through our save (now)  followMaster=-1  0xFFFFFF -> 0x2266AA  followed
 *   with the flat `p:bg`    followMaster= 0  0xFFFFFF -> 0xFFFFFF  pinned
 *
 * `FollowMasterBackground` is PowerPoint's own report of the property at issue,
 * and it flips to false the moment the literal fill is written. Asserting the
 * colour round-tripped would have passed on all three.
 *
 * This is the slide-level half of the same rule the master/layout writer
 * applies one level up: an inherited value is left alone, and a colour the user
 * actually chooses replaces the inheritance deliberately, as PowerPoint does.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxSlide } from '../../core/types';

/** A one-slide deck, saved and re-loaded so the loader records what it saw. */
async function loadGeneratedDeck(): Promise<{ handler: PptxHandler; data: PptxData }> {
	const seed = await PresentationBuilder.create();
	seed.data.slides.push(seed.createSlide('Blank').addText('Hello', { fontSize: 24 }).build());
	const bytes = await seed.handler.save(seed.data.slides);
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	expect(data.slides).toHaveLength(1);
	return { handler, data };
}

/**
 * Unmodified slides are skipped wholesale on save via content fingerprinting,
 * so a test that does not touch them measures the passthrough rather than the
 * writer under test. A new array is not enough: the fingerprint is over the
 * CONTENT, so an element has to actually move.
 */
function forceDirty(slides: PptxSlide[]): PptxSlide[] {
	for (const slide of slides) {
		slide.elements = slide.elements.map((element, index) =>
			index === 0 ? { ...element, x: (element.x ?? 0) + 1 } : element,
		);
	}
	return slides;
}

async function slideBackground(saved: Uint8Array, slideNumber = 1): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	const xml = await zip.file(`ppt/slides/slide${slideNumber}.xml`)!.async('string');
	return xml.match(/<p:bg>[\s\S]*?<\/p:bg>/u)?.[0] ?? '';
}

describe('slide background inheritance', () => {
	it('writes no `p:bg` for a slide that inherits its background', async () => {
		const { handler, data } = await loadGeneratedDeck();
		// The loader resolved the master's background onto the slide so the
		// canvas has something to paint. That is not an authored background.
		expect(data.slides[0].backgroundColor).toBeTruthy();

		const saved = await handler.save(forceDirty(data.slides));
		await expect(slideBackground(saved)).resolves.toBe('');
	});

	it('survives repeated saves without accumulating one', async () => {
		const { handler, data } = await loadGeneratedDeck();
		const once = await handler.save(forceDirty(data.slides));
		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(
			once.buffer.slice(once.byteOffset, once.byteOffset + once.byteLength) as ArrayBuffer,
		);
		const twice = await reloadHandler.save(forceDirty(reloaded.slides));
		await expect(slideBackground(twice)).resolves.toBe('');
	});

	it('writes an explicit `p:bgPr` when the user picks a colour, as PowerPoint does', async () => {
		const { handler, data } = await loadGeneratedDeck();
		data.slides[0].backgroundColor = '#ff0000';

		const saved = await handler.save(forceDirty(data.slides));
		const bg = await slideBackground(saved);
		expect(bg).toContain('<a:srgbClr val="FF0000"');
	});

	it('still writes a background for a slide built without a loader record', async () => {
		// An SDK-built slide was never parsed, so there is nothing to inherit
		// from and the flat value is the only description of the background.
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank').build();
		slide.backgroundColor = '#00FF00';
		data.slides.push(slide);
		const saved = await handler.save(data.slides);
		await expect(slideBackground(saved)).resolves.toContain('<a:srgbClr val="00FF00"');
	});
});
