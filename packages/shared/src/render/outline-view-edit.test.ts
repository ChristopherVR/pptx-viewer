import type { PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildOutline, outlineRowKey, readElementParagraphs } from './outline-view';
import { applyOutlineEdit, mapOutlineKey, writeElementParagraphs } from './outline-view-edit';

function textElement(id: string, partial: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id,
		name: 'Text Box',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: '',
		...partial,
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[], slideNumber = 1): PptxSlide {
	return { id, rId: '', slideNumber, elements };
}

function placeholder(type: string): Record<string, unknown> {
	return { 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': type } } } };
}

function bodyElement(paragraphs: Array<{ text: string; level?: number }>): PptxElement {
	const segments: TextSegment[] = [];
	for (const [index, paragraph] of paragraphs.entries()) {
		if (index > 0) {
			segments.push({ text: '\n', style: {}, isParagraphBreak: true });
		}
		segments.push({
			text: paragraph.text,
			style: { fontSize: 18 },
			...(paragraph.level ? { paragraphLevel: paragraph.level } : {}),
		});
	}
	return textElement('b', {
		rawXml: placeholder('body'),
		text: paragraphs.map((paragraph) => paragraph.text).join('\n'),
		textSegments: segments,
	});
}

const deck = (): PptxSlide[] => [
	slide('s1', [
		textElement('t', { text: 'Agenda', rawXml: placeholder('title') }),
		bodyElement([{ text: 'First' }, { text: 'Second', level: 1 }]),
	]),
];

const ids = (): (() => string) => {
	let n = 0;
	return () => `gen-${++n}`;
};

describe('mapOutlineKey', () => {
	it('maps Tab and Shift+Tab to demote and promote', () => {
		expect(mapOutlineKey({ key: 'Tab' }, 'k')).toStrictEqual({
			edit: { type: 'indent', key: 'k', delta: 1 },
			preventDefault: true,
		});
		expect(mapOutlineKey({ key: 'Tab', shiftKey: true }, 'k').edit).toStrictEqual({
			type: 'indent',
			key: 'k',
			delta: -1,
		});
	});

	it('maps PowerPoint Alt+Shift+Arrow chords too', () => {
		expect(
			mapOutlineKey({ key: 'ArrowRight', altKey: true, shiftKey: true }, 'k').edit,
		).toStrictEqual({
			type: 'indent',
			key: 'k',
			delta: 1,
		});
		expect(
			mapOutlineKey({ key: 'ArrowLeft', altKey: true, shiftKey: true }, 'k').edit,
		).toStrictEqual({
			type: 'indent',
			key: 'k',
			delta: -1,
		});
	});

	it('maps Enter to a new line and leaves Ctrl chords to the binding', () => {
		expect(mapOutlineKey({ key: 'Enter' }, 'k').edit).toStrictEqual({
			type: 'insertAfter',
			key: 'k',
		});
		expect(mapOutlineKey({ key: 'z', ctrlKey: true }, 'k')).toStrictEqual({
			edit: null,
			preventDefault: false,
		});
		expect(mapOutlineKey({ key: 'Tab', ctrlKey: true }, 'k').preventDefault).toBeFalsy();
	});
});

describe('writeElementParagraphs', () => {
	it('round-trips through readElementParagraphs', () => {
		const element = bodyElement([{ text: 'One' }, { text: 'Two', level: 2 }]);
		const next = writeElementParagraphs(element, [
			{ text: 'One', level: 0 },
			{ text: 'Two', level: 2 },
		]);
		expect(readElementParagraphs(next)).toStrictEqual([
			{ text: 'One', level: 0 },
			{ text: 'Two', level: 2 },
		]);
	});

	it('keeps an untouched paragraph byte-identical, including its field metadata', () => {
		const element = textElement('b', {
			text: 'Edit me\n3',
			textSegments: [
				{ text: 'Edit me', style: {} },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: '3', style: {}, fieldType: 'slidenum', fieldGuid: 'guid-1' },
			],
		});
		const next = writeElementParagraphs(element, [
			{ text: 'Edited', level: 0 },
			{ text: '3', level: 0 },
		]);
		const field = (next as { textSegments: TextSegment[] }).textSegments.find(
			(segment) => segment.text === '3',
		);
		expect(field?.fieldType).toBe('slidenum');
		expect(field?.fieldGuid).toBe('guid-1');
	});

	it('preserves the bullet marker segment while replacing the run text', () => {
		const element = textElement('b', {
			text: '• Item',
			textSegments: [
				{ text: '• ', style: {}, bulletInfo: { char: '•' } },
				{ text: 'Item', style: {} },
			],
		});
		const next = writeElementParagraphs(element, [{ text: 'Renamed', level: 1 }]);
		const segments = (next as { textSegments: TextSegment[] }).textSegments;
		expect(segments[0].bulletInfo).toStrictEqual({ char: '•' });
		expect(segments[0].paragraphLevel).toBe(1);
		expect(segments.map((segment) => segment.text).join('')).toBe('• Renamed');
	});

	it('clears a:pPr/@lvl when a paragraph returns to the top level', () => {
		const element = bodyElement([{ text: 'Nested', level: 3 }]);
		const next = writeElementParagraphs(element, [{ text: 'Nested', level: 0 }]);
		expect(
			(next as { textSegments: TextSegment[] }).textSegments[0].paragraphLevel,
		).toBeUndefined();
	});
});

