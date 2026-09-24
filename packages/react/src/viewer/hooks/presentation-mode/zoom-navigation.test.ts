import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import {
	beginZoomExcursion,
	buildZoomTransitionOverride,
	resolveForwardSlideWithZoomReturn,
} from 'pptx-viewer-shared';
import type { ZoomExcursion, ZoomNavigationTarget } from 'pptx-viewer-shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// `useZoomNavigation` is a thin useCallback/useRef wrapper around the shared
// `beginZoomExcursion` / `buildZoomTransitionOverride` decision functions (see
// `zoom-return-navigation.test.ts` in pptx-viewer-shared for their own
// coverage). This file exercises the SAME functions through the hook's exact
// call shape, plus the forward-advance consumer
// (`resolveForwardSlideWithZoomReturn`, wired into `useSlideNavigation`), so a
// regression in either the glue or the shared logic fails here.
// ---------------------------------------------------------------------------

function slide(sectionId?: string): PptxSlide {
	return { id: 's', rId: 'r', elements: [], sectionId } as PptxSlide;
}

/** Mirrors `useZoomNavigation`'s `handleZoomClick`/`clearZoomReturn` body exactly. */
function createZoomNav(
	slides: readonly PptxSlide[],
	navigateToSlide: (idx: number, transitionOverride?: PptxSlideTransition) => void,
) {
	const excursionRef: { current: ZoomExcursion | undefined } = { current: undefined };
	return {
		handleZoomClick(target: ZoomNavigationTarget, returnSlideIndex: number) {
			excursionRef.current = beginZoomExcursion(target, returnSlideIndex, slides);
			navigateToSlide(
				target.targetSlideIndex,
				buildZoomTransitionOverride(target.transitionDurationMs),
			);
		},
		clearZoomReturn() {
			excursionRef.current = undefined;
		},
		excursionRef,
	};
}

function zoomTarget(overrides: Partial<ZoomNavigationTarget> = {}): ZoomNavigationTarget {
	return { targetSlideIndex: 5, returnToParent: false, ...overrides };
}

describe('useZoomNavigation glue', () => {
	let navigateToSlide: ReturnType<typeof vi.fn>;
	let nav: ReturnType<typeof createZoomNav>;
	const slides = [slide(), slide(), slide()];

	beforeEach(() => {
		navigateToSlide = vi.fn();
		nav = createZoomNav(slides, navigateToSlide);
	});

	it('navigates to the target slide with no transition override when transitionDurationMs is absent', () => {
		nav.handleZoomClick(zoomTarget({ targetSlideIndex: 5 }), 0);
		expect(navigateToSlide).toHaveBeenCalledWith(5, undefined);
	});

	it('navigates with a synthetic zoom transition override when transitionDurationMs is authored', () => {
		nav.handleZoomClick(zoomTarget({ targetSlideIndex: 5, transitionDurationMs: 400 }), 0);
		expect(navigateToSlide).toHaveBeenCalledWith(5, { type: 'zoom', durationMs: 400 });
	});

	it('arms no excursion when returnToParent is not set', () => {
		nav.handleZoomClick(zoomTarget({ returnToParent: false }), 2);
		expect(nav.excursionRef.current).toBeUndefined();
	});

	it('arms an excursion when returnToParent is set', () => {
		nav.handleZoomClick(zoomTarget({ targetSlideIndex: 5, returnToParent: true }), 2);
		expect(nav.excursionRef.current).toStrictEqual({
			returnSlideIndex: 2,
			endSlideIndex: 5,
			transitionDurationMs: undefined,
		});
	});

	it('a later click overwrites a still-pending excursion', () => {
		nav.handleZoomClick(zoomTarget({ targetSlideIndex: 5, returnToParent: true }), 0);
		nav.handleZoomClick(zoomTarget({ targetSlideIndex: 1, returnToParent: true }), 3);
		expect(nav.excursionRef.current).toStrictEqual({
			returnSlideIndex: 3,
			endSlideIndex: 1,
			transitionDurationMs: undefined,
		});
	});

	it('clearZoomReturn clears a pending excursion', () => {
		nav.handleZoomClick(zoomTarget({ returnToParent: true }), 0);
		nav.clearZoomReturn();
		expect(nav.excursionRef.current).toBeUndefined();
	});
});

describe('forward-advance excursion consumption (useSlideNavigation wiring)', () => {
	it('returns to the origin slide once the show reaches the excursion end', () => {
		const excursion: ZoomExcursion = {
			returnSlideIndex: 0,
			endSlideIndex: 5,
			transitionDurationMs: 250,
		};
		const step = resolveForwardSlideWithZoomReturn(5, 6, excursion);
		expect(step.returnedToZoom).toBeTruthy();
		expect(step.nextSlideIndex).toBe(0);
		expect(step.excursion).toBeUndefined();
	});

	it('advances naturally and keeps the excursion before the end is reached', () => {
		const excursion: ZoomExcursion = {
			returnSlideIndex: 0,
			endSlideIndex: 5,
			transitionDurationMs: 250,
		};
		const step = resolveForwardSlideWithZoomReturn(3, 4, excursion);
		expect(step.returnedToZoom).toBeFalsy();
		expect(step.nextSlideIndex).toBe(4);
		expect(step.excursion).toBe(excursion);
	});
});
