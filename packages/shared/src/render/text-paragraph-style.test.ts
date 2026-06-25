import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	resolveCssTextAlign,
	resolveParagraphAlign,
	resolveParagraphRtl,
} from './text-paragraph-style';

const entry = (style: Partial<TextStyle>) => ({ segment: { style: style as TextStyle } });

describe('resolveParagraphRtl', () => {
	it('returns the first explicit segment direction', () => {
		expect(resolveParagraphRtl([entry({}), entry({ rtl: true })], false)).toBeTruthy();
		// Explicit false must win over an RTL element default (and not be undefined).
		const explicitFalse = resolveParagraphRtl([entry({ rtl: false })], true);
		expect(explicitFalse).toBeFalsy();
		expect(explicitFalse).toBeDefined();
	});

	it('falls back to the element default when none is explicit', () => {
		expect(resolveParagraphRtl([entry({}), entry({})], true)).toBeTruthy();
		expect(resolveParagraphRtl([], undefined)).toBeUndefined();
	});
});

describe('resolveParagraphAlign', () => {
	it('returns the first explicit segment alignment', () => {
		expect(resolveParagraphAlign([entry({}), entry({ align: 'center' })], 'left')).toBe('center');
	});

	it('falls back to the element default', () => {
		expect(resolveParagraphAlign([entry({})], 'right')).toBe('right');
	});
});

describe('resolveCssTextAlign', () => {
	it('maps justify-family OOXML values to justify', () => {
		expect(resolveCssTextAlign('justLow', false)).toBe('justify');
		expect(resolveCssTextAlign('dist', false)).toBe('justify');
		expect(resolveCssTextAlign('thaiDist', false)).toBe('justify');
	});

	it('passes through a concrete alignment', () => {
		expect(resolveCssTextAlign('center', false)).toBe('center');
	});

	it('defaults RTL to right and LTR to undefined when unset', () => {
		expect(resolveCssTextAlign(undefined, true)).toBe('right');
		expect(resolveCssTextAlign(undefined, false)).toBeUndefined();
	});
});
