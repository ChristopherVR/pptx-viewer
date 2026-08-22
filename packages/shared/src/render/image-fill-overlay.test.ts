import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	getImageFillOverlayFilter,
	getImageFillOverlayFilterId,
	hasImageFillOverlayEffect,
} from './image-fill-overlay';

/** Build an image element with the given effects. */
function image(effects?: PptxImageEffects, id = 'img1'): PptxElement {
	return {
		type: 'image',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imageEffects: effects,
	} as PptxElement;
}

/** Build a non-image element (shape). */
function shape(): PptxElement {
	return { type: 'shape', id: 's1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
}

describe('getImageFillOverlayFilterId', () => {
	it('is stable per element id', () => {
		expect(getImageFillOverlayFilterId('abc')).toBe('imgoverlay-abc');
	});
});

describe('hasImageFillOverlayEffect', () => {
	it('is false for a non-image element', () => {
		expect(hasImageFillOverlayEffect(shape())).toBeFalsy();
	});

	it('is false when there are no effects', () => {
		expect(hasImageFillOverlayEffect(image())).toBeFalsy();
		expect(hasImageFillOverlayEffect(image({}))).toBeFalsy();
	});

	it('is false when the overlay fill has no resolved colour (gradient/pattern/blip overlay)', () => {
		expect(
			hasImageFillOverlayEffect(image({ fillOverlay: { blend: 'mult', fillRawXml: {} } })),
		).toBeFalsy();
	});

	it('is true when core resolved a solidFill overlay colour', () => {
		expect(
			hasImageFillOverlayEffect(
				image({ fillOverlay: { blend: 'mult', resolvedColor: '#ff0000' } }),
			),
		).toBeTruthy();
	});
});

describe('getImageFillOverlayFilter', () => {
	it('returns undefined without a resolved overlay colour', () => {
		expect(getImageFillOverlayFilter(image({}))).toBeUndefined();
		expect(getImageFillOverlayFilter(shape())).toBeUndefined();
	});

	it('builds a flood -> blend -> clip-to-source-alpha filter chain', () => {
		const f = getImageFillOverlayFilter(
			image({ fillOverlay: { blend: 'darken', resolvedColor: '#abcdef', resolvedOpacity: 0.75 } }),
		);
		expect(f?.id).toBe('imgoverlay-img1');
		expect(f?.cssReference).toBe('url(#imgoverlay-img1)');
		expect(f?.filterMarkup).toBe(
			'<feFlood flood-color="#abcdef" flood-opacity="0.75" result="fillOverlayFlood"/>' +
				'<feBlend in="fillOverlayFlood" in2="SourceGraphic" mode="darken" result="fillOverlayBlended"/>' +
				'<feComposite in="fillOverlayBlended" in2="SourceGraphic" operator="in"/>',
		);
	});

	it.each([
		['over', 'normal'],
		['mult', 'multiply'],
		['screen', 'screen'],
		['darken', 'darken'],
		['lighten', 'lighten'],
	] as const)('maps blend "%s" to feBlend mode "%s"', (blend, mode) => {
		const f = getImageFillOverlayFilter(
			image({ fillOverlay: { blend, resolvedColor: '#000000' } }),
		);
		expect(f?.filterMarkup).toContain(`mode="${mode}"`);
	});

	it('defaults resolvedOpacity to fully opaque (1) when unset', () => {
		const f = getImageFillOverlayFilter(
			image({ fillOverlay: { blend: 'over', resolvedColor: '#000000' } }),
		);
		expect(f?.filterMarkup).toContain('flood-opacity="1"');
	});

	it('uses the explicit elementId override rather than the element id', () => {
		const f = getImageFillOverlayFilter(
			image({ fillOverlay: { blend: 'over', resolvedColor: '#000000' } }),
			'custom-id',
		);
		expect(f?.id).toBe('imgoverlay-custom-id');
	});
});
