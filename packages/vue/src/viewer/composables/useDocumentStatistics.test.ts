import type { PptxCoreProperties, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import {
	computeDocumentStatistics,
	countWords,
	useDocumentStatistics,
} from './useDocumentStatistics';

function textEl(id: string, text: string): PptxElement {
	return { type: 'text', id, x: 0, y: 0, width: 100, height: 40, text } as PptxElement;
}

function segmentEl(id: string, parts: string[]): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		textSegments: parts.map((t) => ({ text: t, style: {} })),
	} as PptxElement;
}

function slide(elements: PptxElement[], overrides: Partial<PptxSlide> = {}): PptxSlide {
	return { id: 'slide', elements, ...overrides } as PptxSlide;
}

describe('countWords', () => {
	it('returns 0 for empty / whitespace-only text', () => {
		expect(countWords(undefined)).toBe(0);
		expect(countWords('')).toBe(0);
		expect(countWords('   \n\t ')).toBe(0);
	});

	it('counts whitespace-delimited words, collapsing runs', () => {
		expect(countWords('hello world')).toBe(2);
		expect(countWords('  one   two\tthree\nfour ')).toBe(4);
	});
});

describe('computeDocumentStatistics', () => {
	it('counts slides, hidden slides, and notes', () => {
		const slides = [
			slide([], { id: 's1' }),
			slide([], { id: 's2', hidden: true }),
			slide([], { id: 's3', notes: 'Remember the agenda' }),
			slide([], { id: 's4', notes: '   ' }),
		];
		const stats = computeDocumentStatistics(slides, undefined);
		expect(stats.slideCount).toBe(4);
		expect(stats.hiddenSlideCount).toBe(1);
		expect(stats.noteCount).toBe(1);
	});

	it('counts elements, words and paragraphs across text and segments', () => {
		const slides = [slide([textEl('t1', 'one two three'), segmentEl('t2', ['four ', 'five'])])];
		const stats = computeDocumentStatistics(slides, undefined);
		expect(stats.elementCount).toBe(2);
		expect(stats.wordCount).toBe(5);
		expect(stats.paragraphCount).toBe(2);
	});

	it('counts multi-line text as multiple paragraphs', () => {
		const slides = [slide([textEl('t1', 'line one\nline two\n\nline three')])];
		const stats = computeDocumentStatistics(slides, undefined);
		expect(stats.paragraphCount).toBe(3);
		expect(stats.wordCount).toBe(6);
	});

	it('walks group children for counts', () => {
		const group = {
			type: 'group',
			id: 'g1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			children: [textEl('c1', 'alpha beta'), textEl('c2', 'gamma')],
		} as PptxElement;
		const stats = computeDocumentStatistics([slide([group])], undefined);
		// group + 2 children
		expect(stats.elementCount).toBe(3);
		expect(stats.wordCount).toBe(3);
	});

	it('counts table cell text', () => {
		const table = {
			type: 'table',
			id: 'tbl1',
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			tableData: {
				rows: [
					{ cells: [{ text: 'Name' }, { text: 'Score' }] },
					{ cells: [{ text: 'Ada Lovelace' }, { text: '95' }] },
				],
			},
		} as PptxElement;
		const stats = computeDocumentStatistics([slide([table])], undefined);
		expect(stats.elementCount).toBe(1);
		// Name(1) + Score(1) + Ada Lovelace(2) + 95(1) = 5
		expect(stats.wordCount).toBe(5);
	});

	it('carries core-property timestamps and revision through', () => {
		const core: PptxCoreProperties = {
			created: '2024-01-15T08:00:00Z',
			modified: '2024-06-01T12:30:00Z',
			revision: '7',
			lastModifiedBy: 'Bob',
		};
		const stats = computeDocumentStatistics([], core);
		expect(stats.created).toBe('2024-01-15T08:00:00Z');
		expect(stats.modified).toBe('2024-06-01T12:30:00Z');
		expect(stats.revision).toBe('7');
		expect(stats.lastModifiedBy).toBe('Bob');
	});
});

describe('useDocumentStatistics', () => {
	it('recomputes reactively when the slide list changes', () => {
		const slides = ref<PptxSlide[]>([slide([textEl('t1', 'one two')])]);
		const core = ref<PptxCoreProperties | undefined>(undefined);
		const stats = useDocumentStatistics(slides, core);
		expect(stats.value.wordCount).toBe(2);

		slides.value = [slide([textEl('t1', 'one two three four')])];
		expect(stats.value.wordCount).toBe(4);
	});
});
