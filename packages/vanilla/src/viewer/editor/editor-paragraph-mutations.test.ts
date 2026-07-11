import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

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
	it('toggles bullet list on then off', () => {
		const on = toggleListType(textElement(), 'bullet') as { textStyle: { listType?: string } };
		expect(on.textStyle.listType).toBe('bullet');

		const el = textElement() as PptxElement & { textStyle: { listType?: string } };
		el.textStyle.listType = 'bullet';
		const off = toggleListType(el, 'bullet') as { textStyle: { listType?: string } };
		expect(off.textStyle.listType).toBe('none');
	});

	it('switches from bullet to numbered directly', () => {
		const el = textElement() as PptxElement & { textStyle: { listType?: string } };
		el.textStyle.listType = 'bullet';
		const patch = toggleListType(el, 'numbered') as { textStyle: { listType?: string } };
		expect(patch.textStyle.listType).toBe('numbered');
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
