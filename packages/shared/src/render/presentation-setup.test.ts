import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyRehearsalTimings,
	computeEntranceAnimationDelay,
	isClickAdvanceAllowed,
	shouldLoopContinuously,
	sortEntranceAnimations,
} from './presentation-setup';

function slide(id: string): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements: [] } as PptxSlide;
}

function slideWithAdvanceOnClick(value: boolean | undefined): PptxSlide {
	return {
		id: 's',
		rId: 's',
		slideNumber: 1,
		elements: [],
		transition: { type: 'fade', advanceOnClick: value },
	} as PptxSlide;
}

describe('presentation setup', () => {
	it('loops kiosk shows', () => {
		expect(shouldLoopContinuously({ showType: 'kiosk' })).toBeTruthy();
	});

	it('applies timings immutably', () => {
		const slides = [slide('one'), slide('two')];
		const result = applyRehearsalTimings(slides, { 1: 2500 });
		expect(result[0]).toBe(slides[0]);
		expect(result[1].transition?.advanceAfterMs).toBe(2500);
	});

	it('gates click-advance on the slide transition advanceOnClick flag', () => {
		// Blocked only when the flag is explicitly false.
		expect(isClickAdvanceAllowed(slideWithAdvanceOnClick(false))).toBeFalsy();
		// Allowed when true, undefined, when no transition, or no slide.
		expect(isClickAdvanceAllowed(slideWithAdvanceOnClick(true))).toBeTruthy();
		expect(isClickAdvanceAllowed(slideWithAdvanceOnClick(undefined))).toBeTruthy();
		expect(isClickAdvanceAllowed(slide('bare'))).toBeTruthy();
		expect(isClickAdvanceAllowed(undefined)).toBeTruthy();
	});

	it('sorts entrance animations and computes stagger delay', () => {
		const result = sortEntranceAnimations([
			{ elementId: 'later', entrance: true, order: 2 },
			{ elementId: 'ignored' },
			{ elementId: 'first', entrance: true, order: 1 },
		]);
		expect(result.map(({ elementId }) => elementId)).toStrictEqual(['first', 'later']);
		expect(computeEntranceAnimationDelay(100, 2)).toBe(220);
	});
});
