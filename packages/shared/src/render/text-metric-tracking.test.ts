// @vitest-environment jsdom
/**
 * `text-metric-tracking` tests. jsdom supplies the `document` the measurer
 * reaches for; the canvas context itself is stubbed, since jsdom has no real
 * 2D context and the point here is the arithmetic, not a font.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	resetMetricTrackingCache,
	resolveMetricTracking,
	resolveMetricTrackingPx,
	splitRunForMetrics,
} from './text-metric-tracking';

/**
 * Stand in for a real canvas measurer. `advances` maps a character to the
 * fractional advance the browser would report at the probe font size.
 *
 * `shape` optionally rewrites the measured width of a whole string, standing in
 * for the cases where a character's advance depends on its neighbours: Arabic
 * joining, Devanagari conjuncts, emoji ZWJ sequences, and kerning. Those broke
 * the first version of this module, so the stub has to express them. It is
 * handed the context's `fontKerning`, because the measurer deliberately reads
 * PowerPoint's (unkerned) advances and the browser's (kerned) painted width.
 */
function stubCanvas(
	advances: Record<string, number>,
	shape?: (text: string, summed: number, kerning: string) => number,
): { measured: string[] } {
	const measured: string[] = [];
	const ctx = {
		font: '',
		fontKerning: 'auto',
		measureText(text: string) {
			measured.push(text);
			let width = 0;
			for (const char of text) {
				width += advances[char] ?? 0;
			}
			return { width: shape ? shape(text, width, ctx.fontKerning) : width };
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

describe('splitRunForMetrics', () => {
	it('gives every word and every gap its own tracking', () => {
		// 'a' snaps UP (9.6 -> 10 sixths), 'i' snaps DOWN (8.4 -> 8), so the two
		// words need opposite corrections. One run-level value could not serve
		// both, and a line ending after either would measure wrong.
		stubCanvas({ a: 1.6, i: 1.4, ' ': 3 });
		const pieces = splitRunForMetrics('aa ii', FONT);
		expect(pieces.map((p) => p.text)).toStrictEqual(['aa', ' ', 'ii']);
		expect(pieces[0].tracking).toBeGreaterThan(0);
		expect(pieces[2].tracking).toBeLessThan(0);
		// A space already on the grid needs nothing.
		expect(pieces[1].tracking).toBe(0);
	});

	it('makes every whole-piece prefix measure what PowerPoint measured', () => {
		// The property the fix rests on: advances add up, so if each piece is
		// exact then so is any line composed of whole pieces.
		stubCanvas({ a: 1.6, i: 1.4, ' ': 3.05, n: 2.9 });
		const text = 'aan ii aa nn';
		const pieces = splitRunForMetrics(text, FONT);
		const natural = (s: string) =>
			[...s].length && [...s].reduce((w, c) => w + { a: 1.6, i: 1.4, ' ': 3.05, n: 2.9 }[c], 0);
		const powerPoint = (s: string) =>
			[...s].reduce((w, c) => w + Math.round({ a: 1.6, i: 1.4, ' ': 3.05, n: 2.9 }[c] * 6) / 6, 0);
		let rendered = 0;
		let expected = 0;
		for (const piece of pieces) {
			rendered += natural(piece.text) + [...piece.text].length * piece.tracking;
			expected += powerPoint(piece.text);
			expect(rendered).toBeCloseTo(expected, 10);
		}
	});

	it('leaves a run with no break opportunity as one piece', () => {
		stubCanvas({ a: 1.6 });
		const pieces = splitRunForMetrics('aaaa', FONT);
		expect(pieces).toHaveLength(1);
		expect(pieces[0].tracking).toBe(resolveMetricTrackingPx('aaaa', FONT));
	});

	it('cuts after a hyphen, where the browser may also break', () => {
		stubCanvas({ a: 1.6, '-': 2, i: 1.4 });
		expect(splitRunForMetrics('aa-ii', FONT).map((p) => p.text)).toStrictEqual(['aa-', 'ii']);
	});
});

describe('scripts where advances are not additive', () => {
	// Measuring characters one at a time would report a width far wider than the
	// string, and the tracking would try to make up the difference by stretching
	// the run. These pin that it cannot.

	it('is a no-op when glyphs join, however hard the shaping bites', () => {
		// Joined letters render at 60% of their isolated widths (Arabic-like).
		// Prefix differencing telescopes to the shaped total, so the shaping
		// cancels out entirely and only the grid rounding is left.
		stubCanvas({ a: 10, b: 10, c: 10 }, (text, summed) =>
			text.length > 1 ? summed * 0.6 : summed,
		);
		expect(resolveMetricTrackingPx('abc', FONT)).toBe(0);
	});

	it('refuses to undo kerning by stretching the run', () => {
		// The browser kerns "AV" 2px tighter; PowerPoint, measuring unkerned,
		// does not. That is a real width difference but not a rounding error, so
		// the correction is capped rather than spreading 2px across the run.
		stubCanvas({ A: 10, V: 10 }, (text, summed, kerning) =>
			kerning !== 'none' && text === 'AV' ? summed - 2 : summed,
		);
		expect(Math.abs(resolveMetricTrackingPx('AV', FONT))).toBeCloseTo(1 / 12, 10);
	});

	it('still corrects an ordinary run to the grid', () => {
		// No shaping, no kerning: the correction is the real rounding error and
		// lands well inside the cap.
		stubCanvas({ a: 1.6 });
		const tracking = resolveMetricTrackingPx('aaaa', FONT);
		expect(tracking).toBeCloseTo(((10 / 6) * 4 - 6.4) / 4, 10);
		expect(Math.abs(tracking)).toBeLessThan(1 / 12);
	});
});
