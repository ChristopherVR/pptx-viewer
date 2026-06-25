import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeAutoFitTextStyle,
	isVerticalTextDirection,
	resolveLineHeight,
	toCssTextOrientation,
	toCssVerticalDirection,
	toCssWritingMode,
} from './text-style-helpers';

describe('resolveLineHeight', () => {
	it('returns an exact pt string when lineSpacingExactPt is set', () => {
		expect(resolveLineHeight({ lineSpacingExactPt: 18 }, false)).toBe('18pt');
	});

	it('ignores a non-positive exact pt and uses the multiplier', () => {
		expect(resolveLineHeight({ lineSpacingExactPt: 0, lineSpacing: 1.5 }, false)).toBe(1.5);
	});

	it('uses the proportional multiplier when set', () => {
		expect(resolveLineHeight({ lineSpacing: 2 }, false)).toBe(2);
	});

	it('defaults to 1.25, or 1.35 with italic runs', () => {
		expect(resolveLineHeight(undefined, false)).toBe(1.25);
		expect(resolveLineHeight(undefined, true)).toBe(1.35);
	});
});

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
		expect(computeAutoFitTextStyle({ ...base, textStyle: ts }).lineHeight).toBeCloseTo(0.9, 5);
	});

	it('shrinks via heuristic when spAutoFit text overflows', () => {
		const ts: TextStyle = { autoFit: true, fontSize: 40, autoFitMode: 'shrink' };
		const longText = 'x'.repeat(2000);
		const result = computeAutoFitTextStyle({
			...base,
			text: longText,
			width: 100,
			height: 40,
			textStyle: ts,
		});
		expect(result.fontSize).toBeDefined();
		expect(result.fontSize!).toBeLessThan(40);
		expect(result.fontSize!).toBeGreaterThanOrEqual(6);
	});
});
