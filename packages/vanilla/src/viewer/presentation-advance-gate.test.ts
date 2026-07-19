import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { isSwipeAdvanceBlocked } from './presentation-advance-gate';

function slide(advanceOnClick: boolean | undefined): PptxSlide {
	return {
		id: 's',
		rId: 's',
		slideNumber: 1,
		elements: [],
		transition: { type: 'fade', advanceOnClick },
	} as PptxSlide;
}

describe('isSwipeAdvanceBlocked', () => {
	it('blocks the swipe/tap advance when advanceOnClick is false and builds are done', () => {
		expect(
			isSwipeAdvanceBlocked({
				presenting: true,
				animationBuildsComplete: true,
				currentSlide: slide(false),
			}),
		).toBeTruthy();
	});

	it('allows the advance when advanceOnClick is true or undefined', () => {
		expect(
			isSwipeAdvanceBlocked({
				presenting: true,
				animationBuildsComplete: true,
				currentSlide: slide(true),
			}),
		).toBeFalsy();
		expect(
			isSwipeAdvanceBlocked({
				presenting: true,
				animationBuildsComplete: true,
				currentSlide: slide(undefined),
			}),
		).toBeFalsy();
	});

	it('never blocks while animation builds remain (tap still steps builds)', () => {
		expect(
			isSwipeAdvanceBlocked({
				presenting: true,
				animationBuildsComplete: false,
				currentSlide: slide(false),
			}),
		).toBeFalsy();
	});

	it('never blocks outside a running show (preview-mode swipe)', () => {
		expect(
			isSwipeAdvanceBlocked({
				presenting: false,
				animationBuildsComplete: true,
				currentSlide: slide(false),
			}),
		).toBeFalsy();
	});
});
