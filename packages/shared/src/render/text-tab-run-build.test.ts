// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { resetMetricTrackingCache } from './text-metric-tracking';
import type { RunStyle } from './text-run-style';
import { buildTabContext } from './text-tab-layout';
import type { TabRenderContext, TabStopSpec } from './text-tab-layout';
import { buildRunTabLines } from './text-tab-run-build';

/** Deterministic monospace measurement: 10px per character, 5px per glyph. */
const measure = (text: string): number => (text.length === 1 ? 5 : text.length * 10);

function ctxWith(stops: TabStopSpec[], defaultTabSize = 48): TabRenderContext {
	return {
		tabStops: stops,
		defaultTabSize,
		font: '400 16px Arial',
		// No real canvas in this (non-jsdom) test environment, so the advance-grid
		// correction resolves to 0 regardless of these values; present only to
		// satisfy `TabRenderContext`'s shape.
		runFont: { fontFamily: 'Arial', fontSizePx: 16 },
	};
}

describe('buildRunTabLines', () => {
	it('reserves the gap width for a left tab even with no leader glyph authored', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const lines = buildRunTabLines('A\tB', ctxWith(stops), undefined, measure);
		expect(lines).toHaveLength(1);
		expect(lines[0].pieces).toHaveLength(2);
		expect(lines[0].pieces[0].text).toBe('A');
		expect(lines[0].pieces[0].leaderStyle).toBeUndefined();
		expect(lines[0].pieces[1].text).toBe('B');
		// The gap still gets a sized spacer span (so the tab stop lands exactly),
		// just with no fill glyph inside it.
		expect(lines[0].pieces[1].leaderStyle).toBeDefined();
		expect(lines[0].pieces[1].leaderText).toBe('');
	});

	it('fills a dot-leader gap with a ready leader string', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'r', leader: 'dot' }];
		const lines = buildRunTabLines('Label\t12', ctxWith(stops), undefined, measure);
		const [, second] = lines[0].pieces;
		expect(second.leaderStyle).toBeDefined();
		// "Label" measures 50px, the stop is at 100px, "12" measures 20px, so a
		// right tab lands the gap at 100 - 20 - 50 = 30px.
		expect(second.leaderStyle?.width).toBe('30px');
		expect(second.leaderText).toMatch(/^\.+$/u);
	});

	it('centers a piece on a ctr stop and right-aligns on an r stop', () => {
		const stops: TabStopSpec[] = [
			{ position: 100, align: 'ctr' },
			{ position: 200, align: 'r' },
		];
		const lines = buildRunTabLines('\tAB\tC', ctxWith(stops), undefined, measure);
		expect(lines[0].pieces).toHaveLength(3);
		// Piece text is preserved regardless of alignment.
		expect(lines[0].pieces[1].text).toBe('AB');
		expect(lines[0].pieces[2].text).toBe('C');
	});

	it('aligns a decimal tab on the decimal point', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'dec' }];
		const lines = buildRunTabLines('\t12.34', ctxWith(stops), undefined, measure);
		expect(lines[0].pieces[1].text).toBe('12.34');
	});

	it('splits into one entry per line and keeps pieces independent per line', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const lines = buildRunTabLines('A\tB\nC\tD', ctxWith(stops), undefined, measure);
		expect(lines).toHaveLength(2);
		expect(lines[0].pieces.map((p) => p.text)).toStrictEqual(['A', 'B']);
		expect(lines[1].pieces.map((p) => p.text)).toStrictEqual(['C', 'D']);
	});

	it("repeats the run's decoration onto every piece span", () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const decoration: RunStyle = { textDecoration: 'underline' };
		const lines = buildRunTabLines('A\tB', ctxWith(stops), decoration, measure);
		for (const piece of lines[0].pieces) {
			expect(piece.style.textDecoration).toBe('underline');
		}
	});

	it('gives every piece an inline-block, whitespace-preserving style', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const lines = buildRunTabLines('A\tB', ctxWith(stops), undefined, measure);
		for (const piece of lines[0].pieces) {
			expect(piece.style.display).toBe('inline-block');
			expect(piece.style.whiteSpace).toBe('pre');
		}
	});
});

