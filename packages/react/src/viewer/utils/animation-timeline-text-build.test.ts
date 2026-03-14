import { describe, it, expect } from 'vitest';
import {
	countTextSegments,
	expandTextBuildAnimations,
	TEXT_BUILD_ID_SEP,
} from './animation-timeline-text-build';
import type { PptxNativeAnimation } from 'pptx-viewer-core';

describe('TEXT_BUILD_ID_SEP', () => {
	it('should be "::"', () => {
		expect(TEXT_BUILD_ID_SEP).toBe('::');
	});
});

describe('countTextSegments', () => {
	it('should count a single paragraph with no newlines', () => {
		const result = countTextSegments([{ text: 'hello world' }]);
		expect(result.paragraphCount).toBe(1);
		expect(result.wordCounts).toEqual([2]);
		expect(result.charCounts).toEqual([11]);
	});

	it('should count multiple paragraphs separated by newline segments', () => {
		const result = countTextSegments([
			{ text: 'first paragraph' },
			{ text: '\n' },
			{ text: 'second paragraph' },
		]);
		expect(result.paragraphCount).toBe(2);
		expect(result.wordCounts).toEqual([2, 2]);
	});

	it('should handle empty text segments', () => {
		const result = countTextSegments([]);
		expect(result.paragraphCount).toBe(1);
		expect(result.wordCounts).toEqual([0]);
		expect(result.charCounts).toEqual([0]);
	});

	it('should count three paragraphs', () => {
		const result = countTextSegments([
			{ text: 'one' },
			{ text: '\n' },
			{ text: 'two three' },
			{ text: '\n' },
			{ text: 'four five six' },
		]);
		expect(result.paragraphCount).toBe(3);
		expect(result.wordCounts).toEqual([1, 2, 3]);
		expect(result.charCounts).toEqual([3, 9, 13]);
	});

	it('should concatenate consecutive non-newline segments', () => {
		const result = countTextSegments([
			{ text: 'hello ' },
			{ text: 'world' },
		]);
		expect(result.paragraphCount).toBe(1);
		expect(result.wordCounts).toEqual([2]);
		expect(result.charCounts).toEqual([11]);
	});

	it('should handle paragraph with only whitespace', () => {
		const result = countTextSegments([
			{ text: '   ' },
		]);
		expect(result.paragraphCount).toBe(1);
		expect(result.wordCounts).toEqual([0]);
		expect(result.charCounts).toEqual([3]);
	});

	it('should handle consecutive newlines creating empty paragraphs', () => {
		const result = countTextSegments([
			{ text: 'a' },
			{ text: '\n' },
			{ text: '\n' },
			{ text: 'b' },
		]);
		expect(result.paragraphCount).toBe(3);
		expect(result.wordCounts).toEqual([1, 0, 1]);
		expect(result.charCounts).toEqual([1, 0, 1]);
	});
});

