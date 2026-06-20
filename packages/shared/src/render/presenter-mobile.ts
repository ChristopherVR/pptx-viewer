/**
 * presenter-mobile.ts
 *
 * Framework-agnostic geometry, labels, and time formatting for the
 * mobile-adapted presenter view (a single-column phone layout shown when the
 * speaker enters presenter/speaker view on a small screen). The desktop
 * presenter view keeps its own split-screen helpers per binding; these pure
 * helpers cover only the phone layout so React, Vue, and Angular can all share
 * one implementation.
 *
 * Pure TypeScript (no framework imports, no DOM). Each binding renders the
 * returned values into its own template / JSX.
 *
 * @module presenter-mobile
 */

// ---------------------------------------------------------------------------
// Next-slide thumbnail geometry
// ---------------------------------------------------------------------------

/**
 * Target on-screen width (CSS px) for the small "next slide" thumbnail in the
 * mobile presenter layout. The thumbnail is rendered by scaling the full
 * canvas down to this width; the height follows from the canvas aspect ratio.
 */
export const MOBILE_NEXT_THUMB_WIDTH = 132;

/** A scaled thumbnail box (CSS px) plus the scale factor used to derive it. */
export interface MobileThumbSize {
	/** Thumbnail width in CSS px. */
	width: number;
	/** Thumbnail height in CSS px (canvas height * scale). */
	height: number;
	/** Scale factor applied to the full canvas to reach `width`. */
	scale: number;
}

/**
 * Compute the next-slide thumbnail box for the mobile presenter, scaling a
 * `canvasWidth x canvasHeight` slide down to {@link MOBILE_NEXT_THUMB_WIDTH}.
 * Falls back to a 1:1 box of the target width when the canvas size is unknown
 * (non-positive), so callers never divide by zero or produce NaN.
 */
export function mobileNextThumbSize(
	canvasWidth: number,
	canvasHeight: number,
	targetWidth: number = MOBILE_NEXT_THUMB_WIDTH,
): MobileThumbSize {
	if (canvasWidth <= 0 || canvasHeight <= 0) {
		return { width: targetWidth, height: targetWidth, scale: 1 };
	}
	const scale = targetWidth / canvasWidth;
	return {
		width: targetWidth,
		height: canvasHeight * scale,
		scale,
	};
}

// ---------------------------------------------------------------------------
// Slide-counter labels
// ---------------------------------------------------------------------------

/**
 * Compact "3 / 12" slide-counter label for the mobile presenter header. Uses a
 * one-based current index; renders "0 / 0" when the deck is empty.
 */
export function mobileSlideCounter(currentIndex: number, total: number): string {
	if (total <= 0) {
		return '0 / 0';
	}
	return `${currentIndex + 1} / ${total}`;
}

/**
 * Whether the deck is on its first slide (used to disable the "previous"
 * control). Negative indices are treated as the first slide.
 */
export function isFirstSlide(currentIndex: number): boolean {
	return currentIndex <= 0;
}

/**
 * Whether the deck is on its last slide (used to disable the "next" control).
 * An out-of-range index past the end also counts as the last slide.
 */
export function isLastSlide(currentIndex: number, total: number): boolean {
	return currentIndex >= total - 1;
}

// ---------------------------------------------------------------------------
// Elapsed-time formatting
// ---------------------------------------------------------------------------

/** Zero-pad a non-negative integer to at least two digits. */
function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

/**
 * Compute the elapsed milliseconds between `startTime` (epoch ms, or null when
 * the presentation has not started) and `now`. Returns 0 when no start time is
 * set or the clock has not advanced past the start.
 */
export function mobileElapsedSince(startTime: number | null, now: number): number {
	if (startTime === null || startTime === undefined) {
		return 0;
	}
	const delta = now - startTime;
	return delta > 0 ? delta : 0;
}

/**
 * Format a millisecond duration as `MM:SS`, or `HH:MM:SS` once the elapsed
 * time reaches one hour. Sub-second values are floored; negative inputs are
 * treated as zero. Mirrors the desktop presenter `formatElapsed` so the mobile
 * timer reads identically.
 */
export function formatMobileElapsed(elapsedMs: number): string {
	const safeMs = elapsedMs > 0 ? elapsedMs : 0;
	const totalSeconds = Math.floor(safeMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
	}
	return `${pad2(minutes)}:${pad2(seconds)}`;
}
