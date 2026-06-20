/**
 * animation-author-helpers.test.ts: Vitest unit tests for the pure authoring
 * helpers in animation-author-helpers.ts.
 *
 * No TestBed: these are plain function tests that run in a Node/happy-dom env.
 */

import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	animationFor,
	hasAnimation,
	removeAnimation,
	reorderAnimationDown,
	reorderAnimationUp,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
	setDelay,
	setDirection,
	setDuration,
	setRepeatCount,
	setRepeatMode,
	setSequence,
	setTimingCurve,
	setTrigger,
	setTriggerShapeId,
	showDirectionPicker,
} from './animation-author-helpers';

// ==========================================================================
// Fixtures
// ==========================================================================

const BASE: PptxElementAnimation = {
	elementId: 'el-1',
	entrance: 'fadeIn',
	durationMs: 500,
	order: 0,
	trigger: 'onClick',
};

const ANIMS: readonly PptxElementAnimation[] = [
	BASE,
	{ elementId: 'el-2', emphasis: 'spin', durationMs: 800, order: 1, trigger: 'withPrevious' },
];

// ==========================================================================
// animationFor
// ==========================================================================

describe('animationFor', () => {
	it('returns the matching entry', () => {
		expect(animationFor(ANIMS, 'el-1')).toStrictEqual(BASE);
	});

	it('returns undefined when not found', () => {
		expect(animationFor(ANIMS, 'missing')).toBeUndefined();
	});

	it('works on an empty array', () => {
		expect(animationFor([], 'el-1')).toBeUndefined();
	});
});

// ==========================================================================
// hasAnimation
// ==========================================================================

describe('hasAnimation', () => {
	it('returns true when the element has an entrance', () => {
		expect(hasAnimation(ANIMS, 'el-1')).toBeTruthy();
	});

	it('returns true when the element has an emphasis', () => {
		expect(hasAnimation(ANIMS, 'el-2')).toBeTruthy();
	});

	it('returns false when the element is absent', () => {
		expect(hasAnimation(ANIMS, 'unknown')).toBeFalsy();
	});

	it('returns false when all three effect fields are undefined', () => {
		const noEffect: PptxElementAnimation = { elementId: 'el-3', order: 0, trigger: 'onClick' };
		expect(hasAnimation([noEffect], 'el-3')).toBeFalsy();
	});
});

// ==========================================================================
// showDirectionPicker
// ==========================================================================

describe('showDirectionPicker', () => {
	it('returns true for flyIn entrance', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-1', entrance: 'flyIn', order: 0, trigger: 'onClick' },
		];
		expect(showDirectionPicker(anims, 'el-1')).toBeTruthy();
	});

	it('returns true for flyOut exit', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-1', exit: 'flyOut', order: 0, trigger: 'onClick' },
		];
		expect(showDirectionPicker(anims, 'el-1')).toBeTruthy();
	});

	it('returns true for wipeIn entrance', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-1', entrance: 'wipeIn', order: 0, trigger: 'onClick' },
		];
		expect(showDirectionPicker(anims, 'el-1')).toBeTruthy();
	});

	it('returns false for fadeIn (non-directional)', () => {
		expect(showDirectionPicker(ANIMS, 'el-1')).toBeFalsy();
	});

	it('returns false when element has no entry', () => {
		expect(showDirectionPicker(ANIMS, 'unknown')).toBeFalsy();
	});
});

// ==========================================================================
// setAnimationEntrance
// ==========================================================================

describe('setAnimationEntrance', () => {
	it('updates the entrance of an existing entry', () => {
		const result = setAnimationEntrance(ANIMS, 'el-1', 'flyIn');
		expect(animationFor(result, 'el-1')?.entrance).toBe('flyIn');
	});

	it('creates a new entry when none exists', () => {
		const result = setAnimationEntrance([], 'new-el', 'zoomIn');
		expect(result).toHaveLength(1);
		expect(result[0].entrance).toBe('zoomIn');
		expect(result[0].elementId).toBe('new-el');
	});

	it('removes the entry when preset is "none" and all effects are empty', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-1', entrance: 'fadeIn', order: 0, trigger: 'onClick' },
		];
		const result = setAnimationEntrance(anims, 'el-1', 'none');
		expect(result).toHaveLength(0);
	});

	it('keeps the entry when exit still set after clearing entrance', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-1', entrance: 'fadeIn', exit: 'fadeOut', order: 0, trigger: 'onClick' },
		];
		const result = setAnimationEntrance(anims, 'el-1', 'none');
		expect(result).toHaveLength(1);
		expect(result[0].entrance).toBeUndefined();
		expect(result[0].exit).toBe('fadeOut');
	});

	it('does not mutate the original array', () => {
		const original = [...ANIMS];
		setAnimationEntrance(ANIMS, 'el-1', 'flyIn');
		expect(ANIMS).toStrictEqual(original);
	});
});

