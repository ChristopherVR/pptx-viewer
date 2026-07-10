import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { cssPropertyName, mergeStyles, styleToString } from './css';
import { getContainerStyle, getShapeFillStrokeStyle } from './element-style';
import { getTextBlockStyle } from './text-style';

describe('cssPropertyName', () => {
	it('kebab-cases camelCase properties', () => {
		expect(cssPropertyName('zIndex')).toBe('z-index');
		expect(cssPropertyName('backgroundColor')).toBe('background-color');
	});

	it('prefixes vendor properties and passes custom properties through', () => {
		expect(cssPropertyName('WebkitBoxReflect')).toBe('-webkit-box-reflect');
		expect(cssPropertyName('--pptx-primary')).toBe('--pptx-primary');
	});
});

describe('styleToString', () => {
	it('serialises maps and skips empty values', () => {
		expect(styleToString({ left: '5px', zIndex: 3, filter: '' })).toBe('left: 5px; z-index: 3');
		expect(styleToString(undefined)).toBe('');
	});

	it('merges styles with later maps winning', () => {
		expect(mergeStyles({ color: 'red', left: '1px' }, { color: 'blue' })).toStrictEqual({
			color: 'blue',
			left: '1px',
		});
	});
});

describe('element styles (shared render helpers)', () => {
	const base = { id: 'e1', x: 5, y: 6, width: 100, height: 40 };

	it('positions elements absolutely with size and z-index', () => {
		const style = getContainerStyle({ ...base, type: 'text', text: 'hi' } as PptxElement, 7);
		expect(style.position).toBe('absolute');
		expect(style.left).toBe('5px');
		expect(style.top).toBe('6px');
		expect(style.width).toBe('100px');
		expect(style.zIndex).toBe(7);
	});

	it('renders ellipse shapes with a full border radius', () => {
		const style = getShapeFillStrokeStyle({
			...base,
			type: 'shape',
			shapeType: 'ellipse',
			shapeStyle: { fillColor: '#ff0000' },
		} as PptxElement);
		expect(style.borderRadius).toBe('9999px');
		expect(style.backgroundColor).toBe('#ff0000');
	});

	it('renders stroke borders from the shape style', () => {
		const style = getShapeFillStrokeStyle({
			...base,
			type: 'shape',
			shapeType: 'rect',
			shapeStyle: { strokeColor: '#00ff00', strokeWidth: 2 },
		} as PptxElement);
		expect(style.border).toBe('2px solid #00ff00');
	});

	it('builds flex text-block styles with alignment', () => {
		const style = getTextBlockStyle({
			...base,
			type: 'text',
			text: 'hi',
			textStyle: { color: '#123456', fontSize: 20, align: 'center', vAlign: 'middle' },
		} as PptxElement);
		expect(style.color).toBe('#123456');
		expect(style.fontSize).toBe('20px');
		expect(style.textAlign).toBe('center');
		expect(style.justifyContent).toBe('center');
	});
});
