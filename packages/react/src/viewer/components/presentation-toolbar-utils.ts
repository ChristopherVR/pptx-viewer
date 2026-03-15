/**
 * presentation-toolbar-utils
 *
 * Pure utility functions for the PresentationToolbar component.
 * Extracted for testability — visibility logic, elapsed time formatting, etc.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Toolbar auto-hides after this many milliseconds of no mouse movement. */
export const AUTO_HIDE_DELAY_MS = 3000;

/**
 * The toolbar is shown when the mouse is within this fraction of the screen
 * height from the bottom (e.g., 0.15 = bottom 15%).
 */
export const BOTTOM_TRIGGER_FRACTION = 0.15;

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

/**
 * Determines whether the toolbar should become visible based on the mouse
 * position relative to the container.
 *
 * @param mouseY - The clientY coordinate of the mouse event.
 * @param containerHeight - The height of the presentation container in pixels.
 * @param containerTop - The top offset of the container (getBoundingClientRect().top).
 * @returns `true` if the mouse is in the bottom trigger zone.
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

/**
 * Determines whether the auto-hide timer should fire based on how much time
 * has elapsed since the last mouse movement.
 *
 * @param lastMoveTimestamp - `Date.now()` of the last mouse movement.
 * @param now - The current `Date.now()` value.
 * @returns `true` if enough time has passed to auto-hide.
 */
export function shouldAutoHide(
  lastMoveTimestamp: number,
  now: number,
): boolean {
  return now - lastMoveTimestamp >= AUTO_HIDE_DELAY_MS;
}

/**
 * Formats a slide counter string like "3 / 12".
 *
 * @param currentSlide - Zero-based slide index.
 * @param totalSlides - Total number of slides.
 */
export function formatSlideCounter(
  currentSlide: number,
  totalSlides: number,
): string {
  return `${currentSlide + 1} / ${totalSlides}`;
}