// ==========================================================================
// setAnimationExit
// ==========================================================================

describe('setAnimationExit', () => {
	it('sets an exit on an existing entry', () => {
		const result = setAnimationExit(ANIMS, 'el-1', 'fadeOut');
		expect(animationFor(result, 'el-1')?.exit).toBe('fadeOut');
		// entrance must still be present
		expect(animationFor(result, 'el-1')?.entrance).toBe('fadeIn');
	});

	it('removes the entry when only exit was set and it is cleared', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-1', exit: 'fadeOut', order: 0, trigger: 'onClick' },
		];
		expect(setAnimationExit(anims, 'el-1', 'none')).toHaveLength(0);
	});
});

// ==========================================================================
// setAnimationEmphasis
// ==========================================================================

describe('setAnimationEmphasis', () => {
	it('sets an emphasis on an existing entry', () => {
		const result = setAnimationEmphasis(ANIMS, 'el-1', 'pulse');
		expect(animationFor(result, 'el-1')?.emphasis).toBe('pulse');
	});

	it('removes the entry when clearing the only emphasis', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-2', emphasis: 'spin', order: 0, trigger: 'onClick' },
		];
		expect(setAnimationEmphasis(anims, 'el-2', undefined)).toHaveLength(0);
	});
});

// ==========================================================================
// setTrigger
// ==========================================================================

describe('setTrigger', () => {
	it('updates the trigger', () => {
		const result = setTrigger(ANIMS, 'el-1', 'afterPrevious');
		expect(animationFor(result, 'el-1')?.trigger).toBe('afterPrevious');
	});

	it('clears triggerShapeId when switching away from onShapeClick', () => {
		const anims: PptxElementAnimation[] = [
			{
				elementId: 'el-1',
				entrance: 'fadeIn',
				trigger: 'onShapeClick',
				triggerShapeId: 'shape-9',
				order: 0,
			},
		];
		const result = setTrigger(anims, 'el-1', 'onClick');
		expect(animationFor(result, 'el-1')?.triggerShapeId).toBeUndefined();
	});

	it('preserves triggerShapeId when setting onShapeClick', () => {
		const anims: PptxElementAnimation[] = [
			{
				elementId: 'el-1',
				entrance: 'fadeIn',
				trigger: 'onShapeClick',
				triggerShapeId: 'shape-9',
				order: 0,
			},
		];
		const result = setTrigger(anims, 'el-1', 'onShapeClick');
		expect(animationFor(result, 'el-1')?.triggerShapeId).toBe('shape-9');
	});
});

// ==========================================================================
// setTriggerShapeId
// ==========================================================================

describe('setTriggerShapeId', () => {
	it('sets the triggerShapeId', () => {
		const result = setTriggerShapeId(ANIMS, 'el-1', 'shape-5');
		expect(animationFor(result, 'el-1')?.triggerShapeId).toBe('shape-5');
	});

	it('clears the triggerShapeId when passing undefined', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-1', entrance: 'fadeIn', triggerShapeId: 'shape-5', order: 0 },
		];
		const result = setTriggerShapeId(anims, 'el-1', undefined);
		expect(animationFor(result, 'el-1')?.triggerShapeId).toBeUndefined();
	});
});

// ==========================================================================
// setDuration
// ==========================================================================

describe('setDuration', () => {
	it('sets a valid duration', () => {
		const result = setDuration(ANIMS, 'el-1', 1200);
		expect(animationFor(result, 'el-1')?.durationMs).toBe(1200);
	});

	it('clamps below minimum to 100', () => {
		const result = setDuration(ANIMS, 'el-1', 0);
		expect(animationFor(result, 'el-1')?.durationMs).toBe(100);
	});

	it('clamps above maximum to 10000', () => {
		const result = setDuration(ANIMS, 'el-1', 99999);
		expect(animationFor(result, 'el-1')?.durationMs).toBe(10000);
	});
});

