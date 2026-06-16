import type { PptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { copyFormatFromElement, applyFormatToElement, hasCopyableFormat } from './format-painter';
import type { CopiedFormat } from './format-painter';

// Helper to create a shape element with shapeStyle
function makeShapeElement(shapeStyle: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'shape1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeType: 'rect',
		shapeStyle: {
			fillColor: '#FF0000',
			strokeColor: '#000000',
			strokeWidth: 2,
			...shapeStyle,
		},
	} as unknown as PptxElement;
}

// Helper to create a text element with textStyle
function makeTextElement(textStyle: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'text1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 50,
		text: 'Hello',
		textStyle: {
			fontFamily: 'Arial',
			fontSize: 24,
			bold: true,
			italic: false,
			underline: false,
			color: '#333333',
			align: 'left',
			...textStyle,
		},
	} as unknown as PptxElement;
}

describe('copyFormatFromElement', () => {
	it('should copy shape style properties from a shape element', () => {
		const element = makeShapeElement({
			fillColor: '#00FF00',
			strokeColor: '#0000FF',
			strokeWidth: 3,
		});
		const format = copyFormatFromElement(element);
		expect(format.shapeStyle).toBeDefined();
		expect(format.shapeStyle!.fillColor).toBe('#00FF00');
		expect(format.shapeStyle!.strokeColor).toBe('#0000FF');
		expect(format.shapeStyle!.strokeWidth).toBe(3);
	});

	it('should copy text style properties from a text element', () => {
		const element = makeTextElement({
			fontFamily: 'Helvetica',
			fontSize: 18,
			bold: true,
			italic: true,
			color: '#ABCDEF',
		});
		const format = copyFormatFromElement(element);
		expect(format.textStyle).toBeDefined();
		expect(format.textStyle!.fontFamily).toBe('Helvetica');
		expect(format.textStyle!.fontSize).toBe(18);
		expect(format.textStyle!.bold).toBeTruthy();
		expect(format.textStyle!.italic).toBeTruthy();
		expect(format.textStyle!.color).toBe('#ABCDEF');
	});

	it('should return empty format for elements without shape or text properties', () => {
		const element = {
			id: 'img1',
			type: 'image',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		const format = copyFormatFromElement(element);
		expect(format.shapeStyle).toBeUndefined();
		expect(format.textStyle).toBeUndefined();
	});

	it('should copy shadow properties from shape style', () => {
		const element = makeShapeElement({
			shadowColor: '#999999',
			shadowBlur: 10,
			shadowOffsetX: 5,
			shadowOffsetY: 5,
			shadowOpacity: 0.5,
		});
		const format = copyFormatFromElement(element);
		expect(format.shapeStyle!.shadowColor).toBe('#999999');
		expect(format.shapeStyle!.shadowBlur).toBe(10);
		expect(format.shapeStyle!.shadowOffsetX).toBe(5);
		expect(format.shapeStyle!.shadowOffsetY).toBe(5);
		expect(format.shapeStyle!.shadowOpacity).toBe(0.5);
	});

	it('should copy glow properties from shape style', () => {
		const element = makeShapeElement({
			glowColor: '#FFFF00',
			glowRadius: 8,
			glowOpacity: 0.7,
		});
		const format = copyFormatFromElement(element);
		expect(format.shapeStyle!.glowColor).toBe('#FFFF00');
		expect(format.shapeStyle!.glowRadius).toBe(8);
		expect(format.shapeStyle!.glowOpacity).toBe(0.7);
	});

	it('should deep-copy fillGradientStops array', () => {
		const stops = [
			{ position: 0, color: '#000' },
			{ position: 1, color: '#FFF' },
		];
		const element = makeShapeElement({ fillGradientStops: stops });
		const format = copyFormatFromElement(element);
		expect(format.shapeStyle!.fillGradientStops).toStrictEqual(stops);
		// Verify it's a copy, not the same reference
		expect(format.shapeStyle!.fillGradientStops).not.toBe(stops);
	});

	it('should copy text underline and strikethrough properties', () => {
		const element = makeTextElement({
			underline: true,
			underlineStyle: 'single',
			strikethrough: true,
		});
		const format = copyFormatFromElement(element);
		expect(format.textStyle!.underline).toBeTruthy();
		expect(format.textStyle!.underlineStyle).toBe('single');
		expect(format.textStyle!.strikethrough).toBeTruthy();
	});
});

describe('applyFormatToElement', () => {
	it('should apply shape style to a shape element', () => {
		const target = makeShapeElement({ fillColor: '#AAAAAA' });
		const format: CopiedFormat = {
			shapeStyle: {
				fillColor: '#BBBBBB',
				strokeWidth: 5,
			},
		};
		const result = applyFormatToElement(target, format);
		// The result should have the new fill color
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor).toBe(
			'#BBBBBB',
		);
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.strokeWidth).toBe(5);
	});

	it('should apply text style to a text element', () => {
		const target = makeTextElement({ fontSize: 12 });
		const format: CopiedFormat = {
			textStyle: {
				fontSize: 36,
				bold: true,
			},
		};
		const result = applyFormatToElement(target, format);
		expect((result as { textStyle: Record<string, unknown> }).textStyle.fontSize).toBe(36);
		expect((result as { textStyle: Record<string, unknown> }).textStyle.bold).toBeTruthy();
	});

	it('should not modify the original element', () => {
		const target = makeShapeElement({ fillColor: '#AAAAAA' });
		const format: CopiedFormat = {
			shapeStyle: { fillColor: '#BBBBBB' },
		};
		applyFormatToElement(target, format);
		// Original should be unchanged
		expect((target as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor).toBe(
			'#AAAAAA',
		);
	});

	it('should return element unchanged when format has no applicable styles', () => {
		const target = {
			id: 'img1',
			type: 'image',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		const format: CopiedFormat = {
			shapeStyle: { fillColor: '#BBBBBB' },
			textStyle: { fontSize: 36 },
		};
		const result = applyFormatToElement(target, format);
		expect(result.id).toBe('img1');
	});

	it('should merge format with existing styles, preserving unoverwritten properties', () => {
		const target = makeShapeElement({
			fillColor: '#AAAAAA',
			strokeColor: '#111111',
			strokeWidth: 1,
		});
		const format: CopiedFormat = {
			shapeStyle: {
				fillColor: '#BBBBBB',
				// strokeColor and strokeWidth not specified
			},
		};
		const result = applyFormatToElement(target, format);
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor).toBe(
			'#BBBBBB',
		);
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.strokeColor).toBe(
			'#111111',
		);
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.strokeWidth).toBe(1);
	});

	it('should apply empty format without changing element', () => {
		const target = makeShapeElement({ fillColor: '#AAAAAA' });
		const format: CopiedFormat = {};
		const result = applyFormatToElement(target, format);
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor).toBe(
			'#AAAAAA',
		);
	});

	it('should not overwrite target fields with undefined source values', () => {
		// Target has a glow; source's copied format has glowColor === undefined.
		// The painter must NOT erase the target's glow with that undefined.
		const target = makeShapeElement({
			fillColor: '#AAAAAA',
			glowColor: '#FF00FF',
			glowRadius: 5,
			glowOpacity: 0.8,
		});
		const format: CopiedFormat = {
			shapeStyle: {
				fillColor: '#BBBBBB',
				glowColor: undefined,
				glowRadius: undefined,
				glowOpacity: undefined,
			},
		};
		const result = applyFormatToElement(target, format);
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor).toBe(
			'#BBBBBB',
		);
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.glowColor).toBe(
			'#FF00FF',
		);
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.glowRadius).toBe(5);
		expect((result as { shapeStyle: Record<string, unknown> }).shapeStyle.glowOpacity).toBe(0.8);
	});

	it('should not overwrite target text fields with undefined source values', () => {
		const target = makeTextElement({ fontSize: 24, bold: true, italic: true });
		const format: CopiedFormat = {
			textStyle: {
				fontSize: 36,
				bold: undefined,
				italic: undefined,
			},
		};
		const result = applyFormatToElement(target, format);
		expect((result as { textStyle: Record<string, unknown> }).textStyle.fontSize).toBe(36);
		expect((result as { textStyle: Record<string, unknown> }).textStyle.bold).toBeTruthy();
		expect((result as { textStyle: Record<string, unknown> }).textStyle.italic).toBeTruthy();
	});
});

describe('hasCopyableFormat', () => {
	it('returns false for null', () => {
		expect(hasCopyableFormat(null)).toBeFalsy();
	});

	it('returns false for undefined', () => {
		expect(hasCopyableFormat(undefined)).toBeFalsy();
	});

	it('returns true for a shape element', () => {
		expect(hasCopyableFormat(makeShapeElement())).toBeTruthy();
	});

	it('returns true for a text element', () => {
		expect(hasCopyableFormat(makeTextElement())).toBeTruthy();
	});

	it('returns true for an image (shape-style only)', () => {
		const img = {
			id: 'img1',
			type: 'image',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement;
		expect(hasCopyableFormat(img)).toBeTruthy();
	});

	it('returns false for a chart element (no shape/text properties)', () => {
		const chart = {
			id: 'c1',
			type: 'chart',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as unknown as PptxElement;
		expect(hasCopyableFormat(chart)).toBeFalsy();
	});
});
