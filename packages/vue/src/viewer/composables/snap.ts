/**
 * Snap-to-grid geometry helpers (View ▸ Snap to Grid).
 *
 * PowerPoint snaps a dragged/resized element's position and size to the nearest
 * grid line. Mirrors React's `Math.round(v / gs) * gs` rounding.
 */

/** Round a value to the nearest multiple of `size` (the grid spacing). */
export function snapValue(value: number, size: number): number {
	return Math.round(value / size) * size;
}

/** Geometry box used by the transform payload. */
export interface SnapBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Snap a box's position + size to the grid. Sizes are clamped to at least one
 * grid cell so an element never collapses to zero.
 */
export function snapBox(box: SnapBox, size: number): SnapBox {
	return {
		x: snapValue(box.x, size),
		y: snapValue(box.y, size),
		width: Math.max(size, snapValue(box.width, size)),
		height: Math.max(size, snapValue(box.height, size)),
	};
}
