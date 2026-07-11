import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	appendElement,
	newElementId,
	newImageElement,
	newShapeElement,
	newTableElement,
	newTextElement,
} from './editor-insert';

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements };
}

describe('editor-insert', () => {
	it('generates unique, prefixed element ids', () => {
		const a = newElementId();
		const b = newElementId();
		expect(a).toMatch(/^el-/);
		expect(a).not.toBe(b);
	});

	it('re-exports the shared factories with blank ids', () => {
		expect(newTextElement().type).toBe('text');
		expect(newShapeElement('rect').type).toBe('shape');
		expect(newShapeElement('ellipse').shapeType).toBe('ellipse');
		expect(newTableElement().type).toBe('table');
		expect(newTextElement().id).toBe('');
	});

	it('builds an image element from a data URL', () => {
		const el = newImageElement('data:image/png;base64,AAA', 5, 6, 100, 80);
		expect(el).toMatchObject({
			type: 'image',
			imageData: 'data:image/png;base64,AAA',
			x: 5,
			y: 6,
			width: 100,
			height: 80,
		});
	});

	it('appends an element to the target slide only (immutably)', () => {
		const slides = [slide('a', [newShapeElement('rect')]), slide('b', [])];
		const next = appendElement(slides, 0, { ...newTextElement(), id: 'new' } as PptxElement);
		expect(next[0].elements).toHaveLength(2);
		expect(next[0].elements[1].id).toBe('new');
		expect(next[1]).toBe(slides[1]); // untouched slide reused by reference
		expect(slides[0].elements).toHaveLength(1); // original not mutated
	});
});
