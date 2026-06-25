/**
 * Extracted pointer-up (commit) logic for usePointerHandlers.
 * Commits marquee selections, drag moves, resizes, and resets state.
 */
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
		activeSlide,
		activeSlideIndex,
		marqueeStateRef,
		dragStateRef,
		resizeStateRef,
		shapeAdjustmentDragStateRef,
		setMarqueeSelectionState,
		setSnapLines,
		setPointerCommitNonce,
		applySelection,
		clearSelection,
		updateSlides,
		updateElementById,
		markDirty,
	} = input;

	const marquee = marqueeStateRef.current;
	const drag = dragStateRef.current;
	const rs = resizeStateRef.current;
	const adj = shapeAdjustmentDragStateRef.current;

	if (marquee) {
		commitMarquee(marquee, activeSlide, applySelection, clearSelection);
		marqueeStateRef.current = null;
		setMarqueeSelectionState(null);
	}

	if (drag?.moved) {
		commitDrag(drag, activeSlideIndex, updateSlides);
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
	activeSlide: UsePointerHandlersInput['activeSlide'],
	applySelection: UsePointerHandlersInput['applySelection'],
	clearSelection: UsePointerHandlersInput['clearSelection'],
): void {
	// Template elements are part of `slide.elements`; marquee hit-testing runs
	// over the same list. Whether they end up selected is gated separately by the
	// per-element interactivity check at render time.
	const sourceElements = activeSlide?.elements ?? [];
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
	activeSlideIndex: number,
	updateSlides: UsePointerHandlersInput['updateSlides'],
): void {
	const dx = drag.lastDx,
		dy = drag.lastDy;
	// Template (master/layout) elements live in `slide.elements`, so dragging one
	// commits through the same slides path as any other element and persists to
	// the shared part via the core save writer.
	const movedIds = new Set(Object.keys(drag.startPositionsById));
	updateSlides((prev) =>
		prev.map((s, i) => {
			if (i !== activeSlideIndex) {
				return s;
			}
			// First apply the drag positions
			const movedElements = s.elements.map((el) => {
				const start = drag.startPositionsById[el.id];
				if (!start) {
					return el;
				}
				return { ...el, x: start.x + dx, y: start.y + dy };
			});
			// Then reroute any connectors attached to the moved shapes
			const rerouted = rerouteConnectorsForMovedElements(movedElements, movedIds);
			return {
				...s,
				elements: applyReroutedConnectors(movedElements, rerouted),
			};
		}),
	);
}
