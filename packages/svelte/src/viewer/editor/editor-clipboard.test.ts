import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { copyElementToClipboard, pasteClipboardElement } from './editor-clipboard';

function el(id: string, x = 0): PptxElement {
	return { type: 'shape', id, x, y: 0, width: 10, height: 10, shapeType: 'rect' } as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's', rId: 'rId-s', slideNumber: 1, elements };
}

describe('editor-clipboard copyElementToClipboard', () => {
	it('builds a payload for an existing element', () => {
		const slides = [slide([el('a')])];
		const payload = copyElementToClipboard(slides, 0, 'a');
		expect(payload).not.toBeNull();
		expect(payload?.element.id).toBe('a');
		expect(payload?.isTemplate).toBeFalsy();
	});

	it('returns null for a missing id', () => {
		const slides = [slide([el('a')])];
		expect(copyElementToClipboard(slides, 0, 'missing')).toBeNull();
	});
});

describe('editor-clipboard pasteClipboardElement', () => {
	it('appends a fresh-id, offset clone to the target slide', () => {
		const slides = [slide([el('a')])];
		const payload = copyElementToClipboard(slides, 0, 'a')!;
		const result = pasteClipboardElement(slides, 0, payload);
		expect(result).not.toBeNull();
		expect(result?.slides[0].elements).toHaveLength(2);
		const pasted = result?.slides[0].elements[1] as PptxElement;
		expect(pasted.id).not.toBe('a');
		expect(pasted.id).toBe(result?.newId);
		expect(pasted.x).toBeGreaterThan(0);
	});

	it('returns null when the target slide does not exist', () => {
		const slides = [slide([el('a')])];
		const payload = copyElementToClipboard(slides, 0, 'a')!;
		expect(pasteClipboardElement(slides, 5, payload)).toBeNull();
	});

	it('leaves other slides untouched by reference', () => {
		const slides = [slide([el('a')]), slide([el('x')])];
		const payload = copyElementToClipboard(slides, 0, 'a')!;
		const result = pasteClipboardElement(slides, 0, payload);
		expect(result?.slides[1]).toBe(slides[1]);
	});
});
