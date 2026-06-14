import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getContainerStyle, getShapeFillStrokeStyle, getTextBlockStyle } from './element-style';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

describe('getContainerStyle', () => {
	it('positions and sizes the element absolutely', () => {
		const style = getContainerStyle(shape(), 3);
		expect(style.position).toBe('absolute');
		expect(style.left).toBe('10px');
		expect(style.top).toBe('20px');
		expect(style.width).toBe('100px');
		expect(style.height).toBe('50px');
		expect(style.zIndex).toBe(3);
	});

	it('applies rotation and flip transforms', () => {
		const style = getContainerStyle(shape({ rotation: 45, flipHorizontal: true }), 0);
		expect(style.transform).toContain('rotate(45deg)');
		expect(style.transform).toContain('scaleX(-1)');
	});
});

describe('getShapeFillStrokeStyle', () => {
	it('renders solid fill and stroke', () => {
		const style = getShapeFillStrokeStyle(
			shape({ shapeStyle: { fillColor: '#ff0000', strokeColor: '#000', strokeWidth: 2 } }),
		);
		expect(style.backgroundColor).toBe('#ff0000');
		expect(style.border).toBe('2px solid #000');
	});

	it('rounds ellipse geometry', () => {
		const style = getShapeFillStrokeStyle(shape({ shapeType: 'ellipse' }));
		expect(style.borderRadius).toBe('50%');
	});
});

describe('getTextBlockStyle', () => {
	it('maps font + alignment from textStyle', () => {
		const style = getTextBlockStyle(
			shape({ textStyle: { fontSize: 18, bold: true, align: 'center', vAlign: 'middle' } }),
		);
		expect(style.fontSize).toBe('18pt');
		expect(style.fontWeight).toBe('bold');
		expect(style.textAlign).toBe('center');
		expect(style.justifyContent).toBe('center');
	});
});
