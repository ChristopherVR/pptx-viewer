import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { trimParagraphTrailingSpaces } from './paragraph-trailing-space';
import { buildParagraphs } from './text-paragraphs';

describe('trimParagraphTrailingSpaces (COM: audit-text slide 18)', () => {
	it('drops the trailing spaces of a right-aligned paragraph', () => {
		const runs = [{ text: 'Right ' }, { text: 'spaces      ' }];
		expect(trimParagraphTrailingSpaces(runs, 'right', false)).toStrictEqual([
			{ text: 'Right ' },
			{ text: 'spaces' },
		]);
	});

	it('removes a whitespace-only trailing run of a centred paragraph', () => {
		const runs = [{ text: 'Centre' }, { text: '   ' }];
		expect(trimParagraphTrailingSpaces(runs, 'center', false)).toStrictEqual([{ text: 'Centre' }]);
	});

	it('leaves a left-aligned paragraph alone', () => {
		const runs = [{ text: 'Left   ' }];
		expect(trimParagraphTrailingSpaces(runs, undefined, false)).toBe(runs);
		expect(trimParagraphTrailingSpaces(runs, 'left', false)).toBe(runs);
	});

	it('treats left alignment as the trailing edge of an rtl paragraph', () => {
		expect(trimParagraphTrailingSpaces([{ text: 'שלום  ' }], 'left', true)).toStrictEqual([
			{ text: 'שלום' },
		]);
	});

	it('keeps a paragraph made only of spaces, and runs with tab layouts', () => {
		const spaces = [{ text: '   ' }];
		expect(trimParagraphTrailingSpaces(spaces, 'right', false)).toBe(spaces);
		const tabbed = [{ text: 'a\tb  ', tabLines: [] }];
		expect(trimParagraphTrailingSpaces(tabbed, 'right', false)).toBe(tabbed);
	});

	it('is applied by buildParagraphs', () => {
		const element = {
			id: 'e1',
			type: 'text',
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			textStyle: { fontSize: 20 },
			textSegments: [
				{
					text: 'Right aligned trailing spaces      ',
					style: { fontSize: 20, align: 'right' },
				} as TextSegment,
			],
		} as unknown as PptxElement;
		const [paragraph] = buildParagraphs(element);
		const text = paragraph.runs.map((run) => run.text).join('');
		expect(text).toBe('Right aligned trailing spaces');
	});
});