describe('applyOutlineEdit: setText', () => {
	it('reaches the slide element the row came from', () => {
		const slides = deck();
		const rows = buildOutline(slides);
		const result = applyOutlineEdit(slides, { type: 'setText', key: rows[1].key, text: 'Changed' });
		expect(result.changed).toBeTruthy();
		expect(buildOutline(result.slides)[1].text).toBe('Changed');
		// The input deck is untouched, so a binding's history keeps a real "before".
		expect(buildOutline(slides)[1].text).toBe('First');
	});

	it('edits the title placeholder', () => {
		const slides = deck();
		const rows = buildOutline(slides);
		const result = applyOutlineEdit(slides, { type: 'setText', key: rows[0].key, text: 'Plan' });
		const title = result.slides[0].elements.find((element) => element.id === 't');
		expect((title as { text?: string }).text).toBe('Plan');
	});

	it('creates a title element when a titleless slide is typed into', () => {
		const slides = [slide('s1', [])];
		const rows = buildOutline(slides);
		expect(rows[0].elementId).toBeNull();
		const result = applyOutlineEdit(
			slides,
			{ type: 'setText', key: rows[0].key, text: 'Brand new' },
			{ idGenerator: ids() },
		);
		expect(result.slides[0].elements).toHaveLength(1);
		const after = buildOutline(result.slides);
		expect(after).toHaveLength(1);
		expect(after[0].text).toBe('Brand new');
		expect(result.focusKey).toBe(after[0].key);
	});

	it('is a no-op for an empty edit of a row that has no element yet', () => {
		const slides = [slide('s1', [])];
		const rows = buildOutline(slides);
		const result = applyOutlineEdit(slides, { type: 'setText', key: rows[0].key, text: '' });
		expect(result.changed).toBeFalsy();
		expect(result.slides[0].elements).toHaveLength(0);
	});

	it('folds a pasted newline into a space rather than splitting the row', () => {
		const slides = deck();
		const rows = buildOutline(slides);
		const result = applyOutlineEdit(slides, {
			type: 'setText',
			key: rows[1].key,
			text: 'a\nb',
		});
		expect(buildOutline(result.slides).map((row) => row.text)).toStrictEqual([
			'Agenda',
			'a b',
			'Second',
		]);
	});

	it('ignores a key that no longer resolves', () => {
		const slides = deck();
		const result = applyOutlineEdit(slides, { type: 'setText', key: 'gone', text: 'x' });
		expect(result.changed).toBeFalsy();
	});
});

