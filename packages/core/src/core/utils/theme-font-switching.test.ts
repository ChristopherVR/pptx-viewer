import { describe, it, expect } from 'vitest';

import type { PptxElement, PptxSlide, PptxThemeFontScheme, TextSegment } from '../types';
import { reResolveElementFonts, reResolveSlideFonts } from './theme-font-switching';

const OFFICE_FONTS: PptxThemeFontScheme = {
	majorFont: { latin: 'Calibri Light', eastAsia: 'MS Gothic' },
	minorFont: { latin: 'Calibri', eastAsia: 'MS Mincho' },
};

const APTOS_FONTS: PptxThemeFontScheme = {
	majorFont: { latin: 'Aptos Display' },
	minorFont: { latin: 'Aptos' },
};

function textElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'txt_1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'Hello',
		textStyle: { fontFamily: 'Calibri' },
		...overrides,
	} as PptxElement;
}

function slideOf(elements: PptxElement[]): PptxSlide {
	return { elements, slideNumber: 1 } as PptxSlide;
}

type TextLike = {
	textStyle?: { fontFamily?: string; eastAsiaFont?: string; complexScriptFont?: string };
	textSegments?: TextSegment[];
};

describe('reResolveSlideFonts', () => {
	it('re-resolves runs that carry a theme font token', () => {
		const title = textElement({
			id: 'title',
			textStyle: { fontFamily: 'Calibri Light', latinFontThemeToken: '+mj-lt' },
			textSegments: [
				{
					text: 'Title',
					style: { fontFamily: 'Calibri Light', latinFontThemeToken: '+mj-lt' },
				},
			],
		} as Partial<PptxElement>);

		const [slide] = reResolveSlideFonts([slideOf([title])], OFFICE_FONTS, APTOS_FONTS);
		const element = slide.elements[0] as TextLike;

		expect(element.textStyle?.fontFamily).toBe('Aptos Display');
		expect(element.textSegments?.[0]?.style.fontFamily).toBe('Aptos Display');
		// The token itself is metadata the writer re-emits; it stays put.
		expect(element.textSegments?.[0]?.style.latinFontThemeToken).toBe('+mj-lt');
		expect((title as TextLike).textStyle?.fontFamily).toBe('Calibri Light');
	});

	it('moves a placeholder whose flattened face matches the old theme face', () => {
		const body = textElement({
			id: 'body',
			placeholderType: 'body',
			textStyle: { fontFamily: 'Calibri' },
			textSegments: [{ text: 'Body', style: { fontFamily: 'Calibri' } }],
		} as Partial<PptxElement>);
		const centred = textElement({
			id: 'ctr',
			placeholderType: 'ctrTitle',
			textStyle: { fontFamily: 'Calibri Light' },
		} as Partial<PptxElement>);

		const [slide] = reResolveSlideFonts([slideOf([body, centred])], OFFICE_FONTS, APTOS_FONTS);

		expect((slide.elements[0] as TextLike).textStyle?.fontFamily).toBe('Aptos');
		expect((slide.elements[0] as TextLike).textSegments?.[0]?.style.fontFamily).toBe('Aptos');
		expect((slide.elements[1] as TextLike).textStyle?.fontFamily).toBe('Aptos Display');
	});

	it('leaves explicitly authored faces and token-less text boxes alone', () => {
		const explicit = textElement({
			id: 'explicit',
			placeholderType: 'body',
			textStyle: { fontFamily: 'Georgia' },
		} as Partial<PptxElement>);
		const freeBox = textElement({ id: 'box', textStyle: { fontFamily: 'Calibri' } });
		const slides = [slideOf([explicit, freeBox])];

		const result = reResolveSlideFonts(slides, OFFICE_FONTS, APTOS_FONTS);

		expect((result[0].elements[0] as TextLike).textStyle?.fontFamily).toBe('Georgia');
		expect((result[0].elements[1] as TextLike).textStyle?.fontFamily).toBe('Calibri');
		// Nothing changed, so the input array and slide objects are returned.
		expect(result).toBe(slides);
	});

	it('re-resolves East Asian and complex-script tokens and keeps Latin untouched', () => {
		const run = textElement({
			id: 'ea',
			textStyle: {
				fontFamily: 'Georgia',
				eastAsiaFont: 'MS Mincho',
				eastAsiaFontThemeToken: '+mn-ea',
				complexScriptFont: 'Arial',
				complexScriptFontThemeToken: '+mn-cs',
			},
		} as Partial<PptxElement>);

		const [slide] = reResolveSlideFonts([slideOf([run])], OFFICE_FONTS, APTOS_FONTS);
		const style = (slide.elements[0] as TextLike).textStyle;

		expect(style?.fontFamily).toBe('Georgia');
		// The new scheme has no East Asian face, so the Latin face stands in.
		expect(style?.eastAsiaFont).toBe('Aptos');
		expect(style?.complexScriptFont).toBe('Aptos');
	});

	it('recurses into groups and re-resolves notes text', () => {
		const group = {
			type: 'group',
			id: 'group',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			children: [
				textElement({
					textStyle: { fontFamily: 'Calibri', latinFontThemeToken: '+mn-lt' },
				} as Partial<PptxElement>),
			],
		} as PptxElement;
		const slide = slideOf([group]);
		slide.notesSegments = [{ text: 'Note', style: { fontFamily: 'Calibri' } }];
		slide.notesShapes = [
			textElement({
				id: 'notes-shape',
				textStyle: { fontFamily: 'Calibri Light', latinFontThemeToken: '+mj-lt' },
			} as Partial<PptxElement>),
		];

		const [result] = reResolveSlideFonts([slide], OFFICE_FONTS, APTOS_FONTS);

		const child = (result.elements[0] as { children: PptxElement[] }).children[0] as TextLike;
		expect(child.textStyle?.fontFamily).toBe('Aptos');
		expect(result.notesSegments?.[0]?.style.fontFamily).toBe('Aptos');
		const notesShape = result.notesShapes?.[0] as TextLike | undefined;
		expect(notesShape?.textStyle?.fontFamily).toBe('Aptos Display');
	});

	it('moves table cell fonts that match the old minor face', () => {
		const table = {
			type: 'table',
			id: 'tbl',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			tableData: {
				rows: [
					{
						cells: [
							{ text: 'a', style: { fontFamily: 'Calibri' } },
							{ text: 'b', style: { fontFamily: 'Georgia' } },
						],
					},
				],
			},
		} as unknown as PptxElement;

		const [element] = reResolveElementFonts([table], OFFICE_FONTS, APTOS_FONTS);
		const cells = (
			element as {
				tableData: { rows: Array<{ cells: Array<{ style?: { fontFamily?: string } }> }> };
			}
		).tableData.rows[0].cells;

		expect(cells[0].style?.fontFamily).toBe('Aptos');
		expect(cells[1].style?.fontFamily).toBe('Georgia');
	});
});