// ==========================================================================
// setDelay
// ==========================================================================

describe('setDelay', () => {
	it('sets the delay', () => {
		const result = setDelay(ANIMS, 'el-1', 300);
		expect(animationFor(result, 'el-1')?.delayMs).toBe(300);
	});

	it('clamps below 0 to 0', () => {
		const result = setDelay(ANIMS, 'el-1', -50);
		expect(animationFor(result, 'el-1')?.delayMs).toBe(0);
	});

	it('clamps above 10000 to 10000', () => {
		const result = setDelay(ANIMS, 'el-1', 20000);
		expect(animationFor(result, 'el-1')?.delayMs).toBe(10000);
	});
});

// ==========================================================================
// setTimingCurve
// ==========================================================================

describe('setTimingCurve', () => {
	it('sets the timing curve', () => {
		const result = setTimingCurve(ANIMS, 'el-1', 'ease-in');
		expect(animationFor(result, 'el-1')?.timingCurve).toBe('ease-in');
	});
});

// ==========================================================================
// setDirection
// ==========================================================================

describe('setDirection', () => {
	it('sets the direction', () => {
		const result = setDirection(ANIMS, 'el-1', 'fromLeft');
		expect(animationFor(result, 'el-1')?.direction).toBe('fromLeft');
	});
});

// ==========================================================================
// setSequence
// ==========================================================================

describe('setSequence', () => {
	it('sets the sequence', () => {
		const result = setSequence(ANIMS, 'el-1', 'byParagraph');
		expect(animationFor(result, 'el-1')?.sequence).toBe('byParagraph');
	});
});

// ==========================================================================
// setRepeatCount
// ==========================================================================

describe('setRepeatCount', () => {
	it('sets a valid repeat count', () => {
		const result = setRepeatCount(ANIMS, 'el-1', 3);
		expect(animationFor(result, 'el-1')?.repeatCount).toBe(3);
	});

	it('clamps below 1 to 1', () => {
		const result = setRepeatCount(ANIMS, 'el-1', 0);
		expect(animationFor(result, 'el-1')?.repeatCount).toBe(1);
	});

	it('clamps above 100 to 100', () => {
		const result = setRepeatCount(ANIMS, 'el-1', 999);
		expect(animationFor(result, 'el-1')?.repeatCount).toBe(100);
	});
});

// ==========================================================================
// setRepeatMode
// ==========================================================================

describe('setRepeatMode', () => {
	it('sets untilNextClick', () => {
		const result = setRepeatMode(ANIMS, 'el-1', 'untilNextClick');
		expect(animationFor(result, 'el-1')?.repeatMode).toBe('untilNextClick');
	});

	it('clears the mode when "none" is passed', () => {
		const anims: PptxElementAnimation[] = [
			{
				elementId: 'el-1',
				entrance: 'fadeIn',
				repeatMode: 'untilEndOfSlide',
				order: 0,
				trigger: 'onClick',
			},
		];
		const result = setRepeatMode(anims, 'el-1', 'none');
		expect(animationFor(result, 'el-1')?.repeatMode).toBeUndefined();
	});
});

// ==========================================================================
// removeAnimation
// ==========================================================================

describe('removeAnimation', () => {
	it('removes the matching entry', () => {
		const result = removeAnimation(ANIMS, 'el-1');
		expect(result.find((a) => a.elementId === 'el-1')).toBeUndefined();
	});

	it('re-indexes order after removal', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-a', entrance: 'fadeIn', order: 0, trigger: 'onClick' },
			{ elementId: 'el-b', entrance: 'fadeIn', order: 1, trigger: 'onClick' },
			{ elementId: 'el-c', entrance: 'fadeIn', order: 2, trigger: 'onClick' },
		];
		const result = removeAnimation(anims, 'el-b');
		expect(result.map((a) => a.order)).toStrictEqual([0, 1]);
		expect(result.map((a) => a.elementId)).toStrictEqual(['el-a', 'el-c']);
	});

	it('returns a copy when the entry does not exist', () => {
		const result = removeAnimation(ANIMS, 'unknown');
		expect(result).toHaveLength(ANIMS.length);
	});

	it('does not mutate the input', () => {
		const snap = [...ANIMS];
		removeAnimation(ANIMS, 'el-1');
		expect(ANIMS).toStrictEqual(snap);
	});
});

