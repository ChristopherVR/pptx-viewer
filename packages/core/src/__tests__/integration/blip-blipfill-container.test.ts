/**
 * `a:blip` / `a:blipFill` (`CT_Blip` / `CT_BlipFillProperties`) as
 * CONTAINERS: the coverage audit found real, tested evidence for two of
 * blipFill's children in isolation (`a:srcRect`, `a:stretch`/`a:tile` -
 * see `openxml-coverage-table-style-picture-fill.ts`), but nothing exercising
 * `blip`/`blipFill` themselves - the relationship resolution
 * (`@r:embed`/`@r:link`) and the fact that editing one child (crop) has to
 * coexist with every other child the same `<a:blip>` carries
 * (`@bright`/`@contrast`, `a:duotone`, `a:tint`, ...).
 *
 * `PptxHandlerRuntimeSaveElementEmbedding.applyImageProperties` mutates the
 * ORIGINAL parsed `p:blipFill` node in place (`applyImageCropToBlipFill` then
 * `applyImageEffectsToBlip`) rather than rebuilding it from scratch, so an
 * attribute neither function knows about (this fixture uses `@cstate`, a
 * real `CT_Blip` attribute nothing in this codebase reads) survives any
 * edit made through the typed model, for free.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxImageEffects, PptxElement } from '../../core/types';

/** 1x1 red PNG as a base64 data URL. */
const TINY_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

function findPictureElement(elements: PptxElement[]): PptxElement | undefined {
	return elements.find((element) => element.type === 'image' || element.type === 'picture');
}

describe('a:blip / a:blipFill as containers', () => {
	it("resolves the picture's @r:embed relationship into imageData through blipFill/blip", async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addImage(TINY_PNG, { x: 0, y: 0, width: 100, height: 100 }).build(),
		);
		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);

		const picture = findPictureElement(reloaded.slides[0]!.elements) as PptxElement & {
			imagePath?: string;
		};
		expect(picture).toBeDefined();
		// `@r:embed` on `a:blip` resolved through the slide's relationships to
		// the actual media part `addImage` embedded - not merely "some path".
		expect(picture.imagePath).toMatch(/^ppt\/media\/image\d+\.png$/u);

		const zip = await JSZip.loadAsync(saved);
		const mediaBytes = await zip.file(picture.imagePath!)!.async('base64');
		const [, expectedBase64] = TINY_PNG.split(',');
		expect(mediaBytes).toBe(expectedBase64);
	});

	it('edits crop (a:srcRect) and image effects (blip attributes/children) together, in the same blipFill', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank')
			.addImage(TINY_PNG, {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				cropLeft: 0.1,
				cropRight: 0.05,
			})
			.build();
		// imageEffects isn't part of the builder's ImageOptions; set it directly
		// on the produced element, exactly as a binding's inspector panel would.
		const imageElement = slide.elements[0] as PptxElement & { imageEffects?: PptxImageEffects };
		imageElement.imageEffects = {
			brightness: 20,
			contrast: -10,
			duotone: { color1: '#FF0000', color2: '#0000FF' },
			tint: { hue: 90, amt: 50 },
		};
		data.slides.push(slide);

		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const picture = findPictureElement(reloaded.slides[0]!.elements) as PptxElement & {
			cropLeft?: number;
			cropRight?: number;
			imageEffects?: PptxImageEffects;
		};

		expect(picture).toBeDefined();
		// srcRect (already-covered child) still resolves correctly...
		expect(picture.cropLeft).toBeCloseTo(0.1, 5);
		expect(picture.cropRight).toBeCloseTo(0.05, 5);
		// ...alongside blip-level attributes/children the container also owns.
		expect(picture.imageEffects?.brightness).toBeCloseTo(20, 5);
		expect(picture.imageEffects?.contrast).toBeCloseTo(-10, 5);
		expect(picture.imageEffects?.duotone?.color1?.toUpperCase()).toBe('#FF0000');
		expect(picture.imageEffects?.duotone?.color2?.toUpperCase()).toBe('#0000FF');
		expect(picture.imageEffects?.tint?.hue).toBeCloseTo(90, 5);
		expect(picture.imageEffects?.tint?.amt).toBeCloseTo(50, 5);
	});

	it('preserves an unmodelled a:blip attribute (@cstate) across an edit to a sibling child', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addImage(TINY_PNG, { x: 0, y: 0, width: 100, height: 100 }).build(),
		);
		const seed = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(seed);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		// Inject a real CT_Blip attribute this codebase never reads or writes.
		const withCstate = slideXml.replace('<a:blip ', '<a:blip cstate="print" ');
		expect(withCstate).not.toBe(slideXml);
		zip.file('ppt/slides/slide1.xml', withCstate);
		const patched = await zip.generateAsync({ type: 'uint8array' });

		const editHandler = new PptxHandler();
		const loaded = await editHandler.load(patched.buffer as ArrayBuffer);
		const picture = findPictureElement(loaded.slides[0]!.elements) as PptxElement & {
			imageEffects?: PptxImageEffects;
		};
		expect(picture).toBeDefined();
		// Edit a SIBLING child (brightness), not @cstate itself.
		picture.imageEffects = { brightness: 15 };

		const resaved = await editHandler.save(loaded.slides);
		const resavedZip = await JSZip.loadAsync(resaved);
		const resavedSlideXml = await resavedZip.file('ppt/slides/slide1.xml')!.async('string');

		expect(resavedSlideXml).toContain('cstate="print"');
		expect(resavedSlideXml).toContain('bright="15000"');
	});
});
