/**
 * usePointerHandlers: Global pointer move/up handlers for drag, resize,
 * marquee selection, and shape-adjustment interactions.
 *
 * Heavy logic is extracted into:
 *   - pointer-move-handlers.ts  (processPointerMove)
 *   - pointer-up-handlers.ts    (processPointerUp)
 *   - pointer-handler-types.ts  (shared types)
 */
import { useEffect } from 'react';

import type { PointerFrameTracker, UsePointerHandlersInput } from './pointer-handler-types';
import { processPointerMove } from './pointer-move-handlers';
import { processPointerUp } from './pointer-up-handlers';

export type { UsePointerHandlersInput };

export function usePointerHandlers(input: UsePointerHandlersInput): void {
	const {
		editorScale,
		canvasStageRef,
		canvasSize,
		activeSlide,
		activeSlideIndex,
		gridSpacingPx,
		dragStateRef,
		resizeStateRef,
		shapeAdjustmentDragStateRef,
		marqueeStateRef,
		editTemplateMode,
		snapToGrid,
		snapToShape,
		guides,
		templateElements,
		elementLookup,
		setMarqueeSelectionState,
		setSnapLines,
		setTemplateElementsBySlideId,
		setPointerCommitNonce,
		applySelection,
		clearSelection,
		updateSlides,
		updateElementById,
		markDirty,
		livePatcher,
	} = input;

	// The effect body closes over `input` as a whole (passed straight through to
	// processPointerMove/processPointerUp) rather than the individually
	// destructured fields above, so the fields never show up as "read" to the
	// dependency analyzer. They are listed below anyway, deliberately, so the
	// global pointermove/pointerup listeners only re-subscribe when one of
	// these specific values actually changes.
	//
	// Deliberately does NOT also list `input` itself: the caller
	// (`useViewerIntegration`) builds it as a fresh object literal on every
	// render, so its identity differs every render regardless of whether any
	// field changed. Every field the closure reads is already covered
	// individually below, so adding `input` on top contributes nothing except
	// forcing this effect to tear down and rebuild on EVERY render. During a
	// drag that is fatal: `handlePointerMove`'s rAF-scheduled call to
	// `processPointerMove` (which writes the live position straight to the
	// DOM, bypassing React) gets cancelled by the old effect's cleanup before
	// it ever fires if a re-render lands mid-frame for any unrelated reason,
	// so the dragged element only reaches its true position once, on
	// `pointerup`, when React actually commits the new `x`/`y` - i.e. the
	// element visually does not move until the mouse is released.
	/* oxlint-disable react-hooks/exhaustive-deps -- see comment above */
	useEffect(() => {
		const tracker: PointerFrameTracker = {
			rafId: 0,
			pendingMoveEvent: null,
			lastSnapLinesKey: '',
		};

		const handlePointerMove = (e: PointerEvent) => {
			tracker.pendingMoveEvent = e;
			if (tracker.rafId === 0) {
				tracker.rafId = requestAnimationFrame(() => {
					tracker.rafId = 0;
					if (tracker.pendingMoveEvent) {
						processPointerMove(tracker.pendingMoveEvent, input, tracker);
						tracker.pendingMoveEvent = null;
					}
				});
			}
		};

		const handlePointerUp = () => {
			if (tracker.rafId !== 0) {
				cancelAnimationFrame(tracker.rafId);
				tracker.rafId = 0;
				tracker.pendingMoveEvent = null;
			}
			processPointerUp(input);
		};

		document.addEventListener('pointermove', handlePointerMove);
		document.addEventListener('pointerup', handlePointerUp);
		return () => {
			document.removeEventListener('pointermove', handlePointerMove);
			document.removeEventListener('pointerup', handlePointerUp);
			if (tracker.rafId !== 0) {
				cancelAnimationFrame(tracker.rafId);
			}
		};
	}, [
		editorScale,
		canvasStageRef,
		dragStateRef,
		resizeStateRef,
		shapeAdjustmentDragStateRef,
		marqueeStateRef,
		editTemplateMode,
		snapToGrid,
		snapToShape,
		guides,
		templateElements,
		setMarqueeSelectionState,
		setSnapLines,
		elementLookup,
		setTemplateElementsBySlideId,
		setPointerCommitNonce,
		activeSlide,
		activeSlideIndex,
		canvasSize.width,
		canvasSize.height,
		gridSpacingPx,
		applySelection,
		clearSelection,
		updateSlides,
		updateElementById,
		markDirty,
		livePatcher,
	]);
	/* oxlint-enable react-hooks/exhaustive-deps */
}
