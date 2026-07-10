/**
 * Pure slide-navigation and zoom-step helpers for the Svelte viewer.
 * Kept framework-free so they are trivially unit-testable.
 */

/** Clamp a slide index into `[0, count - 1]` (0 when there are no slides). */
export function clampSlideIndex(index: number, count: number): number {
	if (count <= 0) {
		return 0;
	}
	return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

/** Keyboard-driven navigation intents. */
export type NavigationAction = 'next' | 'prev' | 'first' | 'last';

/**
 * Map a `KeyboardEvent.key` to a navigation action, mirroring the slideshow
 * conventions used by the other bindings (arrows, paging keys, space, Home/End).
 */
export function resolveNavigationKey(key: string): NavigationAction | undefined {
	switch (key) {
		case 'ArrowRight':
		case 'ArrowDown':
		case 'PageDown':
		case ' ':
		case 'Spacebar':
			return 'next';
		case 'ArrowLeft':
		case 'ArrowUp':
		case 'PageUp':
			return 'prev';
		case 'Home':
			return 'first';
		case 'End':
			return 'last';
		default:
			return undefined;
	}
}

/** Zoom bounds and multiplicative step shared by toolbar and shortcuts. */
export const ZOOM_MIN_PERCENT = 25;
export const ZOOM_MAX_PERCENT = 400;
const ZOOM_STEP = 1.25;

/** Next zoom level up from `current` percent, clamped. */
export function zoomInPercent(current: number): number {
	return Math.min(ZOOM_MAX_PERCENT, Math.round(current * ZOOM_STEP));
}

/** Next zoom level down from `current` percent, clamped. */
export function zoomOutPercent(current: number): number {
	return Math.max(ZOOM_MIN_PERCENT, Math.round(current / ZOOM_STEP));
}

/**
 * Fit-to-viewport scale for a canvas inside a viewport, with breathing room.
 * Returns a strictly positive scale (falls back to 1 while unmeasured).
 */
export function fitScale(
	viewportWidth: number,
	viewportHeight: number,
	canvasWidth: number,
	canvasHeight: number,
	padding = 24,
): number {
	if (viewportWidth <= 0 || viewportHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
		return 1;
	}
	const scale = Math.min(
		(viewportWidth - padding * 2) / canvasWidth,
		(viewportHeight - padding * 2) / canvasHeight,
	);
	return scale > 0 ? scale : 1;
}
