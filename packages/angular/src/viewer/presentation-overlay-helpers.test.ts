import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	clampIndex,
	fitZoom,
	nextVisibleIndex,
	prevVisibleIndex,
	shouldBlockClickAdvance,
} from './presentation-overlay-helpers';

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

	it('wraps around before the start and finds a visible slide', () => {
		const s = slides(false, false, false);
		// From 0 → wraps to 2, which is visible.
		expect(prevVisibleIndex(0, s)).toBe(2);
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