/**
 * A tab-containing run used to give up PowerPoint's advance-width grid
 * compensation entirely (see `paragraph-run-build.ts`'s tab branch): the
 * measured tab-stop layout replaced the per-word metric split, and nothing
 * put the correction back. These pin that each piece now gets its own
 * `letter-spacing` correction (`resolveMetricTrackingPx`), AND that the tab
 * stop itself is positioned against that corrected width rather than the
 * browser's raw measurement - which is what keeps the leader gap and the next
 * stop from drifting once the correction is actually painted.
 */
describe('powerPoint advance-width tracking inside a tab-containing run', () => {
	/** Stub `document.createElement('canvas').getContext('2d')` with additive per-char advances. */
	function stubCanvas(advances: Record<string, number>): void {
		const ctx = {
			font: '',
			fontKerning: 'auto',
			measureText(text: string) {
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
	}

	beforeEach(() => {
		// Earlier tests in this file measure with their own deterministic
		// `measure` callback, but `resolveTrackedTextWidth` still probes the REAL
		// canvas underneath (for the advance-grid correction itself), and jsdom's
		// unimplemented 2D context caches as a permanent `null`. Reset before each
		// test here so this describe's own canvas stub is what gets cached.
		resetMetricTrackingCache();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		resetMetricTrackingCache();
	});

	it('gives a piece off the advance grid its own non-zero letter-spacing', () => {
		// 1.6px is 9.6 sixths, which snaps UP to 10 (1.6667px/glyph): same fixture
		// as `text-metric-tracking.test.ts`, so the numbers are cross-checked there.
		stubCanvas({ a: 1.6, B: 5 });
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const ctx = buildTabContext(stops, 48, 16, 'Arial', false, false);
		expect(ctx).toBeDefined();
		const [first, second] = buildRunTabLines('aaaa\tB', ctx as TabRenderContext)[0].pieces;
		expect(first.style.letterSpacing).not.toBe('normal');
		expect(Number.parseFloat(first.style.letterSpacing as string)).toBeCloseTo(
			((10 / 6) * 4 - 6.4) / 4,
			10,
		);
		// 'B' already advances on the grid (5px = 30 sixths exactly), so its own
		// piece needs no correction - and gets an EXPLICIT 'normal', not merely an
		// omitted property, so it cannot inherit the run's own (whole-text, wrong)
		// tracking through CSS `letter-spacing` inheritance.
		expect(second.style.letterSpacing).toBe('normal');
	});

	it('lays the tab stop out against the TRACKED width, not the raw measurement', () => {
		stubCanvas({ a: 1.6, B: 5 });
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const ctx = buildTabContext(stops, 48, 16, 'Arial', false, false);
		const [, second] = buildRunTabLines('aaaa\tB', ctx as TabRenderContext)[0].pieces;
		// Untracked, "aaaa" measures 6.4px and the gap would be 100 - 6.4 = 93.6.
		// PowerPoint's snapped width is (10/6)*4 = 6.6667px, so once the first
		// piece actually paints at that width (via its own letter-spacing above),
		// the gap has to be measured against the SAME width or the leader spacer
		// would either overlap "aaaa" or leave a visible seam before the stop.
		expect(second.leaderStyle).toBeDefined();
		expect(Number.parseFloat(second.leaderStyle?.width as string)).toBeCloseTo(
			100 - (10 / 6) * 4,
			10,
		);
	});

	it('is a no-op when every glyph already sits on the advance grid', () => {
		// 8px/glyph is 48 sixths exactly: nothing to correct, so every piece gets
		// the explicit no-op rather than a spurious non-zero value.
		stubCanvas({ n: 8 });
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const ctx = buildTabContext(stops, 48, 16, 'Arial', false, false);
		const pieces = buildRunTabLines('nn\tnn', ctx as TabRenderContext)[0].pieces;
		for (const piece of pieces) {
			expect(piece.style.letterSpacing).toBe('normal');
		}
	});
});
