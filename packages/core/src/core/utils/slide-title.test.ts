import { describe, it, expect } from 'vitest';

import type { PptxElement, PptxSlide } from '../types';
import { deriveSlideTitle, deriveSlideTitles } from './slide-title';

function makeSlide(elements: PptxElement[]): PptxSlide {
	return {
		id: 'ppt/slides/slide1.xml',
		rId: 'rId1',
		slideNumber: 1,
		elements,
		rawXml: {},
	} as PptxSlide;
}

/** Build an element whose preserved rawXml carries a `p:ph` placeholder. */
function elementWithPh(phType: string, text: string): PptxElement {
	return {
		id: 'el',
		type: 'text',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		text,
		rawXml: {
			'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': phType } } },
		},
	} as unknown as PptxElement;
}

describe('deriveSlideTitle', () => {
	it('reads the title from a title placeholder in rawXml', () => {
		const slide = makeSlide([elementWithPh('title', 'Quarterly Review')]);
		expect(deriveSlideTitle(slide)).toBe('Quarterly Review');
	});

	it('reads the title from a ctrTitle placeholder', () => {
		const slide = makeSlide([elementWithPh('ctrTitle', 'Cover Page')]);
		expect(deriveSlideTitle(slide)).toBe('Cover Page');
	});

	it('ignores subtitle and body placeholders', () => {
		const slide = makeSlide([
			elementWithPh('subTitle', 'A subtitle'),
			elementWithPh('body', 'Body text'),
		]);
		expect(deriveSlideTitle(slide)).toBe('');
	});

	it('returns an empty string when no title placeholder is present', () => {
		const slide = makeSlide([elementWithPh('body', 'Just body')]);
		expect(deriveSlideTitle(slide)).toBe('');
	});

	it('honours an explicit placeholderType field when present', () => {
		const element = {
			id: 'el',
			type: 'text',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			text: 'Explicit Title',
			placeholderType: 'title',
		} as unknown as PptxElement;
		expect(deriveSlideTitle(makeSlide([element]))).toBe('Explicit Title');
	});

	it('falls back to joined text segments when text is absent', () => {
		const element = {
			id: 'el',
			type: 'text',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			textSegments: [{ text: 'Seg ' }, { text: 'Title' }],
			rawXml: { 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': 'title' } } } },
		} as unknown as PptxElement;
		expect(deriveSlideTitle(makeSlide([element]))).toBe('Seg Title');
	});

	it('derives titles for a whole deck in order', () => {
		const slides = [
			makeSlide([elementWithPh('title', 'One')]),
			makeSlide([elementWithPh('title', 'Two')]),
			makeSlide([]),
		];
		expect(deriveSlideTitles(slides)).toStrictEqual(['One', 'Two', '']);
	});
});
