import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import {
	hasShowSlideAfter,
	nextShowSlideIndex,
	previousShowSlideIndex,
	resolveShowSlideIndexes,
} from 'pptx-viewer-shared';
import { describe, it, expect } from 'vitest';

import { isClickAdvanceBlocked } from './useSlideNavigation';

// ---------------------------------------------------------------------------
// Pure logic extracted from useSlideNavigation for testing.
//
// `computeNextSlidePosition` below calls the SAME shared show-order helpers the
// hook calls, so this file cannot pass while the shipped rule regresses. It
// used to re-implement the index arithmetic locally, which meant the tests kept
// passing while four bindings presented hidden slides.
// ---------------------------------------------------------------------------

function slideWithTransition(transition?: Partial<PptxSlideTransition>): PptxSlide {
	return {
		id: 's1',
		rId: 'rId1',
		elements: [],
		...(transition ? { transition: transition as PptxSlideTransition } : {}),
	} as PptxSlide;
}

/**
 * Determine available slide indexes (visible or all).
 */
function resolveAvailableIndexes(visibleSlideIndexes: number[], totalSlideCount: number): number[] {
	return visibleSlideIndexes.length > 0
		? visibleSlideIndexes
		: Array.from({ length: totalSlideCount }, (_, i) => i);
}

/** Build a deck of `hidden` flags, matching the shape the show order reads. */
function deck(...hidden: boolean[]): PptxSlide[] {
	return hidden.map(
		(isHidden, index) =>
			({
				id: `s${index + 1}`,
				rId: `rId${index + 1}`,
				elements: [],
				hidden: isHidden,
			}) as PptxSlide,
	);
}

/**
 * Compute the next slide position given the current state.
 * Returns the resolved slide index, or null if navigation should be skipped.
 */
function computeNextSlidePosition(
	availableSlideIndexes: number[],
	presentationSlideIndex: number,
	direction: 1 | -1,
	options: {
		loopContinuously?: boolean;
		rehearsing?: boolean;
	} = {},
): {
	nextSlideIndex: number | null;
	endRehearsal: boolean;
} {
	if (availableSlideIndexes.length === 0) {
		return { nextSlideIndex: null, endRehearsal: false };
	}

	const pastLastSlide =
		direction === 1 && !hasShowSlideAfter(presentationSlideIndex, availableSlideIndexes);

	// Rehearsal: advancing past last slide ends rehearsal
	if (options.rehearsing && pastLastSlide) {
		return { nextSlideIndex: null, endRehearsal: true };
	}

	const resolved =
		direction === 1
			? nextShowSlideIndex(presentationSlideIndex, availableSlideIndexes, {
					loop: Boolean(options.loopContinuously) && !options.rehearsing,
				})
			: previousShowSlideIndex(presentationSlideIndex, availableSlideIndexes);

	if (resolved === undefined || resolved === presentationSlideIndex) {
		return { nextSlideIndex: null, endRehearsal: false };
	}

	return { nextSlideIndex: resolved, endRehearsal: false };
}

/**
 * Validate whether direct navigation to a target index is valid.
 */
function isValidNavigationTarget(
	targetIndex: number,
	slidesLength: number,
	currentIndex: number,
): boolean {
	return targetIndex >= 0 && targetIndex < slidesLength && targetIndex !== currentIndex;
}

/**
 * Determine if auto-advance should be scheduled.
 */
function shouldScheduleAutoAdvance(advanceAfterMs: number | undefined | null): boolean {
	return (
		typeof advanceAfterMs === 'number' && Number.isFinite(advanceAfterMs) && advanceAfterMs >= 0
	);
}

// ---------------------------------------------------------------------------
// Tests: resolveAvailableIndexes
// ---------------------------------------------------------------------------

