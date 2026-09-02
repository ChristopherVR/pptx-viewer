import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildOutline,
	groupElementParagraphs,
	outlineRowKey,
	paragraphGroupText,
	readElementParagraphs,
	resolveSlideOutlineElements,
} from './outline-view';

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

describe('resolveSlideOutlineElements', () => {
	it('prefers the title placeholder over document order', () => {
		const body = textElement('b', { text: 'Body', rawXml: placeholder('body') });
		const title = textElement('t', { text: 'Title', rawXml: placeholder('title') });
		const resolved = resolveSlideOutlineElements(slide('s1', [body, title]));
		expect(resolved.title?.id).toBe('t');
		expect(resolved.body.map((element) => element.id)).toStrictEqual(['b']);
	});

	it('treats a p:ph with no @type as a body placeholder', () => {
		const body = textElement('b', {
			text: 'Body',
			rawXml: { 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_idx': '1' } } } },
		});
		const resolved = resolveSlideOutlineElements(slide('s1', [body]));
		expect(resolved.body.map((element) => element.id)).toStrictEqual(['b']);
	});

	// `<p:ph/>` with every attribute defaulted is the shortest legal spelling of
	// a body placeholder, and fast-xml-parser materialises it as the empty
	// STRING. A truthiness test read it as "not a placeholder", so a deck whose
	// body is spelled that way lost its body text from the outline: the title
	// placeholder alone satisfied the placeholder branch and the body element
	// was filtered out of it.
	it('treats a bare <p:ph/>, which the parser gives as the empty string, as body', () => {
		const title = textElement('t', { text: 'Title', rawXml: placeholder('title') });
		const body = textElement('b', {
			text: 'Body',
			rawXml: { 'p:nvSpPr': { 'p:nvPr': { 'p:ph': '' } } },
		});
		const resolved = resolveSlideOutlineElements(slide('s1', [title, body]));
		expect(resolved.title?.id).toBe('t');
		expect(resolved.body.map((element) => element.id)).toStrictEqual(['b']);
	});

	it('still reports a shape with no p:ph at all as not a placeholder', () => {
		const title = textElement('t', { text: 'Title', rawXml: placeholder('title') });
		const free = textElement('f', {
			text: 'Free text',
			rawXml: { 'p:nvSpPr': { 'p:nvPr': '' } },
		});
		const resolved = resolveSlideOutlineElements(slide('s1', [title, free]));
		expect(resolved.body).toStrictEqual([]);
	});

	it('excludes footer / date / slide-number chrome placeholders', () => {
		const title = textElement('t', { text: 'Title', rawXml: placeholder('title') });
		const footer = textElement('f', { text: 'Confidential', rawXml: placeholder('ftr') });
		const number = textElement('n', { text: '3', rawXml: placeholder('sldNum') });
		const resolved = resolveSlideOutlineElements(slide('s1', [title, footer, number]));
		expect(resolved.body).toStrictEqual([]);
	});

	it('falls back to text-bearing elements when the slide has no placeholders', () => {
		const first = textElement('a', { text: 'Heading' });
		const second = textElement('b', { text: 'Detail' });
		const blank = textElement('c', { text: '   ' });
		const resolved = resolveSlideOutlineElements(slide('s1', [first, second, blank]));
		expect(resolved.title?.id).toBe('a');
		expect(resolved.body.map((element) => element.id)).toStrictEqual(['b']);
	});

	it('matches an outline-created title element by name', () => {
		const other = textElement('a', { text: 'Detail' });
		const created = textElement('z', { name: 'Title', text: 'New title' });
		const resolved = resolveSlideOutlineElements(slide('s1', [other, created]));
		expect(resolved.title?.id).toBe('z');
	});
});

describe('groupElementParagraphs', () => {
	it('splits on paragraph breaks and on bare newline segments', () => {
		const element = textElement('a', {
			text: 'One\nTwo\nThree',
			textSegments: [
				{ text: 'One', style: {} },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: 'Two', style: {} },
				{ text: '\n', style: {} },
				{ text: 'Three', style: {} },
			],
		});
		expect(groupElementParagraphs(element).map(paragraphGroupText)).toStrictEqual([
			'One',
			'Two',
			'Three',
		]);
	});

	it('lifts the display bullet marker out of the paragraph text', () => {
		const element = textElement('a', {
			text: '• Item',
			textSegments: [
				{ text: '• ', style: {}, bulletInfo: {} },
				{ text: 'Item', style: {} },
			],
		});
		const groups = groupElementParagraphs(element);
		expect(groups[0].marker?.text).toBe('• ');
		expect(paragraphGroupText(groups[0])).toBe('Item');
	});

	it('keeps real numbered content that carries paragraph metadata', () => {
		const element = textElement('a', {
			textSegments: [
				{
					text: 'Item',
					style: {},
					bulletInfo: {
						autoNumType: 'arabicPeriod',
						autoNumStartAt: 2,
						paragraphIndex: 1,
					},
				},
			],
		});
		const groups = groupElementParagraphs(element);
		expect(groups[0].marker).toBeUndefined();
		expect(paragraphGroupText(groups[0])).toBe('Item');
	});

	it.each(['3.', '3. '])('lifts the generated numbered marker %j out of the text', (marker) => {
		const element = textElement('a', {
			textSegments: [
				{
					text: marker,
					style: {},
					bulletInfo: {
						autoNumType: 'arabicPeriod',
						autoNumStartAt: 2,
						paragraphIndex: 1,
					},
				},
				{ text: 'Item', style: {} },
			],
		});
		const groups = groupElementParagraphs(element);
		expect(groups[0].marker?.text).toBe(marker);
		expect(paragraphGroupText(groups[0])).toBe('Item');
	});

	it('keeps marker-like numbered text without a runtime paragraph index', () => {
		const element = textElement('a', {
			textSegments: [
				{
					text: '1.',
					style: {},
					bulletInfo: { autoNumType: 'arabicPeriod' },
				},
			],
		});
		const groups = groupElementParagraphs(element);
		expect(groups[0].marker).toBeUndefined();
		expect(paragraphGroupText(groups[0])).toBe('1.');
	});

	it('renders a soft line break as a space, never as a paragraph split', () => {
		const element = textElement('a', {
			textSegments: [
				{ text: 'Left', style: {} },
				{ text: '\n', style: {}, isLineBreak: true },
				{ text: 'Right', style: {} },
			],
		});
		const groups = groupElementParagraphs(element);
		expect(groups).toHaveLength(1);
		expect(paragraphGroupText(groups[0])).toBe('Left Right');
	});

	it('falls back to element.text for a segment-free element', () => {
		const element = textElement('a', { text: 'Alpha\nBeta' });
		expect(groupElementParagraphs(element).map(paragraphGroupText)).toStrictEqual([
			'Alpha',
			'Beta',
		]);
	});
});

