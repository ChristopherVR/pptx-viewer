import { describe, expect, it } from 'vitest';

import { getOleIconShapes } from './ole-icon-primitives';

describe('getOleIconShapes', () => {
	it('returns the 5-primitive Excel grid', () => {
		const shapes = getOleIconShapes('excel');
		expect(shapes).toHaveLength(5);
		expect(shapes[0]).toStrictEqual({
			tag: 'rect',
			attrs: { x: 3, y: 3, width: 18, height: 18, rx: 2, 'stroke-width': 1.5, fill: 'none' },
		});
		expect(shapes[1]).toStrictEqual({
			tag: 'line',
			attrs: { x1: 3, y1: 9, x2: 21, y2: 9, 'stroke-width': 1 },
		});
	});

	it('returns rounded line caps only when requested (Word)', () => {
		const shapes = getOleIconShapes('word');
		const [, firstLine] = shapes;
		expect(firstLine).toStrictEqual({
			tag: 'line',
			attrs: { x1: 7, y1: 7, x2: 17, y2: 7, 'stroke-width': 1.5, 'stroke-linecap': 'round' },
		});
	});

	it('carries text content and italic styling for MathType', () => {
		const shapes = getOleIconShapes('mathtype');
		const label = shapes[1];
		expect(label.tag).toBe('text');
		expect(label.text).toBe('f(x)');
		expect(label.attrs).toMatchObject({ 'font-style': 'italic', 'font-size': 9 });
	});

	it('has a non-italic PDF label', () => {
		const shapes = getOleIconShapes('pdf');
		const label = shapes[1];
		expect(label.text).toBe('PDF');
		expect(label.attrs['font-style']).toBeUndefined();
	});

	it('returns a distinct 7-primitive Visio diagram', () => {
		expect(getOleIconShapes('visio')).toHaveLength(7);
	});

	it('returns the generic unknown-type glyph', () => {
		const shapes = getOleIconShapes('unknown');
		expect(shapes).toHaveLength(3);
		expect(shapes.every((s) => s.tag === 'rect' || s.tag === 'line')).toBeTruthy();
	});

	it('returns the same reference on repeated calls (stable table lookup)', () => {
		expect(getOleIconShapes('excel')).toBe(getOleIconShapes('excel'));
	});
});
