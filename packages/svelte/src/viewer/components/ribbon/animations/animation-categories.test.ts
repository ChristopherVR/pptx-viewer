import { describe, expect, it } from 'vitest';

import { ANIMATION_CATEGORIES } from './animation-categories';

describe('animationCategories', () => {
	it('lists Entrance, Emphasis, Exit in that order with non-empty preset catalogues', () => {
		expect(ANIMATION_CATEGORIES.map((c) => c.group)).toStrictEqual([
			'entrance',
			'emphasis',
			'exit',
		]);
		for (const category of ANIMATION_CATEGORIES) {
			expect(category.presets.length).toBeGreaterThan(0);
		}
	});

	it('every category label key matches its group', () => {
		for (const category of ANIMATION_CATEGORIES) {
			expect(category.labelKey).toBe(`pptx.animation.${category.group}`);
		}
	});

	it('preset catalogues do not overlap between categories', () => {
		const all = ANIMATION_CATEGORIES.flatMap((c) => c.presets);
		expect(new Set(all).size).toBe(all.length);
	});
});
