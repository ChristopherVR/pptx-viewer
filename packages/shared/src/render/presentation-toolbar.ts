/**
 * presentation-toolbar.ts: pure presentation-toolbar helpers shared across
 * bindings.
 *
 * Visibility (bottom-trigger-zone) math, auto-hide timing, pen/highlighter
 * colour swatches, and slide-counter formatting. The pointer listeners and
 * timers stay in each binding.
 */

/** Toolbar auto-hides after this many milliseconds of no mouse movement. */
export const AUTO_HIDE_DELAY_MS = 3000;

/**
 * The toolbar is shown when the mouse is within this fraction of the screen
 * height from the bottom (e.g., 0.15 = bottom 15%).
 */
export const BOTTOM_TRIGGER_FRACTION = 0.15;

/** Pen-tool colour swatches. */
export const PEN_COLORS = [
	'#ff0000',
	'#0000ff',
	'#00aa00',
	'#ff8800',
	'#ffffff',
	'#000000',
	'#ff00ff',
	'#00cccc',
];

/** Highlighter-tool colour swatches. */
export const HIGHLIGHTER_COLORS = [
	'#ffff00',
	'#00ff00',
	'#ff69b4',
	'#00bfff',
	'#ff8c00',
	'#adff2f',
	'#ff6347',
	'#87ceeb',
];

/**
 * Whether the toolbar should become visible based on mouse position relative to
 * the container's bottom trigger zone.
 */
export function isInBottomTriggerZone(
	mouseY: number,
	containerHeight: number,
	containerTop: number,
): boolean {
	const relativeY = mouseY - containerTop;
	const threshold = containerHeight * (1 - BOTTOM_TRIGGER_FRACTION);
	return relativeY >= threshold && relativeY <= containerHeight;
}

/** Whether enough time has passed since the last move to auto-hide. */
export function shouldAutoHide(lastMoveTimestamp: number, now: number): boolean {
	return now - lastMoveTimestamp >= AUTO_HIDE_DELAY_MS;
}

/** Format a slide counter string like `"3 / 12"` (one-based). */
export function formatSlideCounter(currentSlide: number, totalSlides: number): string {
	return `${currentSlide + 1} / ${totalSlides}`;
}
