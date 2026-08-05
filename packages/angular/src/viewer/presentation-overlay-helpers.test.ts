import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	hasPersistentAudio,
	registerPersistentAudio,
	stopAllPersistentAudio,
} from '../internal/shared';
import { componentSource } from './component-source.test-support';
import {
	attachShowVisibilityPause,
	clampIndex,
	endShowMediaCleanup,
	fitZoom,
	nextVisibleIndex,
	prevVisibleIndex,
	resolveSlideAutoAdvanceMs,
	shouldBlockClickAdvance,
} from './presentation-overlay-helpers';

beforeEach(() => {
	// jsdom reports hasFocus() false by default; the visibility-pause helper
	// treats an unfocused window as suspended, so pin the baseline to focused.
	vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// Slide factory
// ---------------------------------------------------------------------------

function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 's1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		...overrides,
	} as PptxSlide;
}

function slides(...hidden: boolean[]): PptxSlide[] {
	return hidden.map((h, i) => slide({ id: `s${i}`, slideNumber: i + 1, hidden: h }));
}

function transitionSlide(advanceOnClick: boolean | undefined): PptxSlide {
	return slide({ transition: { type: 'fade', advanceOnClick } });
}

// ---------------------------------------------------------------------------
// shouldBlockClickAdvance
// ---------------------------------------------------------------------------

