/**
 * Round-trip guard for element animation authoring: an effect applied through
 * the shared authoring helpers must survive save + reload AND leave real OOXML
 * `p:timing` behind, not just this app's private `pptx:editorMeta` extension.
 *
 * Without the second half the animation panel is a lie: it reloads perfectly
 * here and does nothing at all in PowerPoint, because the save path only ever
 * patched attributes on time nodes that already existed. A deck built in the
 * panel therefore reached PowerPoint with no animation on it.
 */
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { removeAnimation, setAnimationEntrance, setDuration } from './animation-authoring';

async function saveAndReload(handler: PptxHandler, slides: PptxSlide[]) {
	const bytes = await handler.save(slides);
	const reloaded = new PptxHandler();
	const data = await reloaded.load(bytes.buffer as ArrayBuffer);
	return { data, bytes, handler: reloaded };
}

/**
 * Read a part out of the saved package. Saved decks are DEFLATE-compressed, so
 * scanning the raw bytes as text finds nothing even when the markup is there.
 */
async function readPart(bytes: Uint8Array, path: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const part = zip.file(path);
	if (!part) {
		throw new Error(`part not found in saved package: ${path}`);
	}
	return part.async('string');
}

/** Count effect time nodes: `p:cTn` elements carrying a `@presetClass`. */
function countEffects(slideXml: string): number {
	return (slideXml.match(/<p:cTn[^>]*presetClass=/g) ?? []).length;
}

describe('element animation save/reload round trip', () => {
	it('writes an authored entrance into p:timing, not only the editor extension', async () => {
		const { handler, data } = await PptxHandler.create({
			title: 'Animation authoring',
			initialSlideCount: 1,
		});
		const elementId = data.slides[0].elements[0]?.id ?? 'shape-under-test';
		const animations = setDuration(setAnimationEntrance([], elementId, 'zoomIn'), elementId, 900);

		const { data: reloaded, bytes } = await saveAndReload(handler, [
			{ ...data.slides[0], animations },
		]);

		// The editor list survives...
		expect(reloaded.slides[0].animations?.[0]).toMatchObject({
			elementId,
			entrance: 'zoomIn',
			durationMs: 900,
		});
		// ...and so does a real native time node, which is what PowerPoint plays.
		const native = reloaded.slides[0].nativeAnimations ?? [];
		expect(native.some((animation) => animation.presetClass === 'entr')).toBeTruthy();

		const slideXml = await readPart(bytes, 'ppt/slides/slide1.xml');
		expect(countEffects(slideXml)).toBe(1);
		// zoomIn is entrance presetID 23 (MS-OI29500 preset table).
		expect(slideXml).toContain('presetID="23"');
		expect(slideXml).toContain('<p:spTgt');
	});

	it('adds to an existing timing tree without disturbing the effects already there', async () => {
		const { handler, data } = await PptxHandler.create({
			title: 'Animation add',
			initialSlideCount: 1,
		});
		const [first, second] = data.slides[0].elements;
		const firstId = first?.id ?? 'a';
		const secondId = second?.id ?? 'b';

		const { data: once, handler: reopened } = await saveAndReload(handler, [
			{ ...data.slides[0], animations: setAnimationEntrance([], firstId, 'fadeIn') },
		]);

		const { data: twice, bytes } = await saveAndReload(reopened, [
			{
				...once.slides[0],
				animations: setAnimationEntrance(once.slides[0].animations ?? [], secondId, 'flyIn'),
			},
		]);

		const slideXml = await readPart(bytes, 'ppt/slides/slide1.xml');
		expect(countEffects(slideXml)).toBe(2);
		expect(slideXml).toContain('presetID="10"'); // fadeIn
		expect(slideXml).toContain('presetID="2"'); // flyIn
		expect(twice.slides[0].animations).toHaveLength(2);
	});

	it('removes the LAST effect too, leaving no time node behind', async () => {
		const { handler, data } = await PptxHandler.create({
			title: 'Animation cleared',
			initialSlideCount: 1,
		});
		const elementId = data.slides[0].elements[0]?.id ?? 'shape-under-test';

		const { data: once, handler: reopened } = await saveAndReload(handler, [
			{ ...data.slides[0], animations: setAnimationEntrance([], elementId, 'fadeIn') },
		]);
		expect(once.slides[0].nativeAnimations ?? []).not.toHaveLength(0);

		// Clearing the last animation used to skip the timing writer entirely, so
		// the effect stayed in the file and kept playing in PowerPoint.
		const { data: cleared, bytes } = await saveAndReload(reopened, [
			{ ...once.slides[0], animations: [] },
		]);

		expect(countEffects(await readPart(bytes, 'ppt/slides/slide1.xml'))).toBe(0);
		expect(cleared.slides[0].nativeAnimations ?? []).toHaveLength(0);
	});

	it('removes the time node again when the effect is deleted', async () => {
		const { handler, data } = await PptxHandler.create({
			title: 'Animation remove',
			initialSlideCount: 1,
		});
		const [first, second] = data.slides[0].elements;
		const firstId = first?.id ?? 'a';
		const secondId = second?.id ?? 'b';

		const authored = setAnimationEntrance(
			setAnimationEntrance([], firstId, 'fadeIn'),
			secondId,
			'flyIn',
		);
		const { data: once, handler: reopened } = await saveAndReload(handler, [
			{ ...data.slides[0], animations: authored },
		]);

		const { data: pruned, bytes } = await saveAndReload(reopened, [
			{
				...once.slides[0],
				animations: removeAnimation(once.slides[0].animations ?? [], secondId),
			},
		]);

		const slideXml = await readPart(bytes, 'ppt/slides/slide1.xml');
		expect(countEffects(slideXml)).toBe(1);
		expect(slideXml).toContain('presetID="10"'); // fadeIn stayed
		expect(slideXml).not.toContain('presetID="2"'); // flyIn went
		expect(pruned.slides[0].animations).toHaveLength(1);
	});
});
