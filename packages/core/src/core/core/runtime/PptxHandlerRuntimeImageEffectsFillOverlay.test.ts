import { describe, expect, it } from 'vitest';

import type { PptxImageEffects, XmlObject } from '../../../index';
import { PptxHandlerRuntime } from '../PptxHandlerRuntime';

/**
 * `a:fillOverlay` resolved-colour extraction, exercised through the REAL
 * `extractImageEffects` (not a transcription of it) - the overlay was
 * previously round-tripped opaquely and never resolved to a colour a
 * renderer could composite (see `image-fill-overlay.ts` in
 * `pptx-viewer-shared`, which consumes `resolvedColor`/`resolvedOpacity`).
 */
class ImageEffectsProbe extends PptxHandlerRuntime {
	public parse(blip: XmlObject): PptxImageEffects | null {
		return this.extractImageEffects(blip);
	}
}

describe('extractImageEffects: a:fillOverlay resolved colour', () => {
	it('resolves a plain a:solidFill overlay to a hex colour and full opacity', () => {
		const parsed = new ImageEffectsProbe().parse({
			'a:fillOverlay': {
				'@_blend': 'mult',
				'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
			},
		});
		expect(parsed?.fillOverlay?.blend).toBe('mult');
		expect(parsed?.fillOverlay?.resolvedColor).toBe('#FF0000');
		expect(parsed?.fillOverlay?.resolvedOpacity).toBe(1);
		// The raw fill still round-trips losslessly regardless.
		expect(parsed?.fillOverlay?.fillRawXml).toStrictEqual({
			'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
		});
	});

	it('resolves a nested a:alpha on the overlay colour to a fractional opacity', () => {
		const parsed = new ImageEffectsProbe().parse({
			'a:fillOverlay': {
				'@_blend': 'over',
				'a:solidFill': {
					'a:srgbClr': { '@_val': '00FF00', 'a:alpha': { '@_val': '50000' } },
				},
			},
		});
		expect(parsed?.fillOverlay?.resolvedColor).toBe('#00FF00');
		expect(parsed?.fillOverlay?.resolvedOpacity).toBe(0.5);
	});

	it('leaves resolvedColor undefined for a non-solid overlay fill (gradient)', () => {
		const parsed = new ImageEffectsProbe().parse({
			'a:fillOverlay': {
				'@_blend': 'screen',
				'a:gradFill': { 'a:gsLst': {} },
			},
		});
		expect(parsed?.fillOverlay?.blend).toBe('screen');
		expect(parsed?.fillOverlay?.resolvedColor).toBeUndefined();
		expect(parsed?.fillOverlay?.resolvedOpacity).toBeUndefined();
		// The raw fill is still preserved for round-trip.
		expect(parsed?.fillOverlay?.fillRawXml).toStrictEqual({ 'a:gradFill': { 'a:gsLst': {} } });
	});
});
