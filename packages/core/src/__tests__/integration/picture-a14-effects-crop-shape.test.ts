/**
 * Round-trip cover for three picture properties the typed model exposed but
 * the save path silently dropped:
 *
 * - `imageEffects.artisticEffect` picked in the gallery was rendered but never
 *   written (`applyImageEffectsToBlip` never touched `a:extLst`, so the `a14`
 *   extension was missing from the file);
 * - `a14:sharpenSoften` / `a14:brightnessContrast` / `a14:colorTemperature` /
 *   `a14:saturation` were dropped on parse and therefore lost on save;
 * - `cropShape` ("Crop to Shape") was neither parsed nor written, although
 *   PowerPoint expresses it as the picture's own `a:prstGeom`.
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxImageLikeElement, PptxSlide } from '../../core/types';
import { isImageLikeElement } from '../../core/types';

/** 1x1 red PNG as a base64 data URL. */
const TINY_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const A14_URI = '{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}';

function pictureOf(slide: PptxSlide): PptxImageLikeElement {
	const picture = slide.elements.find(isImageLikeElement);
	if (!picture) {
		throw new Error('no picture on the slide');
	}
	return picture;
}

async function buildDeck(edit: (picture: PptxImageLikeElement) => void) {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	const slide = createSlide('Blank')
		.addImage(TINY_PNG, { x: 10, y: 10, width: 120, height: 80 })
		.build();
	edit(pictureOf(slide));
	data.slides.push(slide);
	return { handler, data };
}

async function slideXmlOf(saved: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	return zip.file('ppt/slides/slide1.xml')!.async('string');
}

async function saveAndReload(edit: (picture: PptxImageLikeElement) => void) {
	const { handler, data } = await buildDeck(edit);
	const saved = await handler.save(data.slides);
	const slideXml = await slideXmlOf(saved);
	const reloadHandler = new PptxHandler();
	const reloaded = await reloadHandler.load(saved.buffer as ArrayBuffer);
	return { saved, slideXml, reloadHandler, reloaded, picture: pictureOf(reloaded.slides[0]!) };
}

/** The serializer writes `<x a="1"></x>`, never `<x a="1"/>`. */
const openTag = (name: string, attrs: string): string => `<${name} ${attrs}></${name}>`;

describe('artistic effect picked in the gallery reaches the file', () => {
	it('writes the a14 extension for a gallery pick and reads it back', async () => {
		const { slideXml, picture } = await saveAndReload((pic) => {
			pic.imageEffects = { artisticEffect: 'pencilSketch', artisticRadius: 80 };
		});

		expect(slideXml).toContain(`<a:ext uri="${A14_URI}">`);
		expect(slideXml).toContain(
			'<a14:imgProps xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main">',
		);
		expect(slideXml).toContain(
			`<a14:imgLayer><a14:imgEffect>${openTag('a14:artisticPencilSketch', 'pressure="80000"')}</a14:imgEffect></a14:imgLayer>`,
		);

		expect(picture.imageEffects?.artisticEffect).toBe('artisticPencilSketch');
		expect(picture.imageEffects?.artisticRadius).toBe(80);
		expect(picture.imageEffects?.artisticParams).toStrictEqual({ pressure: 80000 });
		// Nothing was baked into the bitmap (no pristine-original layer), so the
		// effect must keep rendering after the round-trip.
		expect(picture.imageEffects?.artisticPrerenderedEffect).toBeUndefined();
		expect(picture.imageEffects?.originalImageRelId).toBeUndefined();
	});

	it('survives a second round-trip unchanged', async () => {
		const { reloadHandler, reloaded } = await saveAndReload((pic) => {
			pic.imageEffects = {
				artisticEffect: 'cutout',
				artisticParams: { trans: 0, numberOfShades: 6000 },
			};
		});
		const again = await reloadHandler.save(reloaded.slides);
		const twice = await new PptxHandler().load(again.buffer as ArrayBuffer);
		expect(pictureOf(twice.slides[0]!).imageEffects).toMatchObject({
			artisticEffect: 'artisticCutout',
			artisticParams: { trans: 0, numberOfShades: 6000 },
		});
	});

	it('removes the a14 extension again when the effect is cleared', async () => {
		const { reloadHandler, reloaded } = await saveAndReload((pic) => {
			pic.imageEffects = { artisticEffect: 'marker' };
		});
		const picture = pictureOf(reloaded.slides[0]!);
		// An attribute-less effect (`<a14:artisticMarker/>`, all defaults) is
		// still the effect.
		expect(picture.imageEffects?.artisticEffect).toBe('artisticMarker');

		picture.imageEffects = { artisticEffect: 'none' };
		const cleared = await reloadHandler.save(reloaded.slides);
		const slideXml = await slideXmlOf(cleared);
		expect(slideXml).not.toContain(A14_URI);
		expect(slideXml).not.toContain('a14:artistic');

		const twice = await new PptxHandler().load(cleared.buffer as ArrayBuffer);
		expect(pictureOf(twice.slides[0]!).imageEffects?.artisticEffect).toBeUndefined();
	});
});

