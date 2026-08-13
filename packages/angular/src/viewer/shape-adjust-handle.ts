/**
 * shape-adjust-handle.ts: the Angular view-mapping for the SHARED shape
 * adjustment (`a:avLst`) affordance.
 *
 * Angular used to render a generic top-left corner handle for EVERY selected
 * element whose pointerdown just resized from the south-east corner: a decoy
 * that neither appeared where an adjustment handle belongs nor adjusted
 * anything. React, Vue, Svelte and Vanilla all consume
 * `getShapeAdjustmentHandleDescriptor` instead, which answers `null` for any
 * geometry with no adjustable parameter (and for a shape whose
 * `a:spLocks/@noAdjustHandles` is set), so the handle only exists where
 * PowerPoint puts one.
 *
 * This module is the thin descriptor -> stage-box mapping, kept out of
 * `slide-canvas.component.ts` so the component stays view wiring and the maths
 * stays unit-testable without Angular.
 *
 * @module viewer/shape-adjust-handle
 */
import type { PptxElement } from 'pptx-viewer-core';

import {
	getDraggedShapeAdjustmentValue,
	getShapeAdjustmentHandleDescriptor,
} from '../internal/shared';
import type { ShapeAdjustmentDragState } from '../internal/shared';
import type { Box } from './drag-resize';

/** The adjustment handle's render box in STAGE (unscaled slide) coordinates. */
export interface AdjustHandleBox {
	/** The `a:avLst` guide name the drag writes (`shapeAdjustments[key]`). */
	key: string;
	left: number;
	top: number;
	size: number;
	cursor: string;
	/** The element's current adjustment value (0..50000), seeding a drag. */
	value: number;
}

/**
 * The adjustment handle box for the single selection, or null when the element
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
export function computeAdjustHandle(
	element: PptxElement | null | undefined,
	box: (Box & { id: string }) | null,
	editable: boolean,
	handleScreenPx: number,
	zoom: number,
): AdjustHandleBox | null {
	if (!editable || !element || !box) {
		return null;
	}
	const descriptor = getShapeAdjustmentHandleDescriptor(element);
	if (!descriptor) {
		return null;
	}
	const size = handleScreenPx / (zoom || 1);
	return {
		key: descriptor.key,
		left: box.x + descriptor.left - size / 2,
		top: box.y + descriptor.top - size / 2,
		size,
		cursor: descriptor.cursor,
		value: descriptor.value,
	};
}

/**
 * Capture the drag state for an adjustment gesture starting on `element`.
 *
 * `shapeType` is lower-cased here because
 * {@link getDraggedShapeAdjustmentValue} compares it to the normalised preset
 * name; a raw `'roundRect'` would silently return the start value and the drag
 * would do nothing.
 */
export function beginShapeAdjustmentDrag(
	element: PptxElement,
	handle: AdjustHandleBox,
	clientX: number,
	clientY: number,
): ShapeAdjustmentDragState {
	const shaped = element as PptxElement & { shapeType?: string };
	return {
		elementId: element.id,
		key: handle.key,
		shapeType: String(shaped.shapeType ?? '').toLowerCase(),
		startClientX: clientX,
		startClientY: clientY,
		startAdjustment: handle.value,
		startWidth: element.width,
		startHeight: element.height,
		moved: false,
	};
}

/**
 * The adjustment value for the pointer's current screen position.
 *
 * The horizontal travel is converted from screen pixels into SLIDE pixels
 * first, because the shared solver measures the delta against the element's own
 * (unscaled) box; feeding it raw screen pixels would make the corner radius
 * track the zoom level.
 */
export function draggedAdjustmentValue(
	state: ShapeAdjustmentDragState,
	clientX: number,
	zoom: number,
): number {
	return getDraggedShapeAdjustmentValue(state, (clientX - state.startClientX) / (zoom || 1));
}