describe('applyOutlineEdit: indent', () => {
	it('demotes and promotes a body row, writing a:pPr/@lvl', () => {
		const slides = deck();
		const rows = buildOutline(slides);
		const demoted = applyOutlineEdit(slides, { type: 'indent', key: rows[1].key, delta: 1 });
		expect(buildOutline(demoted.slides)[1].level).toBe(2);
		const body = demoted.slides[0].elements.find((element) => element.id === 'b');
		expect(readElementParagraphs(body as PptxElement)[0].level).toBe(1);

		const promoted = applyOutlineEdit(demoted.slides, {
			type: 'indent',
			key: rows[1].key,
			delta: -1,
		});
		expect(buildOutline(promoted.slides)[1].level).toBe(1);
	});

	it('holds at the top body level instead of splitting a slide', () => {
		const slides = deck();
		const rows = buildOutline(slides);
		const result = applyOutlineEdit(slides, { type: 'indent', key: rows[1].key, delta: -1 });
		expect(result.changed).toBeFalsy();
		expect(buildOutline(result.slides)).toHaveLength(3);
	});

	it('leaves a title row alone', () => {
		const slides = deck();
		const rows = buildOutline(slides);
		expect(
			applyOutlineEdit(slides, { type: 'indent', key: rows[0].key, delta: 1 }).changed,
		).toBeFalsy();
	});

	it('clamps at the deepest level OOXML allows', () => {
		const slides = [slide('s1', [bodyElement([{ text: 'Deep', level: 8 }])])];
		const rows = buildOutline(slides);
		const body = rows.find((row) => row.kind === 'body');
		expect(body?.level).toBe(9);
		expect(
			applyOutlineEdit(slides, { type: 'indent', key: body!.key, delta: 1 }).changed,
		).toBeFalsy();
	});
});

describe('applyOutlineEdit: insertAfter', () => {
	it('adds a body line at the same level, and focuses it', () => {
		const slides = deck();
		const rows = buildOutline(slides);
		const result = applyOutlineEdit(slides, { type: 'insertAfter', key: rows[2].key });
		const after = buildOutline(result.slides);
		expect(after).toHaveLength(3);
		// The new line is empty, so the read path trims it off the end; the write
		// still happened and the caret target is the row that will exist as soon
		// as a character is typed into it.
		expect(result.focusKey).toBe(outlineRowKey('s1', 'b', 2));
	});

	it('keeps an inserted middle line, at the level it was split from', () => {
		const slides = [slide('s1', [bodyElement([{ text: 'One', level: 2 }, { text: 'Two' }])])];
		const rows = buildOutline(slides);
		const result = applyOutlineEdit(slides, { type: 'insertAfter', key: rows[1].key });
		const body = result.slides[0].elements.find((element) => element.id === 'b');
		expect(readElementParagraphs(body as PptxElement)).toStrictEqual([
			{ text: 'One', level: 2 },
			{ text: '', level: 2 },
			{ text: 'Two', level: 0 },
		]);
	});

	it('starts a NEW SLIDE when Enter lands on a title row', () => {
		const slides = deck();
		const rows = buildOutline(slides);
		const result = applyOutlineEdit(
			slides,
			{ type: 'insertAfter', key: rows[0].key },
			{ idGenerator: ids() },
		);
		expect(result.slides).toHaveLength(2);
		expect(result.activeSlideIndex).toBe(1);
		expect(result.slides.map((entry) => entry.slideNumber)).toStrictEqual([1, 2]);
		const after = buildOutline(result.slides);
		expect(after.filter((row) => row.slideIndex === 1)).toHaveLength(1);
		expect(result.focusKey).toBe(after[after.length - 1].key);
	});

	it('the new slide accepts a title straight away', () => {
		const slides = deck();
		const rows = buildOutline(slides);
		const created = applyOutlineEdit(
			slides,
			{ type: 'insertAfter', key: rows[0].key },
			{ idGenerator: ids() },
		);
		const typed = applyOutlineEdit(
			created.slides,
			{ type: 'setText', key: created.focusKey!, text: 'Next up' },
			{ idGenerator: ids() },
		);
		expect(buildOutline(typed.slides).map((row) => row.text)).toStrictEqual([
			'Agenda',
			'First',
			'Second',
			'Next up',
		]);
	});
});