// ==========================================================================
// reorderAnimationUp / reorderAnimationDown
// ==========================================================================

describe('reorderAnimationUp', () => {
	it('moves an entry earlier by one position', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-a', entrance: 'fadeIn', order: 0, trigger: 'onClick' },
			{ elementId: 'el-b', entrance: 'fadeIn', order: 1, trigger: 'onClick' },
			{ elementId: 'el-c', entrance: 'fadeIn', order: 2, trigger: 'onClick' },
		];
		const result = reorderAnimationUp(anims, 'el-b');
		const sorted = [...result].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		expect(sorted.map((a) => a.elementId)).toStrictEqual(['el-b', 'el-a', 'el-c']);
	});

	it('no-ops when the entry is already first', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-a', entrance: 'fadeIn', order: 0, trigger: 'onClick' },
			{ elementId: 'el-b', entrance: 'fadeIn', order: 1, trigger: 'onClick' },
		];
		const result = reorderAnimationUp(anims, 'el-a');
		const sorted = [...result].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		expect(sorted.map((a) => a.elementId)).toStrictEqual(['el-a', 'el-b']);
	});

	it('no-ops when elementId is not found', () => {
		const result = reorderAnimationUp(ANIMS, 'ghost');
		expect(result).toHaveLength(ANIMS.length);
	});
});

describe('reorderAnimationDown', () => {
	it('moves an entry later by one position', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-a', entrance: 'fadeIn', order: 0, trigger: 'onClick' },
			{ elementId: 'el-b', entrance: 'fadeIn', order: 1, trigger: 'onClick' },
			{ elementId: 'el-c', entrance: 'fadeIn', order: 2, trigger: 'onClick' },
		];
		const result = reorderAnimationDown(anims, 'el-b');
		const sorted = [...result].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		expect(sorted.map((a) => a.elementId)).toStrictEqual(['el-a', 'el-c', 'el-b']);
	});

	it('no-ops when the entry is already last', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-a', entrance: 'fadeIn', order: 0, trigger: 'onClick' },
			{ elementId: 'el-b', entrance: 'fadeIn', order: 1, trigger: 'onClick' },
		];
		const result = reorderAnimationDown(anims, 'el-b');
		const sorted = [...result].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		expect(sorted.map((a) => a.elementId)).toStrictEqual(['el-a', 'el-b']);
	});
});

// ==========================================================================
// Immutability: setters never mutate the original
// ==========================================================================

describe('immutability', () => {
	it('setters do not mutate the source array', () => {
		const source: PptxElementAnimation[] = [
			{ elementId: 'el-1', entrance: 'fadeIn', order: 0, trigger: 'onClick' },
		];
		const snapshot = JSON.stringify(source);

		setAnimationEntrance(source, 'el-1', 'flyIn');
		setAnimationExit(source, 'el-1', 'fadeOut');
		setAnimationEmphasis(source, 'el-1', 'spin');
		setTrigger(source, 'el-1', 'afterPrevious');
		setDuration(source, 'el-1', 999);
		setDelay(source, 'el-1', 200);
		setDirection(source, 'el-1', 'fromLeft');
		setSequence(source, 'el-1', 'byWord');
		setRepeatCount(source, 'el-1', 5);
		setRepeatMode(source, 'el-1', 'untilNextClick');
		removeAnimation(source, 'el-1');

		expect(JSON.stringify(source)).toBe(snapshot);
	});
});

// ==========================================================================
// upsert: new entry defaults
// ==========================================================================

describe('upsert defaults for new entries', () => {
	it('sets durationMs to 500 for a brand-new entry', () => {
		const result = setAnimationEntrance([], 'el-new', 'fadeIn');
		expect(result[0].durationMs).toBe(500);
	});

	it('sets trigger to onClick for a brand-new entry', () => {
		const result = setAnimationEntrance([], 'el-new', 'fadeIn');
		expect(result[0].trigger).toBe('onClick');
	});

	it('sets order equal to the current length of the array', () => {
		const anims: PptxElementAnimation[] = [
			{ elementId: 'el-1', entrance: 'fadeIn', order: 0, trigger: 'onClick' },
		];
		const result = setAnimationEntrance(anims, 'el-new', 'zoomIn');
		expect(result[result.length - 1].order).toBe(1);
	});
});