describe('resolveAvailableIndexes', () => {
	it('should return visible indexes when provided', () => {
		const result = resolveAvailableIndexes([0, 2, 4], 5);
		expect(result).toStrictEqual([0, 2, 4]);
	});

	it('should return all indexes when visible is empty', () => {
		const result = resolveAvailableIndexes([], 5);
		expect(result).toStrictEqual([0, 1, 2, 3, 4]);
	});

	it('should return empty for zero slides', () => {
		const result = resolveAvailableIndexes([], 0);
		expect(result).toStrictEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Tests: computeNextSlidePosition
// ---------------------------------------------------------------------------

describe('computeNextSlidePosition', () => {
	const allIndexes = [0, 1, 2, 3, 4];

	it('should advance to next slide', () => {
		const result = computeNextSlidePosition(allIndexes, 2, 1);
		expect(result.nextSlideIndex).toBe(3);
		expect(result.endRehearsal).toBeFalsy();
	});

	it('should go to previous slide', () => {
		const result = computeNextSlidePosition(allIndexes, 2, -1);
		expect(result.nextSlideIndex).toBe(1);
		expect(result.endRehearsal).toBeFalsy();
	});

	it('should clamp at the last slide when no loop', () => {
		const result = computeNextSlidePosition(allIndexes, 4, 1);
		expect(result.nextSlideIndex).toBeNull(); // same as current, so null
	});

	it('should clamp at the first slide going backward', () => {
		const result = computeNextSlidePosition(allIndexes, 0, -1);
		expect(result.nextSlideIndex).toBeNull(); // same as current
	});

	it('should wrap around with loopContinuously', () => {
		const result = computeNextSlidePosition(allIndexes, 4, 1, {
			loopContinuously: true,
		});
		expect(result.nextSlideIndex).toBe(0);
	});

	it('should not wrap when direction is backward even with loop', () => {
		const result = computeNextSlidePosition(allIndexes, 0, -1, {
			loopContinuously: true,
		});
		expect(result.nextSlideIndex).toBeNull();
	});

	it('should end rehearsal when advancing past last slide', () => {
		const result = computeNextSlidePosition(allIndexes, 4, 1, {
			rehearsing: true,
		});
		expect(result.nextSlideIndex).toBeNull();
		expect(result.endRehearsal).toBeTruthy();
	});

	it('should not end rehearsal when going backward', () => {
		const result = computeNextSlidePosition(allIndexes, 0, -1, {
			rehearsing: true,
		});
		expect(result.endRehearsal).toBeFalsy();
	});

	it('should return null for empty available indexes', () => {
		const result = computeNextSlidePosition([], 0, 1);
		expect(result.nextSlideIndex).toBeNull();
	});

	it('should handle non-sequential visible indexes', () => {
		const visible = [0, 3, 7]; // slides 0, 3, 7 are visible
		const result = computeNextSlidePosition(visible, 3, 1);
		expect(result.nextSlideIndex).toBe(7);
	});

	it('should step FORWARD out of a slide the show excludes', () => {
		const visible = [0, 3, 7];
		// Slide 5 is hidden and was reached by typing "6" + Enter. Forward must
		// escape to the next slide the show actually visits, not jump backward
		// to the start (which the old position-0 normalisation did).
		const result = computeNextSlidePosition(visible, 5, 1);
		expect(result.nextSlideIndex).toBe(7);
	});

	it('should step BACKWARD out of a slide the show excludes', () => {
		const visible = [0, 3, 7];
		const result = computeNextSlidePosition(visible, 5, -1);
		expect(result.nextSlideIndex).toBe(3);
	});

	it('should not loop in rehearsal mode', () => {
		const result = computeNextSlidePosition(allIndexes, 4, 1, {
			rehearsing: true,
			loopContinuously: true,
		});
		// rehearsing takes priority: should end rehearsal, not loop
		expect(result.endRehearsal).toBeTruthy();
		expect(result.nextSlideIndex).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Tests: isValidNavigationTarget
// ---------------------------------------------------------------------------

describe('isValidNavigationTarget', () => {
	it('should return true for valid different index', () => {
		expect(isValidNavigationTarget(3, 10, 5)).toBeTruthy();
	});

	it('should return false for negative index', () => {
		expect(isValidNavigationTarget(-1, 10, 5)).toBeFalsy();
	});

	it('should return false for index beyond slides', () => {
		expect(isValidNavigationTarget(10, 10, 5)).toBeFalsy();
	});

	it('should return false for same index as current', () => {
		expect(isValidNavigationTarget(5, 10, 5)).toBeFalsy();
	});

	it('should return true for first slide', () => {
		expect(isValidNavigationTarget(0, 10, 5)).toBeTruthy();
	});

	it('should return true for last slide', () => {
		expect(isValidNavigationTarget(9, 10, 5)).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Tests: shouldScheduleAutoAdvance
// ---------------------------------------------------------------------------

describe('shouldScheduleAutoAdvance', () => {
	it('should return true for positive number', () => {
		expect(shouldScheduleAutoAdvance(5000)).toBeTruthy();
	});

	it('should return true for zero', () => {
		expect(shouldScheduleAutoAdvance(0)).toBeTruthy();
	});

	it('should return false for undefined', () => {
		expect(shouldScheduleAutoAdvance(undefined)).toBeFalsy();
	});

	it('should return false for null', () => {
		expect(shouldScheduleAutoAdvance(null)).toBeFalsy();
	});

	it('should return false for NaN', () => {
		expect(shouldScheduleAutoAdvance(NaN)).toBeFalsy();
	});

	it('should return false for Infinity', () => {
		expect(shouldScheduleAutoAdvance(Infinity)).toBeFalsy();
	});

	it('should return false for negative number', () => {
		expect(shouldScheduleAutoAdvance(-100)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Tests: isClickAdvanceBlocked (advanceOnClick enforcement, issue #82)
// ---------------------------------------------------------------------------

describe('isClickAdvanceBlocked', () => {
	it('should block a click-advance when advanceOnClick is false', () => {
		const slide = slideWithTransition({ type: 'fade', advanceOnClick: false });
		expect(isClickAdvanceBlocked(slide, 1, 'click')).toBeTruthy();
	});

	it('should allow a click-advance when advanceOnClick is true', () => {
		const slide = slideWithTransition({ type: 'fade', advanceOnClick: true });
		expect(isClickAdvanceBlocked(slide, 1, 'click')).toBeFalsy();
	});

	it('should allow a click-advance when advanceOnClick is undefined (default)', () => {
		const slide = slideWithTransition({ type: 'fade' });
		expect(isClickAdvanceBlocked(slide, 1, 'click')).toBeFalsy();
	});

	it('should allow a click-advance when the slide has no transition', () => {
		const slide = slideWithTransition();
		expect(isClickAdvanceBlocked(slide, 1, 'click')).toBeFalsy();
	});

	it('should allow a click-advance when the slide is undefined', () => {
		expect(isClickAdvanceBlocked(undefined, 1, 'click')).toBeFalsy();
	});

	it('should never block explicit navigation even when advanceOnClick is false', () => {
		const slide = slideWithTransition({ type: 'fade', advanceOnClick: false });
		// Keyboard, nav buttons, action triggers, and timed auto-advance all use
		// the 'explicit' trigger and must keep working.
		expect(isClickAdvanceBlocked(slide, 1, 'explicit')).toBeFalsy();
	});

	it('should never block a backward click even when advanceOnClick is false', () => {
		const slide = slideWithTransition({ type: 'fade', advanceOnClick: false });
		expect(isClickAdvanceBlocked(slide, -1, 'click')).toBeFalsy();
	});

	it('should not affect auto-advance scheduling when advanceOnClick is false', () => {
		// advanceOnClick only governs click-to-advance; timed auto-advance (advTm)
		// is still scheduled regardless.
		const slide = slideWithTransition({ advanceOnClick: false, advanceAfterMs: 4000 });
		expect(shouldScheduleAutoAdvance(slide.transition?.advanceAfterMs)).toBeTruthy();
		expect(isClickAdvanceBlocked(slide, 1, 'explicit')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Tests: hidden slides are skipped by the show (regression)
// ---------------------------------------------------------------------------

describe('hidden slides during the show', () => {
	it('skips a hidden slide advancing forward', () => {
		const order = resolveShowSlideIndexes(deck(false, true, false));
		expect(order).toStrictEqual([0, 2]);
		expect(computeNextSlidePosition(order, 0, 1).nextSlideIndex).toBe(2);
	});

	it('skips a hidden slide going backward', () => {
		const order = resolveShowSlideIndexes(deck(false, true, false));
		expect(computeNextSlidePosition(order, 2, -1).nextSlideIndex).toBe(0);
	});

	it('treats the last visible slide as the end when trailing slides are hidden', () => {
		const order = resolveShowSlideIndexes(deck(false, false, true, true));
		expect(order).toStrictEqual([0, 1]);
		expect(hasShowSlideAfter(1, order)).toBeFalsy();
		expect(computeNextSlidePosition(order, 1, 1).nextSlideIndex).toBeNull();
	});

	it('wraps past trailing hidden slides to the first visible slide when looping', () => {
		const order = resolveShowSlideIndexes(deck(true, false, false, true));
		expect(order).toStrictEqual([1, 2]);
		expect(computeNextSlidePosition(order, 2, 1, { loopContinuously: true }).nextSlideIndex).toBe(
			1,
		);
	});

	it('leaves a typed slide-number jump free to reach a hidden slide', () => {
		// `navigateToSlide` is bounded by the DECK, never by the show order: this
		// is PowerPoint's documented way to pull up a hidden backup slide.
		expect(isValidNavigationTarget(1, 3, 0)).toBeTruthy();
	});
});
