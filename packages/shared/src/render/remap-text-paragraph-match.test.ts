import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { OriginalParagraph } from './remap-text-paragraph-match';
import {
	alignParagraphs,
	editedParagraphText,
	mapEditedParagraphs,
	originalParagraphText,
	paragraphSimilarity,
	splitOriginalParagraphs,
} from './remap-text-paragraph-match';

function para(...texts: string[]): OriginalParagraph {
	return { segments: texts.map((text) => ({ text, style: {} })) };
}

function paras(...texts: string[]): OriginalParagraph[] {
	return texts.map((text) => para(text));
}

describe('paragraphSimilarity', () => {
	it('scores identical and empty-identical text highest', () => {
		expect(paragraphSimilarity('same', 'same')).toBe(1000);
		expect(paragraphSimilarity('', '')).toBe(1000);
	});

	it('does not match when only one side is empty', () => {
		expect(paragraphSimilarity('', 'text')).toBe(0);
		expect(paragraphSimilarity('text', '')).toBe(0);
	});

	it('treats a prefix, a suffix and a middle insertion as containment', () => {
		const prefix = paragraphSimilarity('Alpha', 'Alpha beta gamma');
		const suffix = paragraphSimilarity('gamma', 'Alpha beta gamma');
		const insertion = paragraphSimilarity('Alpha beta gamma', 'Alpha gamma');
		for (const score of [prefix, suffix, insertion]) {
			expect(score).toBeGreaterThan(500);
			expect(score).toBeLessThan(1000);
		}
		expect(prefix).toBe(suffix);
	});

	it('ranks a longer surviving share higher', () => {
		expect(paragraphSimilarity('Alpha beta', 'Alpha beta gamma')).toBeGreaterThan(
			paragraphSimilarity('Al', 'Alpha beta gamma'),
		);
	});

	it('accepts a partial retype covering at least half the shorter text', () => {
		expect(paragraphSimilarity('Middle tier', 'Middle level')).toBeGreaterThan(0);
		expect(paragraphSimilarity('Middle tier', 'Middle level')).toBeLessThan(500);
	});

	it('rejects unrelated text', () => {
		expect(paragraphSimilarity('Something else', 'Middle level')).toBe(0);
		expect(paragraphSimilarity('AAA', 'Line 1')).toBe(0);
	});
});

describe('paragraph text normalisation', () => {
	const numbered: OriginalParagraph = {
		segments: [
			{ text: '1. ', style: {}, bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 } },
			{ text: ' Item ', style: {} },
		],
	};

	it('drops the dedicated marker and trims the original', () => {
		expect(originalParagraphText(numbered)).toBe('Item');
	});

	it('strips the echoed marker from the edited text', () => {
		expect(editedParagraphText('1. Item edited', numbered)).toBe('Item edited');
		expect(editedParagraphText('Item edited', numbered)).toBe('Item edited');
	});

	it('keeps an auto-number without a runtime index as content on both sides', () => {
		const unindexed: OriginalParagraph = {
			segments: [{ text: '1.', style: {}, bulletInfo: { autoNumType: 'arabicPeriod' } }],
		};
		expect(originalParagraphText(unindexed)).toBe('1.');
		expect(editedParagraphText('1.Item', unindexed)).toBe('1.Item');
	});

	it('splits segments at breaks and keeps the terminator', () => {
		const terminator: TextSegment = { text: '\n', style: {}, isParagraphBreak: true };
		const result = splitOriginalParagraphs([{ text: 'A', style: {} }, terminator]);
		expect(result).toHaveLength(2);
		expect(result[0].terminator).toBe(terminator);
		expect(result[1].segments).toStrictEqual([]);
	});
});

describe('alignParagraphs', () => {
	it('pairs the first half of a split with its origin and leaves the tail unmatched', () => {
		expect(
			alignParagraphs(['Top', 'Middle', 'level', 'Deep'], paras('Top', 'Middle level', 'Deep')),
		).toStrictEqual([0, 1, undefined, 2]);
	});

	it('skips a deleted original', () => {
		expect(alignParagraphs(['Top', 'Deep'], paras('Top', 'Middle', 'Deep'))).toStrictEqual([0, 2]);
	});

	it('prefers an exact match over a containment for the same original', () => {
		expect(alignParagraphs(['A', 'Alpha'], paras('Alpha'))).toStrictEqual([undefined, 0]);
		expect(alignParagraphs(['Alpha', 'A'], paras('Alpha'))).toStrictEqual([0, undefined]);
	});

	it('prefers the earlier original on ties', () => {
		expect(alignParagraphs([''], paras('', ''))).toStrictEqual([0]);
	});

	it('matches nothing when every paragraph was retyped', () => {
		expect(alignParagraphs(['AAA', 'BBB'], paras('Line 1', 'Line 2'))).toStrictEqual([
			undefined,
			undefined,
		]);
	});
});

describe('mapEditedParagraphs', () => {
	it('marks the split-off tail as inserted after the paragraph it came from', () => {
		expect(
			mapEditedParagraphs(['Top', 'Middle', 'level', 'Deep'], paras('Top', 'Middle level', 'Deep')),
		).toStrictEqual([
			{ kind: 'matched', original: 0 },
			{ kind: 'matched', original: 1 },
			{ kind: 'inserted', donor: 1, offset: 1 },
			{ kind: 'matched', original: 2 },
		]);
	});

	it('counts several inserts from the same donor', () => {
		expect(mapEditedParagraphs(['Top', 'X', 'Y', 'Deep'], paras('Top', 'Deep'))).toStrictEqual([
			{ kind: 'matched', original: 0 },
			{ kind: 'inserted', donor: 0, offset: 1 },
			{ kind: 'inserted', donor: 0, offset: 2 },
			{ kind: 'matched', original: 1 },
		]);
	});

	it('pairs retyped paragraphs positionally inside a gap', () => {
		expect(mapEditedParagraphs(['AAA', 'BBB'], paras('Line 1', 'Line 2'))).toStrictEqual([
			{ kind: 'matched', original: 0 },
			{ kind: 'matched', original: 1 },
		]);
		expect(mapEditedParagraphs(['OnlyOne'], paras('P1', 'P2', 'P3'))).toStrictEqual([
			{ kind: 'matched', original: 0 },
		]);
	});

	it('treats paragraphs past the last original as appended', () => {
		expect(mapEditedParagraphs(['A', 'B', 'C'], paras('One'))).toStrictEqual([
			{ kind: 'matched', original: 0 },
			{ kind: 'appended', donor: 0, offset: 1 },
			{ kind: 'appended', donor: 0, offset: 2 },
		]);
		expect(mapEditedParagraphs(['Top', 'Deep', 'New'], paras('Top', 'Mid', 'Deep'))).toStrictEqual([
			{ kind: 'matched', original: 0 },
			{ kind: 'matched', original: 2 },
			{ kind: 'appended', donor: 2, offset: 1 },
		]);
	});

	it('continues the following paragraph in place when nothing precedes an insert', () => {
		expect(mapEditedParagraphs(['', 'Top', 'Deep'], paras('Top', 'Deep'))).toStrictEqual([
			{ kind: 'inserted', donor: 0, offset: 0 },
			{ kind: 'matched', original: 0 },
			{ kind: 'matched', original: 1 },
		]);
	});
});
