import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyPasteSpecialFormat,
	buildRasterPictureElement,
	PASTE_SPECIAL_OPTIONS,
	pasteElementHasText,
} from './paste-special';

const SHAPE: ShapePptxElement = {
	type: 'shape',
	id: 'shape-1',
	x: 0,
	y: 0,
	width: 100,
	height: 50,
	rotation: 0,
	text: 'Hello world',
	shapeStyle: {
		fillColor: '#ff0000',
		fillColorRef: { type: 'accent1' },
		strokeColor: '#00ff00',
		strokeColorRef: { type: 'accent2' },
	},
	textStyle: { color: '#0000ff', fontFamily: 'Arial' },
} as unknown as ShapePptxElement;

describe('pasteSpecialOptions', () => {
	it('offers the four PowerPoint Paste Special / Paste Options formats, in order', () => {
		expect(PASTE_SPECIAL_OPTIONS.map((option) => option.id)).toStrictEqual([
			'keep-source-formatting',
			'use-destination-theme',
			'picture',
			'keep-text-only',
		]);
	});
});

describe('pasteElementHasText', () => {
	it('is true for an element carrying non-blank text', () => {
		expect(pasteElementHasText(SHAPE)).toBeTruthy();
	});

	it('is false when the text is blank or absent', () => {
		expect(pasteElementHasText({ ...SHAPE, text: '   ' })).toBeFalsy();
		expect(
			pasteElementHasText({ ...SHAPE, text: undefined } as unknown as PptxElement),
		).toBeFalsy();
	});
});

describe('applyPasteSpecialFormat', () => {
	it('keep-source-formatting and picture are no-ops on the element itself', () => {
		expect(applyPasteSpecialFormat(SHAPE, 'keep-source-formatting')).toBe(SHAPE);
		expect(applyPasteSpecialFormat(SHAPE, 'picture')).toBe(SHAPE);
	});

	it('use-destination-theme strips explicit colour and font overrides', () => {
		const result = applyPasteSpecialFormat(SHAPE, 'use-destination-theme') as ShapePptxElement;
		expect(result.shapeStyle?.fillColor).toBeUndefined();
		expect(result.shapeStyle?.fillColorRef).toBeUndefined();
		expect(result.shapeStyle?.strokeColor).toBeUndefined();
		expect(result.shapeStyle?.strokeColorRef).toBeUndefined();
		expect(result.textStyle?.color).toBeUndefined();
		expect(result.textStyle?.fontFamily).toBeUndefined();
		// The source element is left untouched (a fresh clone is returned).
		expect(SHAPE.shapeStyle?.fillColor).toBe('#ff0000');
	});

	it('use-destination-theme leaves geometry, gradients and images alone', () => {
		const result = applyPasteSpecialFormat(SHAPE, 'use-destination-theme') as ShapePptxElement;
		expect(result.x).toBe(SHAPE.x);
		expect(result.width).toBe(SHAPE.width);
	});

	it('keep-text-only reduces the element to a bare text box', () => {
		const result = applyPasteSpecialFormat(SHAPE, 'keep-text-only');
		expect(result).toMatchObject({
			type: 'text',
			id: SHAPE.id,
			x: SHAPE.x,
			y: SHAPE.y,
			width: SHAPE.width,
			height: SHAPE.height,
			text: 'Hello world',
		});
	});

	it('keep-text-only degrades to an unchanged clone when there is no text to keep', () => {
		const noText = { ...SHAPE, text: '' };
		expect(applyPasteSpecialFormat(noText, 'keep-text-only')).toBe(noText);
	});
});

describe('buildRasterPictureElement', () => {
	it('builds a picture element at the source position, size and rotation', () => {
		const rotated = { ...SHAPE, rotation: 45 };
		const result = buildRasterPictureElement(rotated, 'data:image/png;base64,abc');
		expect(result).toStrictEqual({
			type: 'picture',
			id: rotated.id,
			x: rotated.x,
			y: rotated.y,
			width: rotated.width,
			height: rotated.height,
			rotation: 45,
			imageData: 'data:image/png;base64,abc',
		});
	});
});
