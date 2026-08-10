/**
 * Extracted pointer-up (commit) logic for usePointerHandlers.
 * Commits marquee selections, drag moves, resizes, and resets state.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { computeMarqueeHitIds, mergeAdditiveSelection } from 'pptx-viewer-shared';
import type { MarqueeElementRect, MarqueeRect as SharedMarqueeRect } from 'pptx-viewer-shared';

import {
	rerouteConnectorsForMovedElements,
	applyReroutedConnectors,
} from '../utils/connector-reroute';
import type { UsePointerHandlersInput } from './pointer-handler-types';

// ---------------------------------------------------------------------------
// Re-exported pure helpers (now backed by `pptx-viewer-shared`)
// ---------------------------------------------------------------------------

/** A marquee drag described by its start and current corner (any order). */
export type MarqueeRect = SharedMarqueeRect;

/** An element reduced to its id + bounding box for marquee hit-testing. */
export type ElementRect = MarqueeElementRect;

export { computeMarqueeHitIds, mergeAdditiveSelection };

// ---------------------------------------------------------------------------
// Main pointer-up processor
// ---------------------------------------------------------------------------

export function processPointerUp(input: UsePointerHandlersInput): void {
	const {
		editTemplateMode,
		templateElements,
		activeSlide,
		activeSlideIndex,
		marqueeStateRef,
		dragStateRef,
		resizeStateRef,
		shapeAdjustmentDragStateRef,
		justInteractedRef,
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

	const marquee = marqueeStateRef.current;
	const drag = dragStateRef.current;
	const rs = resizeStateRef.current;
	const adj = shapeAdjustmentDragStateRef.current;

	if (marquee) {
		commitMarquee(
			marquee,
			editTemplateMode,
			templateElements,
			activeSlide,
			applySelection,
			clearSelection,
		);
		marqueeStateRef.current = null;
		setMarqueeSelectionState(null);
	}

	if (drag?.moved) {
		commitDrag(
			drag,
			editTemplateMode,
			activeSlide,
			activeSlideIndex,
			setTemplateElementsBySlideId,
			updateSlides,
		);
	}

	if (rs?.moved) {
		// Apply the resize and reroute any connectors attached to the resized element
		const resizedId = rs.elementId;
		const resizeUpdates = {
			x: rs.lastX,
			y: rs.lastY,
			width: rs.lastWidth,
			height: rs.lastHeight,
		};
		updateElementById(resizedId, resizeUpdates);
		// Reroute connectors referencing the resized element
		const movedIds = new Set([resizedId]);
		updateSlides((prev) =>
			prev.map((s, i) => {
				if (i !== activeSlideIndex) {
					return s;
				}
				const rerouted = rerouteConnectorsForMovedElements(s.elements, movedIds);
				if (rerouted.length === 0) {
					return s;
				}
				return {
					...s,
					elements: applyReroutedConnectors(s.elements, rerouted),
				};
			}),
		);
	}

	const wasMoved = drag?.moved || rs?.moved || adj?.moved;

	// A gesture that moved the element leaves the pointer back over the same DOM
	// node it went down on (a dragged shape keeps the same point under the
	// cursor; an SE handle tracks the pointer 1:1), so the browser still fires a
	// trailing `click` there. Flag it so the click handler does not mistake that
	// click for the user re-clicking an already-selected element to edit it.
	if (wasMoved) {
		justInteractedRef.current = true;
	}

	// Push the last interim frame out now so peers land on the final geometry
	// without waiting for the throttle window. The state commit above reconciles
	// the same values, so this only removes latency, never duplicates history.
	if (wasMoved) {
		livePatcher?.flush();
	}

	marqueeStateRef.current = null;
	dragStateRef.current = null;
	resizeStateRef.current = null;
	shapeAdjustmentDragStateRef.current = null;
	setMarqueeSelectionState(null);
	setSnapLines([]);

	if (wasMoved) {
		markDirty();
		setPointerCommitNonce((n) => n + 1);
	}
}

// ── Marquee commit ───────────────────────────────────────────────────────────

function commitMarquee(
	marquee: NonNullable<UsePointerHandlersInput['marqueeStateRef']['current']>,
	editTemplateMode: boolean,
	templateElements: PptxElement[],
	activeSlide: UsePointerHandlersInput['activeSlide'],
	applySelection: UsePointerHandlersInput['applySelection'],
	clearSelection: UsePointerHandlersInput['clearSelection'],
): void {
	// In edit-template mode the marquee hit-tests the template store (the only
	// interactive layer); otherwise it runs over the active slide's elements.
	const sourceElements = editTemplateMode ? templateElements : (activeSlide?.elements ?? []);
	const hitIds = computeMarqueeHitIds(marquee, sourceElements);
	if (marquee.additive) {
		const merged = mergeAdditiveSelection(marquee.baseSelectionIds, hitIds);
		if (merged.length > 0) {
			applySelection(merged[0], merged);
		} else {
			clearSelection();
		}
	} else if (hitIds.length > 0) {
		applySelection(hitIds[0], hitIds);
	} else {
		clearSelection();
	}
}

// ── Drag commit ──────────────────────────────────────────────────────────────

function commitDrag(
	drag: NonNullable<UsePointerHandlersInput['dragStateRef']['current']>,
	editTemplateMode: boolean,
	activeSlide: UsePointerHandlersInput['activeSlide'],
	activeSlideIndex: number,
	setTemplateElementsBySlideId: UsePointerHandlersInput['setTemplateElementsBySlideId'],
	updateSlides: UsePointerHandlersInput['updateSlides'],
): void {
	const dx = drag.lastDx,
		dy = drag.lastDy;
	const movedIds = new Set(Object.keys(drag.startPositionsById));
	// Apply the drag positions and reroute attached connectors over an element
	// list, returning the next list.
	const moveElements = (elements: PptxElement[]): PptxElement[] => {
		const movedElements = elements.map((el) => {
			const start = drag.startPositionsById[el.id];
			if (!start) {
				return el;
			}
			return { ...el, x: start.x + dx, y: start.y + dy };
		});
		const rerouted = rerouteConnectorsForMovedElements(movedElements, movedIds);
		return applyReroutedConnectors(movedElements, rerouted);
	};

	if (editTemplateMode) {
		// Dragging a template (master/layout) element commits to the template store;
		// buildSaveSlides merges it back so the edit persists to the shared part.
		const slideId = activeSlide?.id;
		if (!slideId) {
			return;
		}
		setTemplateElementsBySlideId((prev) => ({
			...prev,
			[slideId]: moveElements(prev[slideId] ?? []),
		}));
		return;
	}

	updateSlides((prev) =>
		prev.map((s, i) => (i !== activeSlideIndex ? s : { ...s, elements: moveElements(s.elements) })),
	);
}
