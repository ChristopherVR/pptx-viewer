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
 * `handleCursor` / `handleAnchor` are render-display helpers used only by the
 * Angular SlideCanvas, so they stay local here rather than in shared.
 */
import {
	applyDragDelta as sharedApplyDragDelta,
	applyResize as sharedApplyResize,
	computeMarqueeHitIds as sharedComputeMarqueeHitIds,
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
	switch (handle) {
		case 'n':
		case 's':
			return 'ns-resize';
		case 'e':
		case 'w':
			return 'ew-resize';
		case 'nw':
		case 'se':
			return 'nwse-resize';
		default:
			return 'nesw-resize';
	}
}

/** Handle anchor as fractions (0..1) of the box, for positioning the handle. */
export function handleAnchor(handle: ResizeHandle): { fx: number; fy: number } {
	const fx = handle.includes('w') ? 0 : handle.includes('e') ? 1 : 0.5;
	const fy = handle.includes('n') ? 0 : handle.includes('s') ? 1 : 0.5;
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
