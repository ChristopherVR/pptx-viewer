import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyRehearsalTimings,
	computeEntranceAnimationDelay,
	shouldLoopContinuously,
	sortEntranceAnimations,
} from './presentation-setup';

function slide(id: string): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements: [] } as PptxSlide;
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
