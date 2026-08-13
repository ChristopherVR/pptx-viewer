/**
 * shape-adjust-handle.ts: the Angular view-mapping for the SHARED shape
 * adjustment (`a:avLst`) affordance.
 *
 * Angular used to render a generic top-left corner handle for EVERY selected
 * element whose pointerdown just resized from the south-east corner: a decoy
 * that neither appeared where an adjustment handle belongs nor adjusted
 * anything. React, Vue, Svelte and Vanilla all consume
 * `getShapeAdjustmentHandleDescriptors` instead, which answers an EMPTY list
 * for any geometry with no adjustable parameter (and for a shape whose
 * `a:spLocks/@noAdjustHandles` is set), so a handle only exists where
 * PowerPoint puts one, and a preset with several adjustable parameters gets
 * one diamond for each.
 *
 * This module is the thin descriptor -> stage-box mapping, kept out of
 * `slide-canvas.component.ts` so the component stays view wiring and the maths
 * stays unit-testable without Angular.
 *
 * @module viewer/shape-adjust-handle
 */
import type { PptxElement } from 'pptx-viewer-core';

import {
	beginShapeAdjustment,
	getDraggedShapeAdjustments,
	getShapeAdjustmentHandleDescriptors,
} from '../internal/shared';
import type { ShapeAdjustmentDragState, ShapeAdjustmentHandleDescriptor } from '../internal/shared';
import type { Box } from './drag-resize';

/** One adjustment handle's render box in STAGE (unscaled slide) coordinates. */
export interface AdjustHandleBox {
	/** The `a:avLst` guide name the drag writes (`shapeAdjustments[key]`). */
	key: string;
	left: number;
	top: number;
	size: number;
	cursor: string;
	/** The element's current adjustment value (guide units), seeding a drag. */
	value: number;
	/** The descriptor this box came from; the drag needs its solver. */
	descriptor: ShapeAdjustmentHandleDescriptor;
}

/**
 * Every adjustment handle box for the single selection, empty when the element
 * has no adjustable parameter, is locked against adjusting, or nothing is
 * selected / the canvas is not editable.
 *
 * The shared descriptor's `left`/`top` are ELEMENT-LOCAL pixel offsets from the
 * element's top-left. The Angular stage is authored in raw slide pixels and
 * carries the on-screen scale as a CSS transform, so they only need the
 * selection box origin added; the handle's own `size` is divided by the
 * effective scale so it stays a constant number of SCREEN pixels, exactly like
 * the resize and rotate handles beside it.
 */
export function computeAdjustHandles(
	element: PptxElement | null | undefined,
	box: (Box & { id: string }) | null,
	editable: boolean,
	handleScreenPx: number,
	zoom: number,
): AdjustHandleBox[] {
	if (!editable || !element || !box) {
		return [];
	}
	const size = handleScreenPx / (zoom || 1);
	return getShapeAdjustmentHandleDescriptors(element).map((descriptor) => ({
		key: descriptor.key,
		left: box.x + descriptor.left - size / 2,
		top: box.y + descriptor.top - size / 2,
		size,
		cursor: descriptor.cursor,
		value: descriptor.value,
		descriptor,
	}));
}

/**
 * Capture the drag state for an adjustment gesture starting on `handle`.
 *
 * Delegates to shared so the captured SOLVER (the measured px-per-guide-unit
 * scale of this particular handle) travels with the gesture; a hand-built state
 * would drop it and the drag would fall back to round-rect maths for every
 * preset.
 */
export function beginShapeAdjustmentDrag(
	element: PptxElement,
	handle: AdjustHandleBox,
	clientX: number,
	clientY: number,
): ShapeAdjustmentDragState {
	return beginShapeAdjustment(element, handle.descriptor, clientX, clientY);
}

/**
 * The `shapeAdjustments` map for the pointer's current screen position.
 *
 * Travel is converted from screen pixels into SLIDE pixels first, because the
 * shared solver measures the delta against the element's own (unscaled) box;
 * feeding it raw screen pixels would make the adjustment track the zoom level.
 * BOTH axes are passed: only a round-rect's handle travels horizontally.
 */
export function draggedAdjustments(
	state: ShapeAdjustmentDragState,
	clientX: number,
	clientY: number,
	zoom: number,
): Record<string, number> {
	const scale = zoom || 1;
	return getDraggedShapeAdjustments(
		state,
		(clientX - state.startClientX) / scale,
		(clientY - state.startClientY) / scale,
	);
}
