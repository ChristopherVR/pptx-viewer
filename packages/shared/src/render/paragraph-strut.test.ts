import type { TextSegment } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { resolveParagraphStrutFontSize } from './paragraph-strut';

function segment(fontSize: number | undefined): Pick<TextSegment, 'style' | 'bulletInfo' | 'text'> {
	return { style: { fontSize }, text: 'x' } as Pick<TextSegment, 'style' | 'bulletInfo' | 'text'>;
}

describe('resolveParagraphStrutFontSize', () => {
	it('returns the largest run size when it differs from the body default', () => {
		expect(resolveParagraphStrutFontSize([segment(12), segment(20)], 16)).toBe(20);
	});

	it('returns undefined when the paragraph matches the body default', () => {
		expect(resolveParagraphStrutFontSize([segment(16)], 16)).toBeUndefined();
	});

	it('scales the returned strut size by fontScale (autofit shrink)', () => {
		// Authored 40px run, autofit shrinks every run to 80% (32px): the strut
		// must re-base to the SHRUNK size, or the line box stays sized for the
		// unshrunk text while the run itself renders smaller.
		expect(resolveParagraphStrutFontSize([segment(40)], 16, 0.8)).toBe(32);
	});

	it('defaults fontScale to 1 (no autofit)', () => {
		expect(resolveParagraphStrutFontSize([segment(40)], 16)).toBe(40);
	});

	it('ignores bullet segments when finding the largest run', () => {
		const bulletSeg = { style: { fontSize: 99 }, bulletInfo: {}, text: '•' } as Pick<
			TextSegment,
			'style' | 'bulletInfo' | 'text'
		>;
		expect(resolveParagraphStrutFontSize([bulletSeg, segment(14)], 16)).toBe(14);
	});
});
