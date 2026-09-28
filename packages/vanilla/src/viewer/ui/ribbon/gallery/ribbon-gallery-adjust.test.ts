import type { PptxElement, PptxImageEffects, PptxSlide } from 'pptx-viewer-core';
import type { RibbonGalleryContext, RibbonGalleryPlacement } from 'pptx-viewer-shared';
import { CONTEXTUAL_TAB_GROUPS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createGalleryActions } from '../../../editor/editor-gallery-actions';
import { createTranslator } from '../../../i18n';
import { createInitialViewerState, createStore } from '../../../state';
import { createRibbonGalleryHub } from './gallery-hub';
import { createRibbonGallery } from './ribbon-gallery';

/**
 * Picture Format > Adjust: the Corrections, Color and Artistic Effects
 * dropdown galleries over a real picture, through the real shared galleries
 * and the editor's undoable gallery-actions path.
 */
function picture(): PptxElement {
	return {
		id: 'p1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeStyle: {},
	} as unknown as PptxElement;
}

const ADJUST = CONTEXTUAL_TAB_GROUPS.pictureFormat.find((g) => g.group === 'pictureFormat.adjust');
const placementFor = (gallery: string): RibbonGalleryPlacement =>
	ADJUST?.galleries.find((p) => p.gallery === gallery) as RibbonGalleryPlacement;

function context(element: PptxElement | null): RibbonGalleryContext {
	return { element, themeColorMap: { accent1: '#156082' } };
}

describe('picture adjust galleries (vanilla)', () => {
	it('places three dropdown galleries in the Adjust group', () => {
		expect(ADJUST?.galleries.map((p) => [p.gallery, p.mode])).toStrictEqual([
			['pictureCorrections', 'dropdown'],
			['pictureColor', 'dropdown'],
			['pictureArtisticEffects', 'dropdown'],
		]);
	});

	it.each([
		['pictureCorrections', 'soften50', 'sharpenSoften', { amount: -50000 }],
		['pictureColor', 'saturation200', 'colorSaturation', { sat: 200000 }],
		['pictureColor', 'recolorGrayscale', 'grayscale', true],
		['pictureArtisticEffects', 'paintStrokes', 'artisticEffect', 'paintStrokes'],
	] as const)(
		'%s pick %s updates imageEffects.%s and marks the tile',
		(gallery, item, key, value) => {
			const slide = { id: 'slide1', rId: 'r1', slideNumber: 1, elements: [picture()] };
			const store = createStore({
				...createInitialViewerState(),
				editable: true,
				slides: [slide as unknown as PptxSlide],
				selectedElementId: 'p1',
				selectedElementIds: ['p1'],
			});
			const ops = { pushHistory: vi.fn(), commitChange: vi.fn() };
			const actions = createGalleryActions({ store, ops, deck: { applyThemeEdit: vi.fn() } });
			const hub = createRibbonGalleryHub((result) => actions.applyRibbonGalleryResult(result));
			const control = createRibbonGallery(document, createTranslator(), placementFor(gallery), hub);
			hub.sync(context(picture()), true);
			expect(control.el.getAttribute('data-ribbon-control')).toBe(placementFor(gallery).control);
			expect(control.trigger.disabled).toBeFalsy();
			control.trigger.click();
			expect(control.popup.querySelector('[data-gallery-item] svg')).not.toBeNull();
			control.popup.querySelector<HTMLButtonElement>(`[data-gallery-item="${item}"]`)!.click();
			expect(ops.pushHistory).toHaveBeenCalledOnce();
			const updated = store.get().slides[0].elements[0];
			const effects = (updated as { imageEffects?: PptxImageEffects }).imageEffects;
			expect(effects?.[key as keyof PptxImageEffects]).toStrictEqual(value);
			hub.sync(context(updated), true);
			control.trigger.click();
			expect(
				control.popup.querySelector(`[data-gallery-item="${item}"]`)?.getAttribute('aria-pressed'),
			).toBe('true');
		},
	);

	it('is disabled without a picture selection', () => {
		const hub = createRibbonGalleryHub(vi.fn());
		const control = createRibbonGallery(
			document,
			createTranslator(),
			placementFor('pictureColor'),
			hub,
		);
		hub.sync(context(null), true);
		expect(control.trigger.disabled).toBeTruthy();
	});
});
