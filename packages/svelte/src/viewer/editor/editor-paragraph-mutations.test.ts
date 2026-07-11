import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

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
	it('turns bullet on from none', () => {
		const patch = toggleListTypePatch(textEl(), 'bullet');
		expect(patch.textStyle?.listType).toBe('bullet');
	});

	it('turns the same list type back off', () => {
		const patch = toggleListTypePatch(textEl({ listType: 'bullet' }), 'bullet');
		expect(patch.textStyle?.listType).toBe('none');
	});

	it('switches from bullet to numbered', () => {
		const patch = toggleListTypePatch(textEl({ listType: 'bullet' }), 'numbered');
		expect(patch.textStyle?.listType).toBe('numbered');
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
