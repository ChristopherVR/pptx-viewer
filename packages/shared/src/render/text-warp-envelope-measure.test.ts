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
	measureLineAscent,
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

/** Stub `measureText` to also report a fixed `actualBoundingBoxAscent`. */
function stubAscent(widthPerChar: number, actualBoundingBoxAscent: number | undefined): void {
	vi.spyOn(document, 'createElement').mockReturnValue({
		getContext: () => ({
			font: '',
			measureText(text: string) {
				return { width: [...text].length * widthPerChar, actualBoundingBoxAscent };
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

describe('measureLineAscent', () => {
	it('is undefined with no DOM canvas context', () => {
		vi.spyOn(document, 'createElement').mockReturnValue({
			getContext: () => null,
		} as unknown as HTMLElement);
		expect(measureLineAscent([{ text: 'W', font: FONT, segmentIndex: 0 }])).toBeUndefined();
	});

	it('is undefined when measureText reports no actualBoundingBoxAscent', () => {
		// jsdom's own `measureText` stub (and any environment without real
		// glyph-ink measurement) omits this field entirely.
		stubFixedAdvance(10);
		expect(measureLineAscent([{ text: 'W', font: FONT, segmentIndex: 0 }])).toBeUndefined();
	});

	it('skips empty segments and ignores a non-finite ascent', () => {
		stubAscent(10, Number.NaN);
		expect(
			measureLineAscent([
				{ text: '', font: FONT, segmentIndex: 0 },
				{ text: 'W', font: FONT, segmentIndex: 1 },
			]),
		).toBeUndefined();
	});

	it('is the tallest actualBoundingBoxAscent across every segment on the line', () => {
		vi.spyOn(document, 'createElement').mockReturnValue({
			getContext: () => ({
				font: '',
				measureText(text: string) {
					return { width: 10, actualBoundingBoxAscent: text === 'tall' ? 40 : 12 };
				},
			}),
		} as unknown as HTMLElement);
		const ascent = measureLineAscent([
			{ text: 'short', font: FONT, segmentIndex: 0 },
			{ text: 'tall', font: FONT, segmentIndex: 1 },
		]);
		expect(ascent).toBe(40);
	});
});
