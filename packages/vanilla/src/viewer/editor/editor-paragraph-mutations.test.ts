import type { PptxElement } from 'pptx-viewer-core';
import { buildParagraphs } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it } from 'vitest';

import { renderTextBlock } from '../render/elements/text-block';
import { readTextFormatState } from './editor-format-mutations';
import {
	adjustIndent,
	setLineSpacing,
	setTextAlign,
	toggleListType,
} from './editor-paragraph-mutations';

function textElement(): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hi',
		textStyle: {},
		textSegments: [{ text: 'hi', style: {} }],
	} as PptxElement;
}

describe('editor-paragraph-mutations', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('toggles one rendered bullet on, off, and on without changing its body', () => {
		let el = textElement();
		for (const marker of ['•', undefined, '•']) {
			el = { ...el, ...toggleListType(el, 'bullet') } as PptxElement;
			const paragraphs = buildParagraphs(el);
			expect(paragraphs[0].bulletMarker).toBe(marker);
			expect(paragraphs[0].runs.map((run) => run.text).join('')).toBe('hi');
			const rendered = renderTextBlock(document, paragraphs, {});
			expect(rendered.querySelectorAll('.pptxv-bullet')).toHaveLength(marker ? 1 : 0);
			expect(readTextFormatState(el).listType).toBe(marker ? 'bullet' : 'none');
		}
	});

	it('reads loaded semantic bullets and switches directly to rendered numbering', () => {
		const el = {
			...textElement(),
			textSegments: [
				{ text: '» ', style: {}, bulletInfo: { char: '»' } },
				{ text: 'hi', style: { bold: true } },
			],
		} as PptxElement;
		expect(readTextFormatState(el).listType).toBe('bullet');
		const next = { ...el, ...toggleListType(el, 'numbered') } as PptxElement;
		expect(buildParagraphs(next)[0].bulletMarker).toBe('1.');
		expect(
			buildParagraphs(next)[0]
				.runs.map((run) => run.text)
				.join(''),
		).toBe('hi');
		expect(readTextFormatState(next).listType).toBe('numbered');
	});

	it('keeps pending inline text when the ribbon command runs before blur', () => {
		const surface = document.createElement('div');
		surface.dataset.inlineEditor = '';
		surface.textContent = 'pending body';
		document.body.append(surface);
		const el = textElement();
		const next = { ...el, ...toggleListType(el, 'bullet') } as PptxElement;
		expect('text' in next && next.text).toBe('pending body');
		expect(
			buildParagraphs(next)[0]
				.runs.map((run) => run.text)
				.join(''),
		).toBe('pending body');
		expect(buildParagraphs(next)[0].bulletMarker).toBe('•');
	});

	it('increases and clamps indent at zero', () => {
		const inc = adjustIndent(textElement(), 1) as { textStyle: { paragraphMarginLeft?: number } };
		expect(inc.textStyle.paragraphMarginLeft).toBe(24);

		const dec = adjustIndent(textElement(), -1) as { textStyle: { paragraphMarginLeft?: number } };
		expect(dec.textStyle.paragraphMarginLeft).toBe(0);
	});

	it('sets alignment and line spacing', () => {
		const aligned = setTextAlign(textElement(), 'center') as { textStyle: { align?: string } };
		expect(aligned.textStyle.align).toBe('center');

		const spaced = setLineSpacing(textElement(), 1.5) as { textStyle: { lineSpacing?: number } };
		expect(spaced.textStyle.lineSpacing).toBe(1.5);
	});

	it('is a no-op patch for a non-text element', () => {
		const table = { type: 'table', id: 'x', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		expect(toggleListType(table, 'bullet')).toStrictEqual({});
	});
});
