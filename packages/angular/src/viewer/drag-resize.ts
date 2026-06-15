/**
 * Pure geometry for interactive element drag/resize.
 *
 * Stage-space deltas in, a new bounding box out — no DOM, no framework, so the
 * SlideCanvas pointer wiring stays thin and the maths is unit-testable.
 */

/** The eight resize-handle positions around a selection box. */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** An axis-aligned box in stage (slide) coordinates. */
export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** All handles, in render order (corners + edge midpoints). */
export const RESIZE_HANDLES: readonly ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

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
	return { x: start.x + dx, y: start.y + dy, width: start.width, height: start.height };
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
	let { x, y, width, height } = start;

	if (handle.includes('e')) {
		width = start.width + dx;
	}
	if (handle.includes('s')) {
		height = start.height + dy;
	}
	if (handle.includes('w')) {
		width = start.width - dx;
		x = start.x + dx;
	}
	if (handle.includes('n')) {
		height = start.height - dy;
		y = start.y + dy;
	}

	if (width < min) {
		if (handle.includes('w')) {
			x = start.x + start.width - min;
		}
		width = min;
	}
	if (height < min) {
		if (handle.includes('n')) {
			y = start.y + start.height - min;
		}
		height = min;
	}

	return { x, y, width, height };
}
