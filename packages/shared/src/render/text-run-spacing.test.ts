// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import type { RunFontSpec } from './text-metric-tracking';
import { resetMetricTrackingCache } from './text-metric-tracking';
import { splitStyledRun, stripUnderlineDecoration } from './text-run-spacing';
import type { RunStyle } from './text-run-style';

const FONT: RunFontSpec = { fontFamily: 'Arial', fontSizePx: 16 };

describe('stripUnderlineDecoration', () => {
	it('removes the underline decoration line but keeps line-through', () => {
		const style: RunStyle = { textDecoration: 'underline line-through', color: '#000000' };
		expect(stripUnderlineDecoration(style)).toStrictEqual({
			textDecoration: 'line-through',
			color: '#000000',
		});
	});

	it('drops textDecoration entirely when underline was the only line', () => {
		const style: RunStyle = { textDecoration: 'underline' };
		expect(stripUnderlineDecoration(style)).toStrictEqual({});
	});

	it('drops the underline-only variant CSS (style/thickness/offset/colour)', () => {
		const style: RunStyle = {
			textDecoration: 'underline',
			textDecorationStyle: 'wavy',
			textDecorationThickness: '3px',
			textUnderlineOffset: '2px',
			textDecorationColor: '#ff0000',
		};
		expect(stripUnderlineDecoration(style)).toStrictEqual({});
	});

	it('does not mutate the input style object', () => {
		const style: RunStyle = { textDecoration: 'underline' };
		stripUnderlineDecoration(style);
		expect(style.textDecoration).toBe('underline');
	});
});

describe('splitStyledRun u="words" (D2-G3)', () => {
	// No canvas context in this environment, so `splitRunForMetrics` always
	// collapses to a single piece; `splitStyledRun`'s own word split still has
	// to fire off that single piece, proving it does not depend on the metric
	// split having already found the word/gap boundary.
	const style: RunStyle = { textDecoration: 'underline', color: '#000000' };

	it('leaves an ordinary run (no u="words") as a single piece', () => {
		const pieces = splitStyledRun('Two Words', style, FONT, 0);
		expect(pieces).toHaveLength(1);
		expect(pieces[0]).toStrictEqual({ text: 'Two Words', style });
	});

	it('splits into per-word / per-gap pieces when underlineWords is true', () => {
		const pieces = splitStyledRun('Two Words', style, FONT, 0, true);
		expect(pieces.map((p) => p.text)).toStrictEqual(['Two', ' ', 'Words']);
	});

	it('underlines the word pieces and strips the gap piece', () => {
		const pieces = splitStyledRun('Two Words', style, FONT, 0, true);
		expect(pieces[0].style.textDecoration).toBe('underline');
		expect(pieces[1].style.textDecoration).toBeUndefined();
		expect(pieces[2].style.textDecoration).toBe('underline');
		// The gap piece keeps its other properties (colour).
		expect(pieces[1].style.color).toBe('#000000');
	});

	it('leaves a single word with no whitespace as one still-underlined piece', () => {
		const pieces = splitStyledRun('Word', style, FONT, 0, true);
		expect(pieces).toHaveLength(1);
		expect(pieces[0].style.textDecoration).toBe('underline');
	});

	it('preserves line-through alongside a per-word underline split', () => {
		const both: RunStyle = { textDecoration: 'underline line-through' };
		const pieces = splitStyledRun('A B', both, FONT, 0, true);
		expect(pieces[0].style.textDecoration).toBe('underline line-through');
		// The gap loses only the underline, not the strikethrough.
		expect(pieces[1].style.textDecoration).toBe('line-through');
	});

	it('is a no-op split for empty text', () => {
		expect(splitStyledRun('', style, FONT, 0, true)).toStrictEqual([{ text: '', style }]);
	});

	it("composes with the run's per-script font split (`paragraph-run-build.ts` calls both on every piece)", async () => {
		// `paragraph-run-build.ts` calls `splitRunByScriptFont` on EACH piece this
		// function returns, so a run that is both `u="words"` AND mixed-script
		// (rare, but the brief calls for the combination) has to end up with the
		// underline decision and the font decision both correct on the same
		// final piece - not one silently overwriting the other.
		const { splitRunByScriptFont } = await import('./text-script-fonts');
		const mixedFonts = {
			latin: 'Arial',
			eastAsia: 'SimSun',
			complexScript: 'Arial',
			symbol: 'Arial',
		};
		const pieces = splitStyledRun('Hi 中文', style, FONT, 0, true);
		expect(pieces.map((p) => p.text)).toStrictEqual(['Hi', ' ', '中文']);
		// The CJK word piece keeps its underline AND gets a script font split.
		const cjkPiece = pieces[2];
		expect(cjkPiece.style.textDecoration).toBe('underline');
		const cjkScriptRuns = splitRunByScriptFont(cjkPiece.text, mixedFonts, 'Arial', {
			textDecoration: cjkPiece.style.textDecoration,
		});
		expect(cjkScriptRuns?.[0].style?.fontFamily).toBe('SimSun');
		expect(cjkScriptRuns?.[0].style?.textDecoration).toBe('underline');
		// The gap piece has no underline to repeat onto a script span.
		const gapPiece = pieces[1];
		expect(gapPiece.style.textDecoration).toBeUndefined();
	});
});

describe('splitStyledRun letter-spacing (regression, unrelated to u="words")', () => {
	it('still clears letter-spacing on the single-piece fast path', () => {
		resetMetricTrackingCache();
		const style: RunStyle = { letterSpacing: '1px' };
		const pieces = splitStyledRun('Word', style, FONT, 0);
		expect(pieces).toStrictEqual([{ text: 'Word', style }]);
	});
});
