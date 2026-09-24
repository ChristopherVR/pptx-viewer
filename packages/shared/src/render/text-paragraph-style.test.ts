import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	resolveCssTextAlign,
	resolveParagraphAlign,
	resolveParagraphRtl,
	resolveTextAlignLast,
} from './text-paragraph-style';

const entry = (style: Partial<TextStyle>) => ({ segment: { style: style as TextStyle } });
const entryWithParaProps = (paragraphProperties: Partial<TextStyle>) => ({
	segment: { paragraphProperties: paragraphProperties as TextStyle },
});

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

	// A plain `a:pPr/@rtl` (the common case) has no per-run carrier: it never
	// reaches `segment.style.rtl` (only a RUN-level `<a:rtl>` override does).
	// The only place a paragraph's own rtl survives to the renderer is
	// `segment.paragraphProperties.rtl`, stamped on the paragraph's first
	// segment at parse time. Without consulting it, this paragraph's rtl fell
	// through to the element/shape default and was lost whenever that default
	// disagreed (issue: pPr@rtl lost).
	it("falls back to the paragraph's own pPr rtl before the element default", () => {
		expect(resolveParagraphRtl([entryWithParaProps({ rtl: true })], false)).toBeTruthy();
		expect(resolveParagraphRtl([entryWithParaProps({ rtl: false })], true)).toBeFalsy();
	});

	it("prefers an explicit run-level rtl override over the paragraph's own pPr rtl", () => {
		expect(
			resolveParagraphRtl(
				[{ segment: { style: { rtl: false } as TextStyle, paragraphProperties: { rtl: true } } }],
				undefined,
			),
		).toBeFalsy();
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

describe('resolveTextAlignLast', () => {
	// COM-verified against audit-text/pp/s9.png (gen.py slide 9): the `dist`
	// box visibly stretches its final wrapped line and its single-line variants
	// ("Dist one line", "均等割り付け"), while `just`/`justLow` both leave
	// their last line alone, matching plain CSS justify's own default.
	it('only distributed (dist) stretches its own last line', () => {
		expect(resolveTextAlignLast('dist')).toBe('justify');
	});

	it('leaves just/justLow/thaiDist/other alignments alone', () => {
		expect(resolveTextAlignLast('justify')).toBeUndefined();
		expect(resolveTextAlignLast('justLow')).toBeUndefined();
		expect(resolveTextAlignLast('thaiDist')).toBeUndefined();
		expect(resolveTextAlignLast('center')).toBeUndefined();
		expect(resolveTextAlignLast(undefined)).toBeUndefined();
	});
});
