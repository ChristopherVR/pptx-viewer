import type { PptxElement, ShapePptxElement, TextPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyElementUpdate, applyShapeStyleUpdate, applyTextUpdate } from './mutations';

function textElement(overrides?: Partial<TextPptxElement>): TextPptxElement {
	return {
		type: 'text',
		id: 'txt-1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'Hello world',
		...overrides,
	};
}

function shapeElement(overrides?: Partial<ShapePptxElement>): ShapePptxElement {
	return {
		type: 'shape',
		id: 'shp-1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		...overrides,
	};
}

describe('applyTextUpdate', () => {
	it('sets the element-level textStyle default', () => {
		const el = textElement();
		applyTextUpdate(el, { fontSize: 24, fontColor: '#FF0000' });
		expect(el.textStyle).toStrictEqual({ fontSize: 24, color: '#FF0000' });
	});

	it('merges the same style onto every textSegment so multi-run text restyles', () => {
		const el = textElement({
			textSegments: [
				{ text: 'Hello ', style: { bold: true } },
				{ text: 'world', style: { italic: true } },
			],
		});
		applyTextUpdate(el, { fontSize: 24, fontColor: '#FF0000' });
		expect(el.textSegments).toStrictEqual([
			{ text: 'Hello ', style: { bold: true, fontSize: 24, color: '#FF0000' } },
			{ text: 'world', style: { italic: true, fontSize: 24, color: '#FF0000' } },
		]);
		// Element-level default is set too.
		expect(el.textStyle).toStrictEqual({ fontSize: 24, color: '#FF0000' });
	});

	it('is a no-op on elements with no text properties', () => {
		const el = { type: 'image', id: 'img-1', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		applyTextUpdate(el, { fontSize: 24 });
		expect(el).not.toHaveProperty('textStyle');
	});

	it('does nothing when no text/style fields are present in the update', () => {
		const el = textElement({ textSegments: [{ text: 'Hello world', style: { bold: true } }] });
		applyTextUpdate(el, {});
		expect(el.textStyle).toBeUndefined();
		expect(el.textSegments).toStrictEqual([{ text: 'Hello world', style: { bold: true } }]);
	});
});

describe('applyShapeStyleUpdate', () => {
	it('applies a fill update to a shape that has never had a shapeStyle assigned', () => {
		// Regression: a raw `'shapeStyle' in el` check is false here (the key was
		// never assigned by the parser), so the update would previously be
		// silently dropped. `hasShapeProperties` narrows by `element.type` instead.
		const el = shapeElement();
		expect('shapeStyle' in el).toBeFalsy();
		applyShapeStyleUpdate(el, { fillColor: '#00FF00' });
		expect(el.shapeStyle).toStrictEqual({ fillColor: '#00FF00' });
	});

	it('applies a fill update to an image element (also shape-style-bearing)', () => {
		const el = {
			type: 'image',
			id: 'img-1',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			imagePath: 'ppt/media/image1.png',
		} as PptxElement;
		applyShapeStyleUpdate(el, { strokeColor: '#123456' });
		expect((el as { shapeStyle?: { strokeColor?: string } }).shapeStyle).toStrictEqual({
			strokeColor: '#123456',
		});
	});

	it('is a no-op on elements with no shape-style properties (e.g. table)', () => {
		const el = { type: 'table', id: 'tbl-1', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		applyShapeStyleUpdate(el, { fillColor: '#00FF00' });
		expect(el).not.toHaveProperty('shapeStyle');
	});
});

describe('applyElementUpdate', () => {
	it('applies geometry, text, and shape-style fields together', () => {
		const el = shapeElement({ text: 'Label' });
		applyElementUpdate(el, { x: 10, y: 20, fontSize: 18, fillColor: '#ABCDEF' });
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.textStyle).toStrictEqual({ fontSize: 18 });
		expect(el.shapeStyle).toStrictEqual({ fillColor: '#ABCDEF' });
	});
});
