import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeAutoFitTextStyle,
	isVerticalTextDirection,
	toCssTextOrientation,
	toCssVerticalDirection,
	toCssWritingMode,
} from './text-style-helpers';

describe('vertical text mapping', () => {
	it('maps text directions to writing-mode', () => {
		expect(toCssWritingMode('vertical')).toBe('vertical-rl');
		expect(toCssWritingMode('wordArtVertRtl')).toBe('vertical-rl');
		expect(toCssWritingMode('vertical270')).toBe('vertical-lr');
		expect(toCssWritingMode('mongolianVert')).toBe('vertical-lr');
		expect(toCssWritingMode('horizontal')).toBeUndefined();
		expect(toCssWritingMode(undefined)).toBeUndefined();
	});

	it('maps text directions to text-orientation', () => {
		expect(toCssTextOrientation('vertical')).toBe('mixed');
		expect(toCssTextOrientation('wordArtVert')).toBe('upright');
		expect(toCssTextOrientation('horizontal')).toBeUndefined();
	});

	it('only wordArtVertRtl forces direction rtl', () => {
		expect(toCssVerticalDirection('wordArtVertRtl')).toBe('rtl');
		expect(toCssVerticalDirection('vertical')).toBeUndefined();
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
