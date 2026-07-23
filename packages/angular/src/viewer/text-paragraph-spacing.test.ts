/**
 * Tests for `resolveParagraphSpacing` (per-paragraph line-height + space
 * before/after), mirroring the shared `buildParagraphs` spacing resolver that
 * the Angular in-component paragraph builder consumes.
 */
import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveParagraphSpacing } from './text-paragraph-spacing';

describe('resolveParagraphSpacing', () => {
	it('returns an empty object for undefined paragraphProperties', () => {
		expect(resolveParagraphSpacing(undefined)).toStrictEqual({});
	});

	it('maps a proportional lineSpacing multiplier to a unitless line-height', () => {
		const out = resolveParagraphSpacing({ lineSpacing: 1.5 } as TextStyle);
		expect(out.lineHeight).toBe(1.5);
	});

	it('prefers exact lineSpacingExactPt (as a pt string) over the multiplier', () => {
		const out = resolveParagraphSpacing({
			lineSpacing: 1.5,
			lineSpacingExactPt: 18,
		} as TextStyle);
		expect(out.lineHeight).toBe('18pt');
	});

	it('maps paragraphSpacingBefore / After to px margins', () => {
		const out = resolveParagraphSpacing({
			paragraphSpacingBefore: 12,
			paragraphSpacingAfter: 6,
		} as TextStyle);
		expect(out.spaceBeforePx).toBe(12);
		expect(out.spaceAfterPx).toBe(6);
	});

	it('ignores non-positive line spacing values', () => {
		expect(resolveParagraphSpacing({ lineSpacing: 0 } as TextStyle).lineHeight).toBeUndefined();
		expect(
			resolveParagraphSpacing({ lineSpacingExactPt: 0 } as TextStyle).lineHeight,
		).toBeUndefined();
	});

	it('keeps zero spacing before/after (an explicit override, not absent)', () => {
		const out = resolveParagraphSpacing({
			paragraphSpacingBefore: 0,
			paragraphSpacingAfter: 0,
		} as TextStyle);
		expect(out.spaceBeforePx).toBe(0);
		expect(out.spaceAfterPx).toBe(0);
	});
});
