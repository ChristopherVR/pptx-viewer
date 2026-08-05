import type { PptxSlide } from 'pptx-viewer-core';
import { attachPresentationVisibilityPause } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveSlideAutoAdvanceMs, ShowAutoAdvanceTimer } from './presentation-auto-advance';

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

describe('showAutoAdvanceTimer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('fires the advance after the scheduled delay', () => {
		const advance = vi.fn();
		const timer = new ShowAutoAdvanceTimer(advance);
		timer.schedule(10);
		vi.advanceTimersByTime(10);
		expect(advance).toHaveBeenCalledOnce();
	});

	it('schedule(undefined) cancels any pending tick', () => {
		const advance = vi.fn();
		const timer = new ShowAutoAdvanceTimer(advance);
		timer.schedule(10);
		timer.schedule(undefined);
		vi.advanceTimersByTime(50);
		expect(advance).not.toHaveBeenCalled();
	});

	it('cancel holds the tick; arm restarts the full delay', () => {
		const advance = vi.fn();
		const timer = new ShowAutoAdvanceTimer(advance);
		timer.schedule(10);
		timer.cancel();
		vi.advanceTimersByTime(50);
		expect(advance).not.toHaveBeenCalled();

		// Re-arming after a cancel starts the slide's timing over from scratch.
		timer.arm();
		vi.advanceTimersByTime(9);
		expect(advance).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(advance).toHaveBeenCalledOnce();
	});

	it('re-arming never leaves two timers running', () => {
		const advance = vi.fn();
		const timer = new ShowAutoAdvanceTimer(advance);
		timer.schedule(10);
		timer.arm();
		timer.arm();
		vi.advanceTimersByTime(50);
		expect(advance).toHaveBeenCalledOnce();
	});

	// The wiring `presentation-effects` hands to the shared visibility handler:
	// hiding the tab cancels the pending advance (the deck must not run on
	// unseen) and becoming visible re-arms the current slide's full delay.
	it('is held while the document is hidden and re-armed when visible again', () => {
		const setVisibility = (state: 'visible' | 'hidden'): void => {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				get: () => state,
			});
			document.dispatchEvent(new Event('visibilitychange'));
		};
		const advance = vi.fn();
		const timer = new ShowAutoAdvanceTimer(advance);
		const detach = attachPresentationVisibilityPause({
			root: document.createElement('div'),
			onHidden: () => timer.cancel(),
			onVisible: () => timer.arm(),
		});
		timer.schedule(10);

		setVisibility('hidden');
		vi.advanceTimersByTime(50);
		expect(advance).not.toHaveBeenCalled();

		setVisibility('visible');
		vi.advanceTimersByTime(10);
		expect(advance).toHaveBeenCalledOnce();
		detach();
		setVisibility('visible');
	});
});
