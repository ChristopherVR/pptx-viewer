// @vitest-environment jsdom
/**
 * `text-metric-tracking` tests. jsdom supplies the `document` the measurer
 * reaches for; the canvas context itself is stubbed, since jsdom has no real
 * 2D context and the point here is the arithmetic, not a font.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMetricTrackingCache, resolveMetricTracking } from './text-metric-tracking';

/**
 * Stand in for a real canvas measurer. `advances` maps a character to the
 * fractional advance the browser would report at the probe font size; the
 * string width is their sum, exactly as a real font behaves.
 */
function stubCanvas(advances: Record<string, number>): { measured: string[] } {
	const measured: string[] = [];
	const ctx = {
		font: '',
		measureText(text: string) {
			measured.push(text);
			let width = 0;
			for (const char of text) {
				width += advances[char] ?? 0;
			}
			return { width };
		},
	};
	vi.spyOn(document, 'createElement').mockReturnValue({
		getContext: () => ctx,
	} as unknown as HTMLElement);
	return { measured };
}

const FONT = { fontFamily: 'Arial', fontSizePx: 16 };

beforeEach(() => {
	resetMetricTrackingCache();
});

afterEach(() => {
	vi.restoreAllMocks();
	resetMetricTrackingCache();
});

describe('resolveMetricTracking', () => {
	it('widens the run when PowerPoint measures it wider', () => {
		// 1.6px is 9.6 sixths, which snaps UP to 10 (1.6667px per glyph), so
		// PowerPoint measures four of them at 6.6667px against the browser's 6.4.
		stubCanvas({ a: 1.6 });
		expect(resolveMetricTracking('aaaa', FONT)).toBe(`${((10 / 6) * 4 - 6.4) / 4}px`);
	});

	it('goes NEGATIVE when PowerPoint measures the run narrower', () => {
		// This is the whole point of measuring instead of applying a constant:
		// 1.4px is 8.4 sixths and snaps DOWN, so PowerPoint fits a string the
		// browser thinks is too wide - issue #149's premature wraps, where a flat
		// positive constant pushed exactly these strings over their column.
		stubCanvas({ i: 1.4 });
		const tracking = resolveMetricTracking('iiii', FONT);
		expect(tracking).toBeDefined();
		expect(Number.parseFloat(tracking as string)).toBeCloseTo(((8 / 6) * 4 - 5.6) / 4, 10);
		expect(Number.parseFloat(tracking as string)).toBeLessThan(0);
	});

	it('declares nothing when the browser and PowerPoint already agree', () => {
		// A glyph advance already on the 1/6-px grid needs no correction at all.
		stubCanvas({ n: 8 });
		expect(resolveMetricTracking('nnnn', FONT)).toBeUndefined();
	});

	it('stays imperceptible however far off the grid the font sits', () => {
		// Snapping moves a glyph by at most half a step, so the correction can
		// never exceed 1/12 px per character. Nothing needs clamping.
		for (const advance of [0.001, 1.0833, 7.4999, 12.5001, 40.25]) {
			stubCanvas({ w: advance });
			resetMetricTrackingCache();
			const tracking = resolveMetricTracking('wwwwww', FONT) ?? '0px';
			expect(Math.abs(Number.parseFloat(tracking))).toBeLessThanOrEqual(1 / 12 + 1e-9);
		}
	});

	it('measures each font+string once', () => {
		const { measured } = stubCanvas({ a: 5.9 });
		resolveMetricTracking('aaaa', FONT);
		const first = measured.length;
		resolveMetricTracking('aaaa', FONT);
		expect(measured).toHaveLength(first);
		// A different size is a different measurement, not a cache hit.
		resolveMetricTracking('aaaa', { ...FONT, fontSizePx: 24 });
		expect(measured.length).toBeGreaterThan(first);
	});

	it('is a no-op for empty text', () => {
		stubCanvas({ a: 5.9 });
		expect(resolveMetricTracking('', FONT)).toBeUndefined();
	});
});
