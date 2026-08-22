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

	it('is false when the overlay fill has nothing resolved (picture overlay)', () => {
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

	it('is true when core resolved a gradFill overlay', () => {
		expect(
			hasImageFillOverlayEffect(
				image({
					fillOverlay: {
						blend: 'mult',
						resolvedGradient: {
							type: 'linear',
							angle: 0,
							stops: [
								{ color: '#ff0000', position: 0 },
								{ color: '#0000ff', position: 1 },
							],
						},
					},
				}),
			),
		).toBeTruthy();
	});

	it('is true when core resolved a pattFill overlay', () => {
		expect(
			hasImageFillOverlayEffect(
				image({
					fillOverlay: {
						blend: 'mult',
						resolvedPattern: { preset: 'pct50', foreground: '#000000', background: '#ffffff' },
					},
				}),
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

	describe('gradient overlay', () => {
		it('composites a linear gradient as a feImage paint server, not a flood', () => {
			const f = getImageFillOverlayFilter(
				image({
					fillOverlay: {
						blend: 'mult',
						resolvedGradient: {
							type: 'linear',
							angle: 90,
							stops: [
								{ color: '#ff0000', position: 0 },
								{ color: '#0000ff', position: 1, opacity: 0.5 },
							],
						},
					},
				}),
			);
			expect(f?.filterMarkup).toContain('<feImage');
			expect(f?.filterMarkup).not.toContain('<feFlood');
			expect(f?.filterMarkup).toContain('result="fillOverlayFlood"');
			expect(f?.filterMarkup).toContain('data:image/svg+xml,');
			expect(f?.filterMarkup).toContain('mode="multiply"');
			expect(f?.filterMarkup).toContain(
				'<feComposite in="fillOverlayBlended" in2="SourceGraphic" operator="in"/>',
			);

			// The data URI embeds a linearGradient with both stops.
			const decoded = decodeURIComponent(f?.filterMarkup ?? '');
			expect(decoded).toContain('<linearGradient');
			expect(decoded).toContain('stop-color="#ff0000"');
			expect(decoded).toContain('stop-color="#0000ff"');
			expect(decoded).toContain('stop-opacity="0.5"');
		});

		it('composites a radial gradient using a radialGradient paint server', () => {
			const f = getImageFillOverlayFilter(
				image({
					fillOverlay: {
						blend: 'over',
						resolvedGradient: {
							type: 'radial',
							stops: [
								{ color: '#ffffff', position: 0 },
								{ color: '#000000', position: 1 },
							],
						},
					},
				}),
			);
			const decoded = decodeURIComponent(f?.filterMarkup ?? '');
			expect(decoded).toContain('<radialGradient');
		});

		it('sizes the paint server to the element box', () => {
			const el = image({
				fillOverlay: {
					blend: 'over',
					resolvedGradient: {
						type: 'linear',
						angle: 0,
						stops: [
							{ color: '#111111', position: 0 },
							{ color: '#222222', position: 1 },
						],
					},
				},
			});
			(el as { width: number; height: number }).width = 200;
			(el as { width: number; height: number }).height = 50;
			const f = getImageFillOverlayFilter(el);
			expect(f?.filterMarkup).toContain('width="200"');
			expect(f?.filterMarkup).toContain('height="50"');
		});

		it('returns undefined for a gradient with no stops', () => {
			const f = getImageFillOverlayFilter(
				image({ fillOverlay: { blend: 'over', resolvedGradient: { type: 'linear', stops: [] } } }),
			);
			expect(f).toBeUndefined();
		});
	});

	describe('pattern overlay', () => {
		it('composites a preset pattern via feImage + feTile, not a flood', () => {
			const f = getImageFillOverlayFilter(
				image({
					fillOverlay: {
						blend: 'darken',
						resolvedPattern: { preset: 'pct50', foreground: '#ff0000', background: '#ffffff' },
					},
				}),
			);
			expect(f?.filterMarkup).toContain('<feImage');
			expect(f?.filterMarkup).toContain('<feTile in="fillOverlayTile" result="fillOverlayFlood"/>');
			expect(f?.filterMarkup).not.toContain('<feFlood');
			expect(f?.filterMarkup).toContain('mode="darken"');
		});

		it('returns undefined for an unknown preset', () => {
			const f = getImageFillOverlayFilter(
				image({
					fillOverlay: { blend: 'over', resolvedPattern: { preset: 'not-a-real-preset' } },
				}),
			);
			expect(f).toBeUndefined();
		});
	});
});
