/**
 * Pure helpers for the slide-sorter overlay thumbnail grid.
 *
 * No Angular imports, safe to use in both component and vitest contexts.
 */

/**
 * Compute the zoom level needed to fit a slide canvas whose natural width is
 * `canvasW` pixels into a thumbnail box that is `thumbW` pixels wide.
 *
 * Returns 0 when either argument is non-positive or non-finite so callers can
 * guard against divide-by-zero before applying the value.
 */
export function thumbnailZoom(canvasW: number, thumbW: number): number {
	if (!Number.isFinite(canvasW) || !Number.isFinite(thumbW) || canvasW <= 0 || thumbW <= 0) {
		return 0;
	}
	return thumbW / canvasW;
}

/**
 * Compute the pixel height of an aspect-correct thumbnail box given the
 * natural canvas dimensions and the target thumbnail width.
 *
 * Returns 0 when any argument is non-positive or non-finite.
 */
export function thumbnailHeight(canvasW: number, canvasH: number, thumbW: number): number {
	const zoom = thumbnailZoom(canvasW, thumbW);
	if (zoom === 0 || !Number.isFinite(canvasH) || canvasH <= 0) {
		return 0;
	}
	return canvasH * zoom;
}

/**
 * Derive the number of grid columns from the container width and the target
 * thumbnail width plus a minimum gap.
 *
 * Clamps the result to [1, maxCols] so the grid always has at least one column.
 */
export function gridColumns(
	containerW: number,
	thumbW: number,
	gap: number,
	maxCols: number,
): number {
	if (containerW <= 0 || thumbW <= 0) {
		return 1;
	}
	const cols = Math.floor((containerW + gap) / (thumbW + gap));
	return Math.min(Math.max(1, cols), Math.max(1, maxCols));
}
