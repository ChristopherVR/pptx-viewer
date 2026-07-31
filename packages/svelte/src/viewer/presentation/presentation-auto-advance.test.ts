import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveSlideAutoAdvanceMs } from './presentation-auto-advance';

function slide(advanceAfterMs?: number, advanceOnClick?: boolean): PptxSlide {
	return {
		id: 'slide-1',
		elements: [],
		transition: { type: 'fade', advanceAfterMs, advanceOnClick },
	} as unknown as PptxSlide;
}

describe('resolveSlideAutoAdvanceMs', () => {
	const base = { presenting: true, useTimings: true, endOfShow: false };

	it('returns the authored advTm delay', () => {
		expect(resolveSlideAutoAdvanceMs({ ...base, slide: slide(2500) })).toBe(2500);
		expect(resolveSlideAutoAdvanceMs({ ...base, slide: slide(0) })).toBe(0);
	});

	it('arms the timer on a slide that forbids click-advance (the stranding case)', () => {
		// `advClick="0" advTm="10"`: the ONLY way forward is this timer.
		expect(resolveSlideAutoAdvanceMs({ ...base, slide: slide(10, false) })).toBe(10);
	});

	it('returns undefined for a slide with no authored timing', () => {
		expect(resolveSlideAutoAdvanceMs({ ...base, slide: slide() })).toBeUndefined();
		expect(resolveSlideAutoAdvanceMs({ ...base, slide: undefined })).toBeUndefined();
	});

	it('schedules nothing outside the show, on the end screen, or in manual mode', () => {
		expect(
			resolveSlideAutoAdvanceMs({ ...base, presenting: false, slide: slide(2500) }),
		).toBeUndefined();
		expect(
			resolveSlideAutoAdvanceMs({ ...base, endOfShow: true, slide: slide(2500) }),
		).toBeUndefined();
		expect(
			resolveSlideAutoAdvanceMs({ ...base, useTimings: false, slide: slide(2500) }),
		).toBeUndefined();
	});
});
