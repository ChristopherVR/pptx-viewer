import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { inlineListBodyText } from './inline-list-body';
import { transformInlineListCase } from './inline-list-case';

const snapshot = (textSegments: TextSegment[]) => ({
	elementId: 'list',
	text: inlineListBodyText(textSegments),
	textSegments,
});

describe('live list Change Case model transaction', () => {
	it('preserves generated markers and paragraph metadata while changing authored text', () => {
		const marker: TextSegment = {
			text: 'III. ',
			style: {},
			bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 3, paragraphIndex: 0 },
		};
		const body: TextSegment = {
			text: 'HELLO',
			style: { bold: true },
			paragraphProperties: { paragraphSpacingAfter: 12 },
		};
		const source = snapshot([marker, body]);
		const next = transformInlineListCase(source, null, 'lower');
		expect(next.text).toBe('hello');
		expect(next.textSegments?.[0]).toBe(marker);
		expect(next.textSegments?.[1]).toStrictEqual({ ...body, text: 'hello' });
		expect(source.text).toBe('HELLO');
	});

	it('uses current segment selection and recomputes body length for Unicode expansion', () => {
		const source = snapshot([
			{ text: '◆ ', style: {}, bulletInfo: { char: '◆' } },
			{ text: 'aß😀z', style: { italic: true } },
		]);
		const next = transformInlineListCase(
			source,
			{
				startSegIdx: 1,
				startOffset: 1,
				endSegIdx: 1,
				endOffset: 4,
			},
			'upper',
		);
		expect(next.text).toBe('aSS😀z');
		expect(next.textSegments?.[1].style).toStrictEqual({ italic: true });
	});

	it('keeps soft breaks, empty paragraphs, and literal numbered body text', () => {
		const source = snapshot([
			{ text: '◆ ', style: {}, bulletInfo: { char: '◆' } },
			{ text: 'First', style: {} },
			{ text: '\n', style: {}, isLineBreak: true },
			{ text: '1. literal BODY', style: {} },
			{ text: '\n', style: {}, isParagraphBreak: true },
			{ text: 'IV. ', style: {}, bulletInfo: { autoNumType: 'romanUcPeriod', paragraphIndex: 3 } },
			{ text: '', style: {} },
		]);
		const next = transformInlineListCase(source, null, 'upper');
		expect(next.text).toBe('FIRST\n1. LITERAL BODY\n');
		expect(next.textSegments?.[2]).toBe(source.textSegments[2]);
		expect(next.textSegments?.[5]).toBe(source.textSegments[5]);
	});

	it('returns the original snapshot for no-op or explicit plain fallback', () => {
		const source = snapshot([{ text: 'İ', style: {}, bulletInfo: { char: '•' } }]);
		expect(transformInlineListCase(source, null, 'upper')).toBe(source);
		expect(transformInlineListCase(source, null, 'lower').text).toBe('i\u0307');
		const plain = { elementId: 'list', text: 'Body' };
		expect(transformInlineListCase(plain, null, 'upper')).toBe(plain);
	});
});
