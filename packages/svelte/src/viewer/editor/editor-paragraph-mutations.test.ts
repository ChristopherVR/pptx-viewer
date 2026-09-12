import type { PptxElement } from 'pptx-viewer-core';
import { buildParagraphs, elementBulletKind } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it } from 'vitest';

import {
	adjustIndentPatch,
	setAlignPatch,
	setLineSpacingPatch,
	toggleListTypePatch,
} from './editor-paragraph-mutations';

function textEl(textStyle: PptxElement['textStyle'] = {}): PptxElement {
	return {
		type: 'text',
		id: 'e1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		text: 'hi',
		textSegments: [],
		textStyle,
	} as PptxElement;
}

describe('editor-paragraph-mutations toggleListTypePatch', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders a bullet on, off, and on without changing the body', () => {
		let el = textEl();
		for (const marker of ['•', undefined, '•']) {
			el = { ...el, ...toggleListTypePatch(el, 'bullet') } as PptxElement;
			const paragraphs = buildParagraphs(el);
			expect(paragraphs[0].bulletMarker).toBe(marker);
			expect(paragraphs[0].runs.map((run) => run.text).join('')).toBe('hi');
			expect(elementBulletKind(el)).toBe(marker ? 'bullet' : 'none');
		}
	});

	it('switches a loaded semantic bullet to rendered numbering', () => {
		const el = {
			...textEl(),
			textSegments: [
				{ text: '» ', style: {}, bulletInfo: { char: '»' } },
				{ text: 'hi', style: { bold: true } },
			],
		} as PptxElement;
		const next = { ...el, ...toggleListTypePatch(el, 'numbered') } as PptxElement;
		expect(buildParagraphs(next)[0].bulletMarker).toBe('1.');
		expect(
			buildParagraphs(next)[0]
				.runs.map((run) => run.text)
				.join(''),
		).toBe('hi');
		expect(elementBulletKind(next)).toBe('numbered');
	});

	it('reconciles pending inline text before adding semantic bullets', () => {
		const surface = document.createElement('div');
		surface.dataset.inlineEditor = '';
		surface.textContent = 'pending body';
		document.body.append(surface);
		const el = textEl();
		const next = { ...el, ...toggleListTypePatch(el, 'bullet') } as PptxElement;
		expect('text' in next && next.text).toBe('pending body');
		expect(
			buildParagraphs(next)[0]
				.runs.map((run) => run.text)
				.join(''),
		).toBe('pending body');
		expect(buildParagraphs(next)[0].bulletMarker).toBe('•');
	});

	it('does not add text to unsupported elements', () => {
		const table = { type: 'table', id: 't', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		expect(toggleListTypePatch(table, 'bullet')).toStrictEqual({});
	});
});

describe('editor-paragraph-mutations adjustIndentPatch', () => {
	it('increases and decreases the left margin by one step, clamped at 0', () => {
		expect(adjustIndentPatch(textEl(), 1).textStyle?.paragraphMarginLeft).toBe(24);
		expect(
			adjustIndentPatch(textEl({ paragraphMarginLeft: 24 }), -1).textStyle?.paragraphMarginLeft,
		).toBe(0);
		expect(adjustIndentPatch(textEl(), -1).textStyle?.paragraphMarginLeft).toBe(0);
	});
});

describe('editor-paragraph-mutations setAlignPatch / setLineSpacingPatch', () => {
	it('sets alignment and line spacing, preserving other fields', () => {
		const base = textEl({ bold: true });
		expect(setAlignPatch(base, 'center').textStyle).toStrictEqual({ bold: true, align: 'center' });
		expect(setLineSpacingPatch(base, 1.5).textStyle).toStrictEqual({
			bold: true,
			lineSpacing: 1.5,
		});
	});
});
