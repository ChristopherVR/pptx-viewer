import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { beginZoomExcursion, buildZoomTransitionOverride } from 'pptx-viewer-shared';
import type { ZoomExcursion, ZoomNavigationTarget } from 'pptx-viewer-shared';
import { useCallback } from 'react';

/**
 * Input for the useZoomNavigation sub-hook.
 */
export interface UseZoomNavigationInput {
	slides: readonly PptxSlide[];
	/** Navigate to a specific slide index, optionally overriding the destination's own transition. */
	navigateToSlide: (slideIndex: number, transitionOverride?: PptxSlideTransition) => void;
	/**
	 * Shared with `useSlideNavigation`'s forward-advance step: set here on a
	 * zoom click that requests `returnToParent`, and consumed there once the
	 * show reaches the end of the zoom's target range.
	 */
	zoomExcursionRef: React.RefObject<ZoomExcursion | undefined>;
}

/**
 * Return type for the useZoomNavigation sub-hook.
 */
export interface UseZoomNavigationResult {
	/**
	 * Handle a zoom element (or Summary Zoom tile) click: navigates to the
	 * target slide, applying the zoom's own `transitionDur` when authored, and
	 * (when the target's `returnToParent` is set) arms an excursion so the
	 * next forward "advance" past the target's range returns here instead of
	 * continuing linearly through the deck.
	 */
	handleZoomClick: (target: ZoomNavigationTarget, returnSlideIndex: number) => void;
	/** Clear a pending zoom excursion (e.g. when presentation mode ends). */
	clearZoomReturn: () => void;
}

/**
 * Sub-hook that manages zoom element navigation in presentation mode.
 *
 * The actual "return to zoom" jump is executed by `useSlideNavigation`'s
 * forward-advance step (it owns the deck's natural next-slide computation);
 * this hook only arms the excursion `useSlideNavigation` consults, via the
 * `zoomExcursionRef` both hooks share.
 */
export function useZoomNavigation(input: UseZoomNavigationInput): UseZoomNavigationResult {
	const { slides, navigateToSlide, zoomExcursionRef } = input;

	const handleZoomClick = useCallback(
		(target: ZoomNavigationTarget, returnSlideIndex: number) => {
			zoomExcursionRef.current = beginZoomExcursion(target, returnSlideIndex, slides);
			navigateToSlide(
				target.targetSlideIndex,
				buildZoomTransitionOverride(target.transitionDurationMs),
			);
		},
		[navigateToSlide, slides, zoomExcursionRef],
	);

	const clearZoomReturn = useCallback(() => {
		zoomExcursionRef.current = undefined;
	}, [zoomExcursionRef]);

	return {
		handleZoomClick,
		clearZoomReturn,
	};
}
