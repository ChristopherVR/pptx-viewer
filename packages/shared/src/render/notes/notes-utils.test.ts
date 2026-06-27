import type { PptxSlide, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveNotesSegments, normalizeNotesLinkUrl } from './notes-editor';
import { buildNotesPrintHtml } from './notes-print';
import {
	createPlainNotesSegments,
	normalizeSegments,
	paragraphsToSegments,
	parsePt,
	segmentsToParagraphs,
	segmentsToPlainText,
} from './notes-utils';

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return { id: 's1', rId: 'rId2', slideNumber: 1, elements: [], ...overrides };
}

describe('createPlainNotesSegments', () => {
	it('creates a single segment for simple text', () => {
		expect(createPlainNotesSegments('Hello')).toStrictEqual([{ text: 'Hello', style: {} }]);
	});

	it('inserts paragraph breaks for newlines', () => {
		const segments = createPlainNotesSegments('Line 1\nLine 2');
		expect(segments).toHaveLength(3);
		expect(segments[1].isParagraphBreak).toBeTruthy();
	});

	it('returns a single empty segment for empty string', () => {
		expect(createPlainNotesSegments('')).toStrictEqual([{ text: '', style: {} }]);
	});
});

describe('segmentsToPlainText / normalizeSegments', () => {
	it('round-trips paragraph breaks as newlines', () => {
		const segments: TextSegment[] = [
			{ text: 'Line 1', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'Line 2', style: {} },
		];
		expect(segmentsToPlainText(segments)).toBe('Line 1\nLine 2');
	});

	it('trims trailing paragraph breaks and empty segments', () => {
		expect(
			normalizeSegments([
				{ text: 'hello', style: {} },
				{ text: '', style: {}, isParagraphBreak: true },
			]),
		).toStrictEqual([{ text: 'hello', style: {} }]);
	});
});

describe('parsePt', () => {
	it('parses numbers and converts px to pt', () => {
		expect(parsePt('12')).toBe(12);
		expect(parsePt('16px')).toBe(12);
		expect(parsePt('abc')).toBeUndefined();
		expect(parsePt(undefined)).toBeUndefined();
	});
});

describe('paragraph conversions', () => {
	it('detects bullet and numbered paragraphs and indent level', () => {
		expect(
			segmentsToParagraphs([{ text: 'Item', style: {}, bulletInfo: { char: '•' } }])[0].bulletType,
		).toBe('bullet');
		expect(
			segmentsToParagraphs([{ text: 'Indented', style: { paragraphMarginLeft: 48 } }])[0]
				.indentLevel,
		).toBe(2);
	});

	it('writes bullet info and indent back onto the first segment', () => {
		const result = paragraphsToSegments([
			{ segments: [{ text: 'Item', style: {} }], bulletType: 'bullet', indentLevel: 3 },
		]);
		expect(result[0].bulletInfo?.char).toBe('•');
		expect(result[0].style.paragraphMarginLeft).toBe(72);
	});
});

describe('resolveNotesSegments', () => {
	it('prefers rich notesSegments when present', () => {
		const segs: TextSegment[] = [{ text: 'Rich', style: { bold: true } }];
		expect(resolveNotesSegments(makeSlide({ notesSegments: segs }))).toStrictEqual(segs);
	});

	it('falls back to plain notes when no segments', () => {
		expect(resolveNotesSegments(makeSlide({ notes: 'Plain' }))).toStrictEqual([
			{ text: 'Plain', style: {} },
		]);
	});

	it('returns a single empty segment for an undefined slide', () => {
		expect(resolveNotesSegments(undefined)).toStrictEqual([{ text: '', style: {} }]);
	});
});

describe('normalizeNotesLinkUrl', () => {
	it('leaves http(s) URLs intact and prefixes bare hosts', () => {
		expect(normalizeNotesLinkUrl('https://a.com')).toBe('https://a.com');
		expect(normalizeNotesLinkUrl('  example.com ')).toBe('https://example.com');
	});
});

describe('buildNotesPrintHtml', () => {
	it('builds a page per slide with the localised label and escaped notes', () => {
		const html = buildNotesPrintHtml(
			[
				makeSlide({ id: 'a', slideNumber: 1, notes: 'first & <b>note</b>' }),
				makeSlide({ id: 'b', slideNumber: 2, notes: 'second' }),
			],
			(n) => `Slide ${n}`,
		);
		expect(html.match(/slide-page/gu)?.length).toBeGreaterThanOrEqual(2);
		expect(html).toContain('Slide 1');
		expect(html).toContain('Slide 2');
		expect(html).toContain('first &amp; &lt;b&gt;note&lt;/b&gt;');
		expect(html).not.toContain('<b>note</b>');
	});

	it('renders bullet and numbered prefixes', () => {
		const html = buildNotesPrintHtml(
			[
				makeSlide({
					notesSegments: [
						{ text: 'Bulleted', style: {}, bulletInfo: { char: '•' } },
						{ text: '', style: {}, isParagraphBreak: true },
						{ text: 'Numbered', style: {}, bulletInfo: { autoNumType: 'arabicPeriod' } },
					],
				}),
			],
			(n) => `Slide ${n}`,
		);
		expect(html).toContain('• Bulleted');
		expect(html).toContain('1. Numbered');
	});
});
