import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	animationTypeLabel,
	buildTimelineBarData,
	reorderAnimationsByIndex,
	sortAnimations,
	timelineLabel,
} from './animation-panel-helpers';

function anim(
	overrides: Partial<PptxElementAnimation> & { elementId: string },
): PptxElementAnimation {
	return { durationMs: 500, trigger: 'onClick', ...overrides };
}

describe('sortAnimations', () => {
	it('orders by the order field without mutating the input', () => {
		const input = [anim({ elementId: 'b', order: 1 }), anim({ elementId: 'a', order: 0 })];
		const sorted = sortAnimations(input);
		expect(sorted.map((a) => a.elementId)).toStrictEqual(['a', 'b']);
		expect(input[0].elementId).toBe('b');
	});
});

describe('buildTimelineBarData', () => {
	it('returns empty for no animations', () => {
		expect(buildTimelineBarData([])).toStrictEqual([]);
	});

	it('computes left/width percentages against the longest end time (React maths)', () => {
		const bars = buildTimelineBarData([
			anim({ elementId: 'a', order: 0, delayMs: 0, durationMs: 500 }),
			anim({ elementId: 'b', order: 1, delayMs: 500, durationMs: 500 }),
		]);
		expect(bars[0].leftPercent).toBe(0);
		expect(bars[0].widthPercent).toBe(50);
		expect(bars[1].leftPercent).toBe(50);
		expect(bars[1].widthPercent).toBe(50);
	});

	it('defaults duration to 500ms and delay to 0', () => {
		const bars = buildTimelineBarData([
			{ elementId: 'a', entrance: 'fadeIn' } as PptxElementAnimation,
		]);
		expect(bars[0].leftPercent).toBe(0);
		expect(bars[0].widthPercent).toBe(100);
	});
});

describe('timelineLabel', () => {
	const elements = [
		{ type: 'text', id: 't1', x: 0, y: 0, width: 1, height: 1, text: 'Hello' } as PptxElement,
		{ type: 'image', id: 'i1', x: 0, y: 0, width: 1, height: 1 } as PptxElement,
	];

	it('uses the element text when present', () => {
		expect(timelineLabel(anim({ elementId: 't1' }), elements)).toBe('Hello');
	});

	it('falls back to the type label, then to a truncated id', () => {
		expect(timelineLabel(anim({ elementId: 'i1' }), elements)).toBe('Image');
		expect(timelineLabel(anim({ elementId: 'missing-element-id' }), elements)).toBe('missing-');
	});
});

describe('animationTypeLabel', () => {
	it('prefers entrance, then emphasis, then exit, then custom', () => {
		expect(animationTypeLabel(anim({ elementId: 'a', entrance: 'fadeIn' }))).toBe('fadeIn');
		expect(animationTypeLabel(anim({ elementId: 'a', emphasis: 'pulse' }))).toBe('pulse');
		expect(animationTypeLabel(anim({ elementId: 'a', exit: 'fadeOut' }))).toBe('fadeOut');
		expect(animationTypeLabel(anim({ elementId: 'a' }))).toBe('custom');
	});
});

describe('reorderAnimationsByIndex', () => {
	const three = [
		anim({ elementId: 'a', order: 0 }),
		anim({ elementId: 'b', order: 1 }),
		anim({ elementId: 'c', order: 2 }),
	];

	it('moves an entry and re-normalises order fields', () => {
		const next = reorderAnimationsByIndex(three, 0, 2);
		expect(next.map((a) => a.elementId)).toStrictEqual(['b', 'c', 'a']);
		expect(next.map((a) => a.order)).toStrictEqual([0, 1, 2]);
	});

	it('returns a copy when the source index is out of range', () => {
		const next = reorderAnimationsByIndex(three, 5, 0);
		expect(next.map((a) => a.elementId)).toStrictEqual(['a', 'b', 'c']);
	});
});
