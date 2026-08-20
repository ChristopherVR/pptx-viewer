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
	// dependency analyzer. They are listed anyway, deliberately, alongside
	// `input`: this re-subscribes the global pointermove/pointerup listeners
	// whenever any one of these specific values changes, rather than only on
	// `input`'s object identity (which would also work, but the caller doesn't
	// guarantee `input` is memoized, so relying on identity alone risks missing
	// a change or re-subscribing on every render).
	/* oxlint-disable react/exhaustive-effect-dependencies -- see comment above */
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
		input,
	]);
	/* oxlint-enable react/exhaustive-effect-dependencies */
}
