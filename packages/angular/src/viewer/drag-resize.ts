/**
 * Pure geometry for interactive element drag/resize.
 *
 * Thin Angular-facing shim over the shared `element-interaction` math. The
 * shared helpers carry a `zoom` and an optional `rotation`; the SlideCanvas
 * already divides pointer deltas by the zoom before calling these and works in
 * un-rotated stage space, so the shim adapts the call (zoom = 1, axis-aligned
 * box) and returns a plain `Box` (no `rotation` field) to keep the existing
 * call sites and tests unchanged.
 *
 * `handleCursor` / `handleAnchor` keep their Angular-facing signatures because
 * the SlideCanvas template calls them, but they now read the shared handle
 * table rather than restating it: this file used to derive the cursor from a
 * `switch` and the anchor from string matching, which is a fourth spelling of
 * eight constants the other bindings each kept their own copy of.
 */
import {
	applyDragDelta as sharedApplyDragDelta,
	applyResize as sharedApplyResize,
	computeMarqueeHitIds as sharedComputeMarqueeHitIds,
	RESIZE_HANDLE_GEOMETRY,
	RESIZE_HANDLES as SHARED_RESIZE_HANDLES,
} from '../internal/shared';
import type { MarqueeElementRect, ResizeHandleId } from '../internal/shared';

/** The eight resize-handle positions around a selection box. */
export type ResizeHandle = ResizeHandleId;

/** An axis-aligned box in stage (slide) coordinates. */
export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** All handles, in render order (corners + edge midpoints). */
export const RESIZE_HANDLES: readonly ResizeHandle[] = SHARED_RESIZE_HANDLES;

/** Minimum element size (px) a resize is clamped to. */
export const MIN_RESIZE = 8;

/** CSS cursor for a handle. */
export function handleCursor(handle: ResizeHandle): string {
	return RESIZE_HANDLE_GEOMETRY[handle].cursor;
}

/** Handle anchor as fractions (0..1) of the box, for positioning the handle. */
export function handleAnchor(handle: ResizeHandle): { fx: number; fy: number } {
	const { fx, fy } = RESIZE_HANDLE_GEOMETRY[handle];
	return { fx, fy };
}

/** Translate a box by a stage-space delta. */
export function applyMove(start: Box, dx: number, dy: number): Box {
	const r = sharedApplyDragDelta(start, dx, dy, 1);
	return { x: r.x, y: r.y, width: r.width, height: r.height };
}

/**
 * Resize `start` by dragging `handle` with a stage-space delta, clamping to
 * `min`. When clamping at the min size, the edge opposite the dragged handle
 * stays fixed.
 */
export function applyResize(
	start: Box,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	min: number = MIN_RESIZE,
): Box {
	const r = sharedApplyResize(start, handle, dx, dy, 1, { minSize: min });
	return { x: r.x, y: r.y, width: r.width, height: r.height };
}

/**
 * Element ids hit by an already-normalised marquee rectangle (stage-space
 * `{x, y, width, height}`), in element array order.
 *
 * Adapts the shared corner-based `computeMarqueeHitIds` to the SlideCanvas's
 * normalised rect. `minSize` is 0 here (the SlideCanvas does not clamp tiny
 * elements during marquee selection), preserving the previous inline AABB
 * filter's behaviour.
 */
export function marqueeHitIds(rect: Box, elements: readonly MarqueeElementRect[]): string[] {
	return sharedComputeMarqueeHitIds(
		{
			startX: rect.x,
			startY: rect.y,
			currentX: rect.x + rect.width,
			currentY: rect.y + rect.height,
		},
		elements,
		0,
	);
}
