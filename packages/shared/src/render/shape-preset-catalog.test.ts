import { describe, expect, it } from 'vitest';

import { SHAPE_PRESET_DEFS } from './shape-preset-catalog';

describe('shape preset catalogue', () => {
	it('contains the full 30-shape catalogue with unique types', () => {
		expect(SHAPE_PRESET_DEFS).toHaveLength(30);
		const types = SHAPE_PRESET_DEFS.map((d) => d.type);
		expect(new Set(types).size).toBe(types.length);
	});

	it('keeps the top-shapes row (first 12 entries) stable', () => {
		expect(SHAPE_PRESET_DEFS.slice(0, 12).map((d) => d.type)).toStrictEqual([
			'rect',
			'roundRect',
			'ellipse',
			'cylinder',
			'rtArrow',
			'leftArrow',
			'upArrow',
			'downArrow',
			'triangle',
			'rtTriangle',
			'diamond',
			'parallelogram',
		]);
	});

	it('gives every entry a label, i18n key, and glyph', () => {
		for (const def of SHAPE_PRESET_DEFS) {
			expect(def.label.length).toBeGreaterThan(0);
			expect(def.i18nKey).toMatch(/^pptx\./);
			expect(def.glyph.length).toBeGreaterThan(0);
			expect(def.glyphClass).toBeTypeOf('string');
		}
	});

	it('carries the rotation/skew modifiers the pickers render', () => {
		const byType = new Map(SHAPE_PRESET_DEFS.map((d) => [d.type, d]));
		expect(byType.get('leftArrow')?.glyphClass).toBe('rotate-180');
		expect(byType.get('upArrow')?.glyphClass).toBe('-rotate-90');
		expect(byType.get('downArrow')?.glyphClass).toBe('rotate-90');
		expect(byType.get('parallelogram')?.glyphClass).toBe('-skew-x-12');
		expect(byType.get('star5')?.glyphClass).toBe('rotate-45');
		expect(byType.get('rect')?.glyphClass).toBe('');
	});
});