describe('shouldBlockClickAdvance', () => {
	it('blocks the click advance when builds are done and advanceOnClick is false', () => {
		expect(shouldBlockClickAdvance(true, transitionSlide(false))).toBeTruthy();
	});

	it('allows the advance when advanceOnClick is true or undefined', () => {
		expect(shouldBlockClickAdvance(true, transitionSlide(true))).toBeFalsy();
		expect(shouldBlockClickAdvance(true, transitionSlide(undefined))).toBeFalsy();
		expect(shouldBlockClickAdvance(true, slide())).toBeFalsy();
	});

	it('never blocks while animation builds remain (click still steps builds)', () => {
		expect(shouldBlockClickAdvance(false, transitionSlide(false))).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// resolveSlideAutoAdvanceMs
// ---------------------------------------------------------------------------

describe('resolveSlideAutoAdvanceMs', () => {
	const timed = (advanceAfterMs: number, advanceOnClick?: boolean): PptxSlide =>
		slide({ transition: { type: 'fade', advanceAfterMs, advanceOnClick } });

	it('schedules the authored advTm delay', () => {
		expect(resolveSlideAutoAdvanceMs(timed(2500), true, false)).toBe(2500);
		expect(resolveSlideAutoAdvanceMs(timed(0), true, false)).toBe(0);
	});

	/**
	 * The regression this whole helper exists for. `solution-explorer.pptx`
	 * slide 1 is authored `advClick="0" advTm="10"`: the click gate correctly
	 * swallows every click, so if the timer is not armed the show sits on slide 1
	 * for ever and looks completely dead. Both halves must agree.
	 */
	it('still advances a slide whose transition forbids click-advance', () => {
		const stuckWithoutATimer = timed(10, false);
		expect(shouldBlockClickAdvance(true, stuckWithoutATimer)).toBeTruthy();
		expect(resolveSlideAutoAdvanceMs(stuckWithoutATimer, true, false)).toBe(10);
	});

	it('schedules nothing without an authored timing', () => {
		expect(resolveSlideAutoAdvanceMs(slide(), true, false)).toBeUndefined();
		expect(resolveSlideAutoAdvanceMs(transitionSlide(false), true, false)).toBeUndefined();
		expect(resolveSlideAutoAdvanceMs(undefined, true, false)).toBeUndefined();
	});

	it('schedules nothing for a manual-advance show', () => {
		expect(resolveSlideAutoAdvanceMs(timed(2500), false, false)).toBeUndefined();
	});

	it('schedules nothing once the end-of-show screen is up', () => {
		expect(resolveSlideAutoAdvanceMs(timed(2500), true, true)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// clampIndex
// ---------------------------------------------------------------------------

describe('clampIndex', () => {
	it('returns the index unchanged when in range', () => {
		expect(clampIndex(3, 10)).toBe(3);
	});

	it('clamps negative to 0', () => {
		expect(clampIndex(-5, 10)).toBe(0);
	});

	it('clamps to count - 1 when >= count', () => {
		expect(clampIndex(10, 10)).toBe(9);
		expect(clampIndex(100, 10)).toBe(9);
	});

	it('returns 0 for an empty collection', () => {
		expect(clampIndex(0, 0)).toBe(0);
		expect(clampIndex(5, 0)).toBe(0);
	});

	it('handles a single-slide collection', () => {
		expect(clampIndex(0, 1)).toBe(0);
		expect(clampIndex(1, 1)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// nextVisibleIndex
// ---------------------------------------------------------------------------

describe('nextVisibleIndex', () => {
	it('advances to the next slide when it is visible', () => {
		const s = slides(false, false, false);
		expect(nextVisibleIndex(0, s)).toBe(1);
		expect(nextVisibleIndex(1, s)).toBe(2);
	});

	it('skips hidden slides', () => {
		// Slides: [visible, hidden, hidden, visible]
		const s = slides(false, true, true, false);
		expect(nextVisibleIndex(0, s)).toBe(3);
	});

	it('returns current index when all remaining slides are hidden', () => {
		// Slides: [visible, hidden, hidden]
		const s = slides(false, true, true);
		expect(nextVisibleIndex(0, s)).toBe(0);
	});

	it('wraps around past the end (linear, no wrap in viewer-first mode)', () => {
		// The implementation wraps; at the last index with all others hidden it
		// stays put.
		const s = slides(false, false, false);
		// From index 2 → wraps to 0, which is not hidden, so returns 0.
		expect(nextVisibleIndex(2, s)).toBe(0);
	});

	it('handles an empty slide list', () => {
		expect(nextVisibleIndex(0, [])).toBe(0);
	});

	it('handles a single visible slide', () => {
		const s = slides(false);
		expect(nextVisibleIndex(0, s)).toBe(0);
	});

	it('handles a single hidden slide', () => {
		const s = slides(true);
		// Only one slide; loop exhausts and returns current.
		expect(nextVisibleIndex(0, s)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// prevVisibleIndex
// ---------------------------------------------------------------------------

describe('prevVisibleIndex', () => {
	it('goes to the previous slide when it is visible', () => {
		const s = slides(false, false, false);
		expect(prevVisibleIndex(2, s)).toBe(1);
		expect(prevVisibleIndex(1, s)).toBe(0);
	});

	it('skips hidden slides going backwards', () => {
		// Slides: [visible, hidden, hidden, visible]
		const s = slides(false, true, true, false);
		expect(prevVisibleIndex(3, s)).toBe(0);
	});

	it('returns current index when all preceding slides are hidden', () => {
		// Slides: [hidden, hidden, visible]
		const s = slides(true, true, false);
		expect(prevVisibleIndex(2, s)).toBe(2);
	});

	it('stays put at the start of the show instead of wrapping backward', () => {
		const s = slides(false, false, false);
		// PowerPoint never wraps a backward press off slide 1; Angular used to
		// jump the show to the LAST slide here, which no other binding does.
		expect(prevVisibleIndex(0, s)).toBe(0);
	});

	it('handles an empty slide list', () => {
		expect(prevVisibleIndex(0, [])).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// fitZoom
// ---------------------------------------------------------------------------

describe('fitZoom', () => {
	it('returns 1 when canvas equals viewport', () => {
		expect(fitZoom(800, 600, 800, 600)).toBe(1);
	});

	it('scales down when viewport is smaller than canvas', () => {
		// Canvas 1920×1080 → viewport 960×540 → zoom = 0.5
		expect(fitZoom(1920, 1080, 960, 540)).toBeCloseTo(0.5);
	});

	it('is constrained by the tighter dimension', () => {
		// Canvas 800×600, viewport 1600×600 → x-ratio=2, y-ratio=1 → min=1
		expect(fitZoom(800, 600, 1600, 600)).toBe(1);
		// Canvas 800×600, viewport 800×1200 → x-ratio=1, y-ratio=2 → min=1
		expect(fitZoom(800, 600, 800, 1200)).toBe(1);
	});

	it('scales up when viewport is larger in both dimensions', () => {
		expect(fitZoom(800, 600, 1600, 1200)).toBe(2);
	});

	it('returns 1 as a safe fallback for zero canvas dimensions', () => {
		expect(fitZoom(0, 600, 800, 600)).toBe(1);
		expect(fitZoom(800, 0, 800, 600)).toBe(1);
	});

	it('returns 1 as a safe fallback for zero viewport dimensions', () => {
		expect(fitZoom(800, 600, 0, 600)).toBe(1);
		expect(fitZoom(800, 600, 800, 0)).toBe(1);
	});

	it('returns 1 as a safe fallback for negative dimensions', () => {
		expect(fitZoom(-1, 600, 800, 600)).toBe(1);
		expect(fitZoom(800, 600, 800, -1)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Visibility pause + end-of-show media cleanup
// ---------------------------------------------------------------------------

function setVisibility(state: 'visible' | 'hidden'): void {
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => state,
	});
	document.dispatchEvent(new Event('visibilitychange'));
}

describe('attachShowVisibilityPause', () => {
	afterEach(() => {
		stopAllPersistentAudio();
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'visible',
		});
	});

	it('cancels the auto-advance when the tab hides and re-arms it when visible', () => {
		const cancelAutoAdvance = vi.fn();
		const rearmAutoAdvance = vi.fn();
		const detach = attachShowVisibilityPause({
			root: document.createElement('div'),
			cancelAutoAdvance,
			rearmAutoAdvance,
		});

		setVisibility('hidden');
		expect(cancelAutoAdvance).toHaveBeenCalledOnce();
		expect(rearmAutoAdvance).not.toHaveBeenCalled();

		setVisibility('visible');
		expect(rearmAutoAdvance).toHaveBeenCalledOnce();
		detach();
	});

	it('stops reacting after detach', () => {
		const cancelAutoAdvance = vi.fn();
		const detach = attachShowVisibilityPause({
			root: undefined,
			cancelAutoAdvance,
			rearmAutoAdvance: () => {},
		});
		detach();
		setVisibility('hidden');
		expect(cancelAutoAdvance).not.toHaveBeenCalled();
	});

	it('pauses cross-slide persistent audio while hidden', () => {
		registerPersistentAudio('bg-track', 'data:audio/mpeg;base64,AAAA', 'audio/mpeg', true, 1, 0);
		const persistent = document.querySelector<HTMLAudioElement>(
			'[data-pptx-persistent-audio="bg-track"]',
		);
		expect(persistent).not.toBeNull();
		// The manager's element reports paused=false while "playing".
		Object.defineProperty(persistent, 'paused', { configurable: true, get: () => false });
		const pause = vi.spyOn(persistent as HTMLAudioElement, 'pause').mockImplementation(() => {});

		const detach = attachShowVisibilityPause({
			root: document.createElement('div'),
			cancelAutoAdvance: () => {},
			rearmAutoAdvance: () => {},
		});
		setVisibility('hidden');
		expect(pause).toHaveBeenCalledOnce();
		detach();
	});
});

describe('endShowMediaCleanup', () => {
	it('stops and removes all cross-slide persistent audio', () => {
		registerPersistentAudio('bg-track-2', 'data:audio/mpeg;base64,AAAA', undefined, false, 1, 0);
		expect(hasPersistentAudio('bg-track-2')).toBeTruthy();

		endShowMediaCleanup();
		expect(hasPersistentAudio('bg-track-2')).toBeFalsy();
		expect(document.querySelectorAll('[data-pptx-persistent-audio]')).toHaveLength(0);
	});

	// This package has no TestBed (see `vitest.config.ts`), so the exit wiring is
	// asserted against the authored sources, the same technique the transport
	// spec uses: BOTH host exit paths end the show's cross-slide audio, and the
	// overlay attaches the visibility pause. The presenter-view swap deliberately
	// does not (the show, and its background audio, carry on in the console).
	it('is called from both host exit paths, and the overlay attaches the pause', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const service = componentSource(dir, 'viewer-presentation-mode.service.ts');
		const closeBody = service.slice(service.indexOf('closePresentation('));
		expect(closeBody.slice(0, closeBody.indexOf('}'))).toContain('endShowMediaCleanup()');
		const exitBody = service.slice(service.indexOf('exitPresenter('));
		expect(exitBody.slice(0, exitBody.indexOf('}'))).toContain('endShowMediaCleanup()');
		const toggleBody = service.slice(service.indexOf('togglePresenterView('));
		expect(toggleBody.slice(0, toggleBody.indexOf('}'))).not.toContain('endShowMediaCleanup()');

		const overlay = componentSource(dir, 'presentation-overlay.component.ts');
		expect(overlay).toContain('attachShowVisibilityPause({');
	});
});
