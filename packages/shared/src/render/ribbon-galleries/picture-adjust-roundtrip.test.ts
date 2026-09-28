import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';
import type { RibbonGalleryId } from './gallery-types';

const PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

type Pick = readonly [RibbonGalleryId, string];

function effectsAfter(gallery: RibbonGalleryId, itemId: string, element: PptxElement) {
	const result = applyRibbonGalleryItem(gallery, itemId, { element });
	if (result?.kind !== 'element') {
		throw new Error(`no patch for ${gallery}/${itemId}`);
	}
	return (result.patch as { imageEffects: PptxImageEffects }).imageEffects;
}

function appliedIds(gallery: RibbonGalleryId, element: PptxElement): string[] {
	return buildRibbonGallery(gallery, { element })
		.sections.flatMap((s) => s.items)
		.filter((i) => i.applied)
		.map((i) => i.id);
}

/** Apply `picks` in order, save, reload and return the picture as loaded. */
async function roundTrip(picks: readonly Pick[]): Promise<PptxElement> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({ title: 'Pictures' });
	data.slides = [
		createSlide('Blank').addImage(PNG, { x: 50, y: 50, width: 240, height: 180 }).build(),
	];
	const loadedHandler = new PptxHandler();
	const loaded = await loadedHandler.load((await handler.save(data.slides)).buffer as ArrayBuffer);
	const slide = loaded.slides[0];
	const target = slide.elements.find((el) => el.type === 'image' || el.type === 'picture');
	if (!target) {
		throw new Error('no picture');
	}
	let element = target;
	for (const [gallery, id] of picks) {
		element = { ...element, imageEffects: effectsAfter(gallery, id, element) } as PptxElement;
	}
	slide.elements = slide.elements.map((el) => (el.id === target.id ? element : el));
	const reloaded = await new PptxHandler().load(
		(await loadedHandler.save(loaded.slides)).buffer as ArrayBuffer,
	);
	return reloaded.slides[0].elements.find((el) => el.id === target.id) as PptxElement;
}

describe('picture adjust galleries: save round trip', () => {
	it('reloads corrections, color and artistic picks as applied', async () => {
		const back = await roundTrip([
			['pictureCorrections', 'soften25'],
			['pictureCorrections', 'bc_b20_c-20'],
			['pictureColor', 'saturation200'],
			['pictureColor', 'tone8000'],
			['pictureColor', 'recolorSepia'],
			['pictureArtisticEffects', 'paintStrokes'],
		]);
		expect(appliedIds('pictureCorrections', back)).toStrictEqual(['soften25', 'bc_b20_c-20']);
		expect(appliedIds('pictureColor', back)).toStrictEqual([
			'saturation200',
			'tone8000',
			'recolorSepia',
		]);
		expect(appliedIds('pictureArtisticEffects', back)).toStrictEqual(['paintStrokes']);
	});

	it.each(['mosaic', 'glow_edges', 'paint', 'lineDrawing', 'watercolorSponge'])(
		'reloads artistic effect %s as applied',
		async (name) => {
			const back = await roundTrip([['pictureArtisticEffects', name]]);
			expect(appliedIds('pictureArtisticEffects', back)).toStrictEqual([name]);
		},
	);

	it('reloads black and white and washout recolors as applied', async () => {
		const bw = await roundTrip([['pictureColor', 'recolorBlackWhite25']]);
		expect(appliedIds('pictureColor', bw)).toContain('recolorBlackWhite25');
		const washout = await roundTrip([['pictureColor', 'recolorWashout']]);
		expect(appliedIds('pictureColor', washout)).toContain('recolorWashout');
	});
});
