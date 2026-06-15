import { describe, expect, it } from 'vitest';

import { newShapeElement, newTextElement } from './editor-insert';

describe('newTextElement', () => {
	it('returns type "text"', () => {
		expect(newTextElement().type).toBe('text');
	});

	it('leaves id as empty string', () => {
		expect(newTextElement().id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newTextElement();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses sensible default position when no args given', () => {
		const el = newTextElement();
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});

	it('accepts custom x/y overrides', () => {
		const el = newTextElement(250, 300);
		expect(el.x).toBe(250);
		expect(el.y).toBe(300);
	});

	it('carries non-empty text content', () => {
		const el = newTextElement();
		expect(el.type).toBe('text');
		// Narrow to access text-specific field.
		if (el.type === 'text') {
			expect(el.text).toBeTypeOf('string');
			expect((el.text ?? '').length).toBeGreaterThan(0);
		}
	});
});

describe('newShapeElement', () => {
	it('returns type "shape"', () => {
		expect(newShapeElement('rect').type).toBe('shape');
	});

	it('leaves id as empty string', () => {
		expect(newShapeElement('ellipse').id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newShapeElement('rect');
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('preserves the shapeType for rect', () => {
		const el = newShapeElement('rect');
		if (el.type === 'shape') {
			expect(el.shapeType).toBe('rect');
		}
	});

	it('preserves the shapeType for ellipse', () => {
		const el = newShapeElement('ellipse');
		if (el.type === 'shape') {
			expect(el.shapeType).toBe('ellipse');
		}
	});

	it('preserves the shapeType for line', () => {
		const el = newShapeElement('line');
		if (el.type === 'shape') {
			expect(el.shapeType).toBe('line');
		}
	});

	it('accepts custom x/y overrides', () => {
		const el = newShapeElement('rect', 400, 200);
		expect(el.x).toBe(400);
		expect(el.y).toBe(200);
	});

	it('uses sensible default position when no args given', () => {
		const el = newShapeElement('ellipse');
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});
});
