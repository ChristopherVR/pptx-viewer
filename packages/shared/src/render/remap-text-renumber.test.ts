import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resequenceAutoNumbering } from './remap-text-renumber';

function item(index: number, level = 0, scheme = 'arabicPeriod', startAt = 1): TextSegment[] {
	const ordinal = startAt + index;
	return [
		{
			text: `${ordinal}. `,
			style: {},
			bulletInfo: { autoNumType: scheme, autoNumStartAt: startAt, paragraphIndex: index },
			paragraphLevel: level,
		},
		{ text: `Item ${ordinal}`, style: {} },
	];
}

function plain(text: string, level = 0): TextSegment[] {
	return [{ text, style: {}, paragraphLevel: level }];
}

const indices = (paragraphs: TextSegment[][]): Array<number | undefined> =>
	paragraphs.map((paragraph) => paragraph[0]?.bulletInfo?.paragraphIndex);
const markers = (paragraphs: TextSegment[][]): string[] =>
	paragraphs.map((paragraph) => paragraph[0]?.text ?? '');

describe('resequenceAutoNumbering', () => {
	it('returns a well-formed list unchanged', () => {
		const input = [item(0), item(1), item(2)];
		const result = resequenceAutoNumbering(input);
		expect(result).toStrictEqual(input);
		expect(result[0]).toBe(input[0]);
	});

	it('closes the gap left by a deleted item, refreshing the marker text', () => {
		const result = resequenceAutoNumbering([item(0), item(2)]);
		expect(indices(result)).toStrictEqual([0, 1]);
		expect(markers(result)).toStrictEqual(['1. ', '2. ']);
	});

	it('pushes later items along after a duplicated index', () => {
		const result = resequenceAutoNumbering([item(0), item(1), item(1), item(2)]);
		expect(indices(result)).toStrictEqual([0, 1, 2, 3]);
		expect(markers(result)).toStrictEqual(['1. ', '2. ', '3. ', '4. ']);
	});

	it('keeps the first item of a run at its stored offset', () => {
		const result = resequenceAutoNumbering([
			item(1, 0, 'alphaLcParenR', 3),
			item(5, 0, 'alphaLcParenR', 3),
		]);
		expect(indices(result)).toStrictEqual([1, 2]);
	});

	it('restarts after a plain paragraph at the same level', () => {
		const result = resequenceAutoNumbering([item(0), item(1), plain('heading'), item(0), item(3)]);
		expect(indices(result)).toStrictEqual([0, 1, undefined, 0, 1]);
	});

	it('restarts when the scheme changes', () => {
		const result = resequenceAutoNumbering([
			item(0),
			item(1),
			item(0, 0, 'romanUcPeriod'),
			item(4, 0, 'romanUcPeriod'),
		]);
		expect(indices(result)).toStrictEqual([0, 1, 0, 1]);
	});

	it('sequences each level independently and restarts nested levels under a new parent', () => {
		const result = resequenceAutoNumbering([
			item(0),
			item(0, 1),
			item(3, 1),
			item(1),
			item(0, 1),
			item(2),
		]);
		expect(indices(result)).toStrictEqual([0, 0, 1, 1, 0, 2]);
	});

	it('does not invent an offset for an item without one', () => {
		const unindexed: TextSegment[] = [
			{ text: 'Second', style: {}, bulletInfo: { autoNumType: 'arabicPeriod' } },
		];
		const result = resequenceAutoNumbering([item(0), unindexed, item(0)]);
		expect(indices(result)).toStrictEqual([0, undefined, 0]);
		expect(result[1]).toBe(unindexed);
	});

	it('leaves the content run alone when the marker is not a segment of its own', () => {
		const carried: TextSegment[] = [
			{ text: 'Third', style: {}, bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 2 } },
		];
		const result = resequenceAutoNumbering([item(0), carried]);
		expect(result[1][0].text).toBe('Third');
		expect(result[1][0].bulletInfo?.paragraphIndex).toBe(1);
	});
});