describe('readElementParagraphs', () => {
	it('reads the authored a:pPr/@lvl of each paragraph', () => {
		const element = textElement('a', {
			textSegments: [
				{ text: 'Top', style: {} },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: 'Nested', style: {}, paragraphLevel: 2 },
			],
		});
		expect(readElementParagraphs(element)).toStrictEqual([
			{ text: 'Top', level: 0 },
			{ text: 'Nested', level: 2 },
		]);
	});

	it('drops trailing empty paragraphs left behind by the load path', () => {
		const element = textElement('a', {
			textSegments: [
				{ text: 'Only', style: {} },
				{ text: '\n', style: {}, isParagraphBreak: true },
			],
		});
		expect(readElementParagraphs(element)).toStrictEqual([{ text: 'Only', level: 0 }]);
	});
});

describe('buildOutline', () => {
	it('reflects the deck: a title row then its body lines at authored levels', () => {
		const title = textElement('t', { text: 'Agenda', rawXml: placeholder('title') });
		const body = textElement('b', {
			rawXml: placeholder('body'),
			textSegments: [
				{ text: 'First', style: {} },
				{ text: '\n', style: {}, isParagraphBreak: true },
				{ text: 'Nested', style: {}, paragraphLevel: 1 },
			],
		});
		const rows = buildOutline([slide('s1', [title, body])]);
		expect(rows.map((row) => [row.kind, row.text, row.level])).toStrictEqual([
			['title', 'Agenda', 0],
			['body', 'First', 1],
			['body', 'Nested', 2],
		]);
	});

	it('gives a titleless slide a row rather than hiding it', () => {
		const rows = buildOutline([slide('s1', []), slide('s2', [], 2)]);
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.slideId)).toStrictEqual(['s1', 's2']);
		expect(rows.every((row) => row.kind === 'title' && row.text === '')).toBeTruthy();
		expect(rows[0].elementId).toBeNull();
	});

	it('gives an EMPTY title placeholder a row, keyed to the real element', () => {
		const title = textElement('t', { text: '', rawXml: placeholder('title') });
		const rows = buildOutline([slide('s1', [title])]);
		expect(rows).toHaveLength(1);
		expect(rows[0].elementId).toBe('t');
		expect(rows[0].key).toBe(outlineRowKey('s1', 't', 0));
	});

	it('keys rows by slide and element id, not by slide position', () => {
		const first = slide('s1', [textElement('t1', { text: 'One' })]);
		const second = slide('s2', [textElement('t2', { text: 'Two' })], 2);
		const before = buildOutline([first, second]);
		const after = buildOutline([slide('s0', [], 1), first, second]);
		expect(after.map((row) => row.key)).toContain(before[1].key);
		// Same key, one row further down, and its slideIndex has followed the move.
		expect(after[2].key).toBe(before[1].key);
		expect(after[2].slideIndex).toBe(2);
		expect(before[1].slideIndex).toBe(1);
	});
});
