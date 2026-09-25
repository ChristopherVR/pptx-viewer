import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeAutoFitTextStyle,
	isVerticalTextDirection,
	resolveVerticalAnchorJustifyContent,
	scaleFontSizeForAutoFit,
	toCssTextOrientation,
	toCssVerticalDirection,
	toCssWritingMode,
} from './text-style-helpers';

describe('scaleFontSizeForAutoFit', () => {
	it('rounds a normAutofit-scaled size to the nearest whole point (COM ground truth)', () => {
		// audit-text corpus: PowerPoint scales a 28pt run by fontScale 62.5% and
		// paints 18pt, not the raw 17.5pt product.
		expect(scaleFontSizeForAutoFit(28, 0.625)).toBe(18);
		// fontScale 40% on the same 28pt run: 11.2 rounds to 11.
		expect(scaleFontSizeForAutoFit(28, 0.4)).toBe(11);
	});

	it('leaves the size untouched (including fractional points) when fontScale is 1', () => {
		expect(scaleFontSizeForAutoFit(10.5, 1)).toBe(10.5);
	});

	it('rounds half up, matching Math.round', () => {
		expect(scaleFontSizeForAutoFit(20, 0.875)).toBe(18); // 17.5 -> 18
	});
});

describe('vertical text mapping', () => {
	it('maps text directions to writing-mode', () => {
		expect(toCssWritingMode('vertical')).toBe('vertical-rl');
		expect(toCssWritingMode('eaVert')).toBe('vertical-rl');
		expect(toCssWritingMode('wordArtVertRtl')).toBe('vertical-rl');
		expect(toCssWritingMode('vertical270')).toBe('vertical-lr');
		expect(toCssWritingMode('mongolianVert')).toBe('vertical-lr');
		// PowerPoint's WordArt "Stacked" vertical grows a wrapped column to the
		// RIGHT (vertical-lr), the opposite of `eaVert`/`vertical`; only its
		// "Rtl" sibling grows left (see the writing-mode doc comment).
		expect(toCssWritingMode('wordArtVert')).toBe('vertical-lr');
		expect(toCssWritingMode('horizontal')).toBeUndefined();
		expect(toCssWritingMode(undefined)).toBeUndefined();
	});

	it('rotates every glyph including CJK for vert/vert270, but not eaVert', () => {
		// `vertical` (`vert`) and `vertical270` rotate ALL glyphs, CJK included:
		// CSS `sideways`. `eaVert` keeps CJK upright and only rotates non-CJK
		// runs: CSS `mixed`. These must not collapse to the same value, or the
		// two vertical modes render identically (audit-text/pp/s3.png columns
		// 1 vs 3 show visibly different CJK glyph rotation).
		expect(toCssTextOrientation('vertical')).toBe('sideways');
		expect(toCssTextOrientation('vertical270')).toBe('sideways');
		expect(toCssTextOrientation('eaVert')).toBe('mixed');
		expect(toCssTextOrientation('mongolianVert')).toBe('mixed');
	});

	it('stacks every glyph upright for both WordArt vertical modes', () => {
		// `wordArtVert` and `wordArtVertRtl` differ only in which side a wrapped
		// column grows on (`toCssWritingMode`), never in glyph rotation.
		expect(toCssTextOrientation('wordArtVert')).toBe('upright');
		expect(toCssTextOrientation('wordArtVertRtl')).toBe('upright');
		expect(toCssTextOrientation('horizontal')).toBeUndefined();
	});

	it('only vertical270 reads bottom-to-top (direction rtl)', () => {
		expect(toCssVerticalDirection('vertical270')).toBe('rtl');
		expect(toCssVerticalDirection('vertical')).toBeUndefined();
		expect(toCssVerticalDirection('eaVert')).toBeUndefined();
		// wordArtVertRtl's "Rtl" is a column-growth direction (writing-mode),
		// not a reading-order reversal: it still reads top-to-bottom.
		expect(toCssVerticalDirection('wordArtVertRtl')).toBeUndefined();
	});

	it('detects vertical directions', () => {
		expect(isVerticalTextDirection('vertical')).toBeTruthy();
		expect(isVerticalTextDirection('mongolianVert')).toBeTruthy();
		expect(isVerticalTextDirection('horizontal')).toBeFalsy();
		expect(isVerticalTextDirection(undefined)).toBeFalsy();
	});
});

