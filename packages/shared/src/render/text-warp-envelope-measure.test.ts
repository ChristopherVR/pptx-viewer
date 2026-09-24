// @vitest-environment jsdom
/**
 * `text-warp-envelope-measure` tests. jsdom supplies `document`; the canvas
 * context is stubbed with fixed metrics (see `text-metric-tracking.test.ts`
 * for the same pattern), since jsdom has no real 2D context and the point
 * here is the measurement arithmetic, not real font shaping.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	measureGlyphAdvances,
	measureGlyphInk,
	resetGlyphEnvelopeMeasureCache,
} from './text-warp-envelope-measure';

const FONT = { fontFamily: 'Arial', fontSizePx: 20 };

function stubFixedAdvance(px: number): void {
	vi.spyOn(document, 'createElement').mockReturnValue({
		getContext: () => ({
			font: '',
			measureText(text: string) {
				return { width: [...text].length * px };
			},
		}),
	} as unknown as HTMLElement);
}

beforeEach(() => {
	resetGlyphEnvelopeMeasureCache();
});

afterEach(() => {
	vi.restoreAllMocks();
	resetGlyphEnvelopeMeasureCache();
});

describe('measureGlyphAdvances', () => {
	it('measures each character at the stubbed advance', () => {
		stubFixedAdvance(10);
		expect(measureGlyphAdvances('abc', FONT)).toStrictEqual([10, 10, 10]);
	});

	it('falls back to a font-size estimate with no DOM canvas context', () => {
		vi.spyOn(document, 'createElement').mockReturnValue({
			getContext: () => null,
		} as unknown as HTMLElement);
		const advances = measureGlyphAdvances('ab', FONT);
		expect(advances).toStrictEqual([FONT.fontSizePx * 0.55, FONT.fontSizePx * 0.55]);
	});
});

describe('measureGlyphAdvances kerning', () => {
	it('moves a kerned glyph instead of widening it (`To` closes up)', () => {
		vi.spyOn(document, 'createElement').mockReturnValue({
			getContext: () => ({
				font: '',
				fontKerning: 'auto',
				measureText(text: string) {
					const plain = [...text].length * 10;
					return { width: text.includes('To') ? plain - 2 : plain };
				},
			}),
		} as unknown as HTMLElement);
		// `T` ends where `o` starts: 8, so `T` is 8 wide and `o`/`p` keep 10.
		expect(measureGlyphAdvances('Top', FONT)).toStrictEqual([8, 10, 10]);
	});
});

describe('measureGlyphInk', () => {
	it('is undefined without ink metrics', () => {
		stubFixedAdvance(10);
		expect(measureGlyphInk('W', FONT)).toBeUndefined();
	});

	it('converts actualBoundingBox metrics into an origin-relative extent', () => {
		vi.spyOn(document, 'createElement').mockReturnValue({
			getContext: () => ({
				font: '',
				measureText: () => ({
					width: 10,
					actualBoundingBoxLeft: -1,
					actualBoundingBoxRight: 9,
					actualBoundingBoxAscent: 14,
					actualBoundingBoxDescent: 3,
				}),
			}),
		} as unknown as HTMLElement);
		expect(measureGlyphInk('g', FONT)).toStrictEqual({ left: 1, right: 9, ascent: 14, descent: 3 });
	});
});
