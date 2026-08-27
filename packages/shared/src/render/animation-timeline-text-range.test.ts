import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import type { TextBuildSegmentCounts } from './animation-timeline-text-build';
import { expandTextRangeAnimations } from './animation-timeline-text-range';

const baseAnim: PptxNativeAnimation = {
	targetId: 'shape1',
	presetClass: 'emph',
	presetId: 1,
	trigger: 'onClick',
	durationMs: 500,
	delayMs: 0,
} as PptxNativeAnimation;

const counts: Map<string, TextBuildSegmentCounts> = new Map([
	[
		'shape1',
		{
			paragraphCount: 4,
			wordCounts: [1, 1, 1, 1],
			charCounts: [3, 4, 2, 5],
		},
	],
]);

describe('expandTextRangeAnimations - p:txEl/p:pRg (paragraph range)', () => {
	it('scopes the effect to only the named paragraphs, not the whole text box', () => {
		const anim = { ...baseAnim, textTarget: { type: 'pRg' as const, start: 1, end: 3 } };
		const result = expandTextRangeAnimations([anim], counts);
		expect(result.map((r) => r.targetId)).toStrictEqual(['shape1::p1', 'shape1::p2']);
		// Paragraphs 0 and 3 are untouched (no sub-animation emitted for them).
		expect(result.some((r) => r.targetId === 'shape1::p0')).toBeFalsy();
		expect(result.some((r) => r.targetId === 'shape1::p3')).toBeFalsy();
	});

	it('plays the scoped paragraphs simultaneously (one click, not staggered)', () => {
		const anim = { ...baseAnim, textTarget: { type: 'pRg' as const, start: 0, end: 3 } };
		const result = expandTextRangeAnimations([anim], counts);
		expect(result[0].trigger).toBe('onClick');
		expect(result[1].trigger).toBe('withPrevious');
		expect(result[2].trigger).toBe('withPrevious');
	});

	it('clamps an out-of-range end to the actual paragraph count', () => {
		const anim = { ...baseAnim, textTarget: { type: 'pRg' as const, start: 2, end: 99 } };
		const result = expandTextRangeAnimations([anim], counts);
		expect(result.map((r) => r.targetId)).toStrictEqual(['shape1::p2', 'shape1::p3']);
	});

	it('clears textTarget on the expanded sub-animations (already scoped via targetId)', () => {
		const anim = { ...baseAnim, textTarget: { type: 'pRg' as const, start: 0, end: 1 } };
		const result = expandTextRangeAnimations([anim], counts);
		expect(result[0].textTarget).toBeUndefined();
	});

	it('passes through unchanged when there is no textTarget', () => {
		const result = expandTextRangeAnimations([baseAnim], counts);
		expect(result).toStrictEqual([baseAnim]);
	});

	it('passes through unchanged when the range is empty (end <= start)', () => {
		const anim = { ...baseAnim, textTarget: { type: 'pRg' as const, start: 2, end: 2 } };
		const result = expandTextRangeAnimations([anim], counts);
		expect(result).toStrictEqual([anim]);
	});
});

describe('expandTextRangeAnimations - p:txEl/p:charRg (character range)', () => {
	it('scopes the effect to only the named flat character range, translated into paragraph + local index', () => {
		// charCounts [3, 4, 2, 5]; a range of [2, 6) spans the last char of
		// paragraph 0 (index 2) and the first three of paragraph 1 (0, 1, 2).
		const anim = { ...baseAnim, textTarget: { type: 'charRg' as const, start: 2, end: 6 } };
		const result = expandTextRangeAnimations([anim], counts);
		expect(result.map((r) => r.targetId)).toStrictEqual([
			'shape1::c0-2',
			'shape1::c1-0',
			'shape1::c1-1',
			'shape1::c1-2',
		]);
	});

	it('plays the scoped characters simultaneously (one click, not staggered)', () => {
		const anim = { ...baseAnim, textTarget: { type: 'charRg' as const, start: 0, end: 2 } };
		const result = expandTextRangeAnimations([anim], counts);
		expect(result[0].trigger).toBe('onClick');
		expect(result[1].trigger).toBe('withPrevious');
	});

	it('clamps an out-of-range end to the total character count', () => {
		const anim = { ...baseAnim, textTarget: { type: 'charRg' as const, start: 12, end: 999 } };
		const result = expandTextRangeAnimations([anim], counts);
		// Total chars = 3+4+2+5 = 14; paragraph 3 starts at offset 9, so index
		// 12 is local index 3 of paragraph 3, running through local index 4.
		expect(result.map((r) => r.targetId)).toStrictEqual(['shape1::c3-3', 'shape1::c3-4']);
	});

	it('falls back to the whole shape when segment counts are unavailable', () => {
		const anim = { ...baseAnim, textTarget: { type: 'charRg' as const, start: 0, end: 2 } };
		const result = expandTextRangeAnimations([anim], new Map());
		expect(result).toStrictEqual([anim]);
	});
});