describe('expandTextBuildAnimations', () => {
	const baseAnim: PptxNativeAnimation = {
		targetId: 'shape1',
		presetClass: 'entr',
		presetId: 10,
		trigger: 'onClick',
		durationMs: 500,
		delayMs: 0,
	} as PptxNativeAnimation;

	const segmentCounts = new Map([
		['shape1', {
			paragraphCount: 3,
			wordCounts: [2, 3, 1],
			charCounts: [10, 15, 5],
		}],
	]);

	it('should pass through animations without buildType', () => {
		const result = expandTextBuildAnimations([baseAnim], segmentCounts);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(baseAnim);
	});

	it('should pass through animations with "allAtOnce" buildType', () => {
		const anim = { ...baseAnim, buildType: 'allAtOnce' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result).toHaveLength(1);
	});

	it('should expand byParagraph into one animation per paragraph', () => {
		const anim = { ...baseAnim, buildType: 'byParagraph' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result).toHaveLength(3);
		expect(result[0].targetId).toBe('shape1::p0');
		expect(result[1].targetId).toBe('shape1::p1');
		expect(result[2].targetId).toBe('shape1::p2');
	});

	it('should set first paragraph trigger to original, rest to onClick for byParagraph', () => {
		const anim = { ...baseAnim, buildType: 'byParagraph' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result[0].trigger).toBe('onClick');
		expect(result[1].trigger).toBe('onClick');
		expect(result[2].trigger).toBe('onClick');
	});

	it('should expand byWord into one animation per word across all paragraphs', () => {
		const anim = { ...baseAnim, buildType: 'byWord' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		// 2 + 3 + 1 = 6 words total
		expect(result).toHaveLength(6);
		expect(result[0].targetId).toBe('shape1::w0-0');
		expect(result[1].targetId).toBe('shape1::w0-1');
		expect(result[2].targetId).toBe('shape1::w1-0');
	});

	it('should set first word trigger to original, rest to afterPrevious for byWord', () => {
		const anim = { ...baseAnim, buildType: 'byWord' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result[0].trigger).toBe('onClick');
		expect(result[1].trigger).toBe('afterPrevious');
		expect(result[2].trigger).toBe('afterPrevious');
	});

	it('should set word duration to half of base duration (min 100ms)', () => {
		const anim = { ...baseAnim, buildType: 'byWord' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result[0].durationMs).toBe(250); // 500 / 2
	});

	it('should enforce minimum 100ms for word duration', () => {
		const anim = { ...baseAnim, durationMs: 100, buildType: 'byWord' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result[0].durationMs).toBe(100); // max(100, 100/2=50) = 100
	});

	it('should expand byChar into one animation per character', () => {
		const anim = { ...baseAnim, buildType: 'byChar' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		// 10 + 15 + 5 = 30 characters total
		expect(result).toHaveLength(30);
		expect(result[0].targetId).toBe('shape1::c0-0');
	});

	it('should set char duration to quarter of base duration (min 50ms)', () => {
		const anim = { ...baseAnim, buildType: 'byChar' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result[0].durationMs).toBe(125); // 500 / 4
	});

	it('should pass through if target has no segment counts', () => {
		const anim = {
			...baseAnim,
			targetId: 'unknownShape',
			buildType: 'byParagraph' as const,
		};
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result).toHaveLength(1);
		expect(result[0].targetId).toBe('unknownShape');
	});

	it('should pass through if targetId is empty', () => {
		const anim = {
			...baseAnim,
			targetId: '',
			buildType: 'byParagraph' as const,
		};
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result).toHaveLength(1);
	});

	it('should clear buildType on expanded animations', () => {
		const anim = { ...baseAnim, buildType: 'byParagraph' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		for (const r of result) {
			expect(r.buildType).toBeUndefined();
		}
	});

	it('should set byWord delay to 50ms for subsequent words', () => {
		const anim = { ...baseAnim, buildType: 'byWord' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		// First word uses baseAnim.delayMs (0), subsequent use 50ms
		expect(result[0].delayMs).toBe(0);
		expect(result[1].delayMs).toBe(50);
		expect(result[2].delayMs).toBe(50);
	});

	it('should set byChar delay to 20ms for subsequent characters', () => {
		const anim = { ...baseAnim, buildType: 'byChar' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		// First char uses baseAnim.delayMs (0), subsequent use 20ms
		expect(result[0].delayMs).toBe(0);
		expect(result[1].delayMs).toBe(20);
	});

	it('should enforce minimum 50ms for char duration', () => {
		const anim = { ...baseAnim, durationMs: 100, buildType: 'byChar' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result[0].durationMs).toBe(50); // max(50, 100/4=25) = 50
	});

	it('should pass through unknown buildType as original animation', () => {
		const anim = { ...baseAnim, buildType: 'unknownType' as any };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(anim);
	});

	it('should handle multiple animations in sequence with mixed build types', () => {
		const anim1 = { ...baseAnim, buildType: 'byParagraph' as const };
		const anim2 = { ...baseAnim, targetId: 'shape1', buildType: undefined };
		const result = expandTextBuildAnimations([anim1, anim2], segmentCounts);
		// 3 paragraphs from anim1 + 1 passthrough for anim2
		expect(result).toHaveLength(4);
		expect(result[3].targetId).toBe('shape1');
	});

	it('should use original delayMs for first word in byWord', () => {
		const anim = { ...baseAnim, delayMs: 200, buildType: 'byWord' as const };
		const result = expandTextBuildAnimations([anim], segmentCounts);
		expect(result[0].delayMs).toBe(200);
		expect(result[1].delayMs).toBe(50);
	});

	it('should generate correct targetIds for byChar across paragraphs', () => {
		const smallCounts = new Map([
			['shape1', {
				paragraphCount: 2,
				wordCounts: [1, 1],
				charCounts: [2, 3],
			}],
		]);
		const anim = { ...baseAnim, buildType: 'byChar' as const };
		const result = expandTextBuildAnimations([anim], smallCounts);
		// 2 + 3 = 5 characters total
		expect(result).toHaveLength(5);
		expect(result[0].targetId).toBe('shape1::c0-0');
		expect(result[1].targetId).toBe('shape1::c0-1');
		expect(result[2].targetId).toBe('shape1::c1-0');
		expect(result[3].targetId).toBe('shape1::c1-1');
		expect(result[4].targetId).toBe('shape1::c1-2');
	});
});
