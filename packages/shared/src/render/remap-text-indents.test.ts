import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { ParagraphIndent } from './remap-text-indents';
import { remapParagraphIndents } from './remap-text-indents';

const breakSeg = (): TextSegment => ({ text: '\n', style: {}, isParagraphBreak: true });
const original: TextSegment[] = [
	{ text: 'Top level', style: {} },
	breakSeg(),
	{ text: 'Middle level', style: {} },
	breakSeg(),
	{ text: 'Deep level', style: {} },
];
const indents: ParagraphIndent[] = [
	{ marginLeft: 0, indent: 0 },
	{ marginLeft: 20, indent: -10 },
	{ marginLeft: 40, indent: -10 },
];

describe('remapParagraphIndents', () => {
	it('returns nothing to remap unchanged', () => {
		expect(remapParagraphIndents('a\nb', original, undefined)).toBeUndefined();
		expect(remapParagraphIndents('a\nb', original, [])).toStrictEqual([]);
		expect(remapParagraphIndents('a\nb', undefined, indents)).toStrictEqual(indents);
		expect(remapParagraphIndents('a\nb', [], indents)).toStrictEqual(indents);
	});

	it('keeps one entry per paragraph on an untouched commit', () => {
		expect(
			remapParagraphIndents('Top level\nMiddle level\nDeep level', original, indents),
		).toStrictEqual(indents);
	});

	it('gives both halves of a mid-list split the split paragraph indent', () => {
		expect(
			remapParagraphIndents('Top level\nMiddle\n level\nDeep level', original, indents),
		).toStrictEqual([indents[0], indents[1], indents[1], indents[2]]);
	});

	it('keeps later entries when a middle paragraph is deleted', () => {
		expect(remapParagraphIndents('Top level\nDeep level', original, indents)).toStrictEqual([
			indents[0],
			indents[2],
		]);
	});

	it('continues the last entry for appended paragraphs', () => {
		expect(
			remapParagraphIndents(
				'Top level\nMiddle level\nDeep level\nMore\nEven more',
				original,
				indents,
			),
		).toStrictEqual([indents[0], indents[1], indents[2], indents[2], indents[2]]);
	});

	it('fills a missing entry with an empty indent', () => {
		expect(
			remapParagraphIndents('Top level\nMiddle level\nDeep level', original, [indents[0]]),
		).toStrictEqual([indents[0], {}, {}]);
	});
});
