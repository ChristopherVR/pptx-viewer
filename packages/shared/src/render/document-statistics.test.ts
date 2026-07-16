import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeDocumentStatistics, countWords } from './document-statistics';

const slide = (elements: PptxElement[], extra: Partial<PptxSlide> = {}): PptxSlide =>
	({ id: 'slide', rId: 'rId', slideNumber: 1, elements, ...extra }) as PptxSlide;

describe('document statistics', () => {
	it('counts live slide, note, element, word, paragraph, group, and table data', () => {
		const text = { type: 'text', id: 't', text: 'one two\nthree' } as PptxElement;
		const table = {
			type: 'table',
			id: 'table',
			tableData: { rows: [{ cells: [{ text: 'four five' }] }] },
		} as PptxElement;
		const group = { type: 'group', id: 'group', children: [text, table] } as PptxElement;
		const stats = computeDocumentStatistics(
			[slide([group], { hidden: true, notes: 'Presenter note' })],
			{ revision: '4' },
		);
		expect(stats).toMatchObject({
			slideCount: 1,
			hiddenSlideCount: 1,
			noteCount: 1,
			elementCount: 3,
			wordCount: 5,
			paragraphCount: 3,
			revision: '4',
		});
	});

	it('counts whitespace-delimited words', () => {
		expect(countWords(' one   two\nthree ')).toBe(3);
		expect(countWords('   ')).toBe(0);
	});
});