describe('computeAutoFitTextStyle', () => {
	const base = {
		text: 'hello world',
		width: 200,
		height: 100,
		bodyInsetVertical: 0,
		hasItalicRuns: false,
		defaultFontSize: 18,
	};

	it('returns an empty object when autoFit is off', () => {
		expect(computeAutoFitTextStyle({ ...base, textStyle: {} })).toStrictEqual({});
		expect(computeAutoFitTextStyle({ ...base, textStyle: undefined })).toStrictEqual({});
	});

	it('applies an explicit fontScale percentage floored at 6px', () => {
		const ts: TextStyle = { autoFit: true, fontSize: 40, autoFitFontScale: 0.5 };
		expect(computeAutoFitTextStyle({ ...base, textStyle: ts }).fontSize).toBe(20);
	});

	it('reduces line-height for lnSpcReduction', () => {
		const ts: TextStyle = { autoFit: true, lineSpacing: 1.2, autoFitLineSpacingReduction: 0.25 };
		expect(computeAutoFitTextStyle({ ...base, textStyle: ts }).lineHeight).toBeCloseTo(1.08, 5);
	});

	it('never shrinks the font for spAutoFit, however much text overflows', () => {
		// a:spAutoFit resizes the SHAPE to fit the text, not the font (ECMA-376).
		// A box authored/edited in PowerPoint already has its `a:ext` set to the
		// resized box, so the font must render at its authored size unshrunk even
		// when the measured text would overflow a small box.
		const ts: TextStyle = { autoFit: true, fontSize: 40, autoFitMode: 'shrink' };
		const longText = 'x'.repeat(2000);
		const result = computeAutoFitTextStyle({
			...base,
			text: longText,
			width: 100,
			height: 40,
			textStyle: ts,
		});
		expect(result).toStrictEqual({});
	});

	it('ignores a stale fontScale when autoFitMode is spAutoFit', () => {
		// fontScale is a normAutofit-only attribute; a source that also stamps
		// autoFitMode: 'shrink' must not have that stale value applied.
		const ts: TextStyle = {
			autoFit: true,
			fontSize: 40,
			autoFitMode: 'shrink',
			autoFitFontScale: 0.5,
		};
		expect(computeAutoFitTextStyle({ ...base, textStyle: ts }).fontSize).toBeUndefined();
	});

	it('still applies the authored fontScale for normAutofit', () => {
		const ts: TextStyle = {
			autoFit: true,
			fontSize: 40,
			autoFitMode: 'normal',
			autoFitFontScale: 0.5,
		};
		expect(computeAutoFitTextStyle({ ...base, textStyle: ts }).fontSize).toBe(20);
	});

	it('still applies lnSpcReduction for normAutofit but not for spAutoFit', () => {
		const normal: TextStyle = {
			autoFit: true,
			lineSpacing: 1.2,
			autoFitMode: 'normal',
			autoFitLineSpacingReduction: 0.25,
		};
		expect(computeAutoFitTextStyle({ ...base, textStyle: normal }).lineHeight).toBeCloseTo(1.08, 5);

		const shrink: TextStyle = {
			autoFit: true,
			lineSpacing: 1.2,
			autoFitMode: 'shrink',
			autoFitLineSpacingReduction: 0.25,
		};
		expect(computeAutoFitTextStyle({ ...base, textStyle: shrink }).lineHeight).toBeUndefined();
	});
});

// D2-G5: `a:bodyPr/@anchor="dist"|"just"` round-trips losslessly (core fix)
// and approximates as a vertical distribution here (render fix).
describe('resolveVerticalAnchorJustifyContent', () => {
	it('maps top/middle/bottom/undefined to the existing flex-column values', () => {
		expect(resolveVerticalAnchorJustifyContent('top', undefined)).toBe('flex-start');
		expect(resolveVerticalAnchorJustifyContent('middle', undefined)).toBe('center');
		expect(resolveVerticalAnchorJustifyContent('bottom', undefined)).toBe('flex-end');
		expect(resolveVerticalAnchorJustifyContent(undefined, undefined)).toBe('flex-start');
	});

	it('centers a single-paragraph distributed/justified body (nothing to distribute)', () => {
		expect(resolveVerticalAnchorJustifyContent('distributed', undefined)).toBe('center');
		expect(resolveVerticalAnchorJustifyContent('justified', [{ text: 'one', style: {} }])).toBe(
			'center',
		);
	});

	it('spreads a multi-paragraph distributed/justified body with space-between', () => {
		const segments = [
			{ text: 'first', style: {} },
			{ text: '\n', style: {} },
			{ text: 'second', style: {} },
		];
		expect(resolveVerticalAnchorJustifyContent('distributed', segments)).toBe('space-between');
		expect(resolveVerticalAnchorJustifyContent('justified', segments)).toBe('space-between');
	});

	it('does not split on a soft line break (isLineBreak), only a real paragraph break', () => {
		const segments = [
			{ text: 'first', style: {} },
			{ text: '\n', style: {}, isLineBreak: true },
			{ text: 'still same paragraph', style: {} },
		];
		expect(resolveVerticalAnchorJustifyContent('distributed', segments)).toBe('center');
	});

	it('treats an explicit isParagraphBreak segment the same as a bare newline', () => {
		const segments = [
			{ text: 'first', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'second', style: {} },
		];
		expect(resolveVerticalAnchorJustifyContent('distributed', segments)).toBe('space-between');
	});
});
