import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData } from '../../index';

/**
 * Editor animations key by the loader's positional `element.id`, which is
 * regenerated fresh on every load (see `animation-target-reconcile`), so the
 * id an animation was authored against does not survive a save/reload
 * round-trip. Re-find the reloaded text element (and its animation entry) by
 * content instead of by the original id.
 */
function findReloadedTextAnimationElementId(data: PptxData): string {
	const el = data.slides[0].elements.find(
		(candidate) => 'text' in candidate && String(candidate.text ?? '').includes('Hello'),
	)!;
	return el.id;
}

/**
 * Round-trip coverage for the animation panel's new authoring controls
 * (effect sound picker + "after animation" dim/hide), added alongside the
 * shared `animation-sound-authoring` / `animation-after-effect-authoring`
 * descriptors. Before this, `PptxElementAnimation.soundRId` was a write-only
 * field with no way to get a NEW sound embedded: nothing converted a picked
 * file into package bytes or minted its relationship.
 */
const TINY_AUDIO_BYTES = new Uint8Array([
	0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21,
]);
const TINY_AUDIO_DATA_URL = `data:audio/mpeg;base64,${Buffer.from(TINY_AUDIO_BYTES).toString('base64')}`;

describe('animation effect sound authoring round-trip', () => {
	it('embeds a newly-picked sound, mints its relationship, and writes p:stSnd', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slideBuilder = createSlide('Blank').addText('Hello', {
			x: 10,
			y: 10,
			width: 200,
			height: 40,
		});
		const textElement = slideBuilder.getLastElement()!;
		slideBuilder.addAnimation(textElement.id, { preset: 'fadeIn' });
		data.slides.push(slideBuilder.build());

		// Simulate the animation panel's sound picker staging a pending,
		// not-yet-embedded sound (the same `data:` URL convention as
		// `imageData` / `mediaData`).
		const animation = data.slides[0].animations!.find((a) => a.elementId === textElement.id)!;
		animation.soundData = TINY_AUDIO_DATA_URL;
		animation.soundFileName = 'chime.mp3';

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);

		const mediaPath = Object.keys(zip.files).find((path) =>
			/^ppt\/media\/audio\d+\.mp3$/u.test(path),
		);
		expect(mediaPath).toBeDefined();
		await expect(zip.file(mediaPath!)!.async('uint8array')).resolves.toStrictEqual(
			TINY_AUDIO_BYTES,
		);

		const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		expect(rels).toContain('relationships/audio');
		expect(rels).toContain(`../media/${mediaPath!.split('/').pop()}`);
		const relIdMatch = rels.match(/Id="(rId\d+)"[^>]*Target="\.\.\/media\/audio\d+\.mp3"/u);
		expect(relIdMatch).toBeTruthy();

		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).toContain('Extension="mp3"');
		expect(contentTypes).toContain('audio/mpeg');

		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('<p:stSnd>');
		expect(slideXml).toContain(`r:embed="${relIdMatch![1]}"`);

		// Round-trip: reloading resolves the relationship to a real archive path,
		// so a slideshow can actually play it (not just a dangling soundRId).
		const reloader = new PptxHandler();
		const reloaded = await reloader.load(saved.buffer as ArrayBuffer);
		const nativeAnim = reloaded.slides[0].nativeAnimations?.find((a) => a.soundRId);
		expect(nativeAnim?.soundRId).toBe(relIdMatch![1]);
		expect(nativeAnim?.soundPath).toBe(mediaPath);
	});

	it('a previously-embedded sound survives an unrelated edit to the same effect (no accidental deletion)', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slideBuilder = createSlide('Blank').addText('Hello', {
			x: 10,
			y: 10,
			width: 200,
			height: 40,
		});
		const textElement = slideBuilder.getLastElement()!;
		slideBuilder.addAnimation(textElement.id, { preset: 'fadeIn' });
		data.slides.push(slideBuilder.build());
		const animation = data.slides[0].animations!.find((a) => a.elementId === textElement.id)!;
		animation.soundData = TINY_AUDIO_DATA_URL;

		const firstSave = await handler.save(data.slides);
		const reloader = new PptxHandler();
		const reloaded = await reloader.load(firstSave.buffer as ArrayBuffer);

		// Edit an unrelated field (duration) without touching the sound picker.
		const reloadedElementId = findReloadedTextAnimationElementId(reloaded);
		const reloadedAnimation = reloaded.slides[0].animations!.find(
			(a) => a.elementId === reloadedElementId,
		)!;
		reloadedAnimation.durationMs = 900;

		const secondSave = await reloader.save(reloaded.slides);
		const zip = await JSZip.loadAsync(secondSave);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('<p:stSnd>');

		const mediaPath = Object.keys(zip.files).find((path) =>
			/^ppt\/media\/audio\d+\.mp3$/u.test(path),
		);
		expect(mediaPath).toBeDefined();
	});
});

describe('after-animation authoring round-trip', () => {
	it('writes a dim-to-color behaviour that survives reload via editor metadata', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slideBuilder = createSlide('Blank').addText('Hello', {
			x: 10,
			y: 10,
			width: 200,
			height: 40,
		});
		const textElement = slideBuilder.getLastElement()!;
		slideBuilder.addAnimation(textElement.id, { preset: 'fadeIn' });
		data.slides.push(slideBuilder.build());
		const animation = data.slides[0].animations!.find((a) => a.elementId === textElement.id)!;
		animation.afterAnimation = 'dimToColor';
		animation.afterAnimationColor = '#FF0000';

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('<p:animClr');
		expect(slideXml).toContain('FF0000');

		const reloader = new PptxHandler();
		const reloaded = await reloader.load(saved.buffer as ArrayBuffer);
		const reloadedElementId = findReloadedTextAnimationElementId(reloaded);
		const reloadedAnimation = reloaded.slides[0].animations!.find(
			(a) => a.elementId === reloadedElementId,
		);
		expect(reloadedAnimation?.afterAnimation).toBe('dimToColor');
		expect(reloadedAnimation?.afterAnimationColor?.toUpperCase()).toBe('#FF0000');
	});

	it('writes @afterEffect for hide-on-next-click', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slideBuilder = createSlide('Blank').addText('Hello', {
			x: 10,
			y: 10,
			width: 200,
			height: 40,
		});
		const textElement = slideBuilder.getLastElement()!;
		slideBuilder.addAnimation(textElement.id, { preset: 'fadeIn' });
		data.slides.push(slideBuilder.build());
		const animation = data.slides[0].animations!.find((a) => a.elementId === textElement.id)!;
		animation.afterAnimation = 'hideOnNextClick';

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('afterEffect="1"');
	});
});