describe('a14 Corrections / Color panel effects round-trip', () => {
	it('writes and re-parses sharpenSoften, brightnessContrast, colorTemperature and saturation', async () => {
		const { slideXml, picture } = await saveAndReload((pic) => {
			pic.imageEffects = {
				sharpenSoften: { amount: 25000 },
				brightnessContrast: { bright: 20000, contrast: -40000 },
				colorTemperature: { colorTemp: 4700 },
				colorSaturation: { sat: 166000 },
			};
		});

		expect(slideXml).toContain(openTag('a14:sharpenSoften', 'amount="25000"'));
		expect(slideXml).toContain(
			openTag('a14:brightnessContrast', 'bright="20000" contrast="-40000"'),
		);
		expect(slideXml).toContain(openTag('a14:colorTemperature', 'colorTemp="4700"'));
		expect(slideXml).toContain(openTag('a14:saturation', 'sat="166000"'));

		expect(picture.imageEffects).toMatchObject({
			sharpenSoften: { amount: 25000 },
			brightnessContrast: { bright: 20000, contrast: -40000 },
			colorTemperature: { colorTemp: 4700 },
			colorSaturation: { sat: 166000 },
		});
	});
});

describe('cropShape ("Crop to Shape") round-trip', () => {
	it('writes the matching a:prstGeom and re-parses cropShape', async () => {
		const { slideXml, picture } = await saveAndReload((pic) => {
			pic.cropShape = 'ellipse';
		});
		expect(slideXml).toMatch(/<p:pic>[\s\S]*?<a:prstGeom prst="ellipse">/u);
		expect(picture.cropShape).toBe('ellipse');
		expect(picture.shapeType).toBe('ellipse');
	});

	it('maps every gallery shape onto its preset', async () => {
		for (const [cropShape, preset] of [
			['roundedRect', 'roundRect'],
			['triangle', 'triangle'],
			['diamond', 'diamond'],
			['pentagon', 'pentagon'],
			['hexagon', 'hexagon'],
			['star', 'star5'],
		] as const) {
			const { slideXml, picture } = await saveAndReload((pic) => {
				pic.cropShape = cropShape;
			});
			expect(slideXml).toContain(`<a:prstGeom prst="${preset}">`);
			expect(picture.cropShape).toBe(cropShape);
		}
	});

	it("leaves the geometry alone for 'none' and when unset", async () => {
		const none = await saveAndReload((pic) => {
			pic.cropShape = 'none';
		});
		expect(none.slideXml).toContain('<a:prstGeom prst="rect">');
		expect(none.picture.cropShape).toBeUndefined();

		const unset = await saveAndReload(() => {});
		expect(unset.slideXml).toContain('<a:prstGeom prst="rect">');
		expect(unset.picture.cropShape).toBeUndefined();
	});

	it('does not pull a directly changed shapeType back to the crop parsed on load', async () => {
		const { reloadHandler, reloaded } = await saveAndReload((pic) => {
			pic.cropShape = 'ellipse';
		});
		const picture = pictureOf(reloaded.slides[0]!);
		expect(picture.cropShape).toBe('ellipse');

		// The user changes the preset directly; the stale crop must not win.
		picture.shapeType = 'roundRect';
		const saved = await reloadHandler.save(reloaded.slides);
		const slideXml = await slideXmlOf(saved);
		expect(slideXml).toContain('<a:prstGeom prst="roundRect">');

		const twice = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(pictureOf(twice.slides[0]!).cropShape).toBe('roundedRect');
	});
});
