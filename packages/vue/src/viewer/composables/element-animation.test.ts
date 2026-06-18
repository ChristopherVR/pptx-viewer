import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyAnimationPreset, removeElementAnimation } from './element-animation';

describe('element-animation', () => {
	it('appends a new entry (defaults: 500ms, on-click, ordered) for a fresh element', () => {
		const result = applyAnimationPreset([], 'el1', 'entrance', 'fadeIn');
		expect(result).toStrictEqual([
			{ elementId: 'el1', entrance: 'fadeIn', durationMs: 500, order: 0, trigger: 'onClick' },
		]);
	});

	it('orders a second element after the first', () => {
		const seeded: PptxElementAnimation[] = [{ elementId: 'el1', entrance: 'fadeIn' }];
		const result = applyAnimationPreset(seeded, 'el2', 'exit', 'fadeOut');
		expect(result[1].order).toBe(1);
		expect(result[1].exit).toBe('fadeOut');
	});

	it('updates the matching group on an existing entry, preserving others', () => {
		const seeded: PptxElementAnimation[] = [
			{ elementId: 'el1', entrance: 'fadeIn', durationMs: 500, order: 0 },
		];
		const result = applyAnimationPreset(seeded, 'el1', 'emphasis', 'pulse');
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ entrance: 'fadeIn', emphasis: 'pulse', durationMs: 500 });
	});

	it('removes only the matching element entry', () => {
		const seeded: PptxElementAnimation[] = [
			{ elementId: 'el1', entrance: 'fadeIn' },
			{ elementId: 'el2', exit: 'fadeOut' },
		];
		expect(removeElementAnimation(seeded, 'el1')).toStrictEqual([
			{ elementId: 'el2', exit: 'fadeOut' },
		]);
	});
});
