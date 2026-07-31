/**
 * useSwipeNavigation: horizontal touch swipe across the slide area changes
 * slides, in VIEW mode only.
 *
 * In edit mode the same gesture must drive element drag/resize, so swipe
 * navigation disarms itself while `canEdit` and never hijacks an edit gesture.
 * (Pinch-zoom and long-press go through the shared recogniser in
 * `useTouchGestures`; this stays a plain pair of listeners because it needs the
 * edit-mode gate, not gesture math.)
 */

/** px of horizontal travel before a touch counts as a slide-changing swipe. */
const SWIPE_THRESHOLD = 50;

export interface UseSwipeNavigationOptions {
	/** Getter for edit mode, read at gesture time so a mid-session toggle applies. */
	canEdit: () => boolean;
	goPrev: () => void;
	goNext: () => void;
}

export interface UseSwipeNavigationResult {
	onTouchStart: (event: TouchEvent) => void;
	onTouchEnd: (event: TouchEvent) => void;
}

export function useSwipeNavigation(options: UseSwipeNavigationOptions): UseSwipeNavigationResult {
	let touchStart: { x: number; y: number } | null = null;

	function onTouchStart(event: TouchEvent): void {
		if (options.canEdit()) {
			touchStart = null;
			return;
		}
		const touch = event.changedTouches[0];
		touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
	}

	function onTouchEnd(event: TouchEvent): void {
		const start = touchStart;
		touchStart = null;
		if (!start) {
			return;
		}
		const touch = event.changedTouches[0];
		if (!touch) {
			return;
		}
		const dx = touch.clientX - start.x;
		const dy = touch.clientY - start.y;
		// Require a predominantly-horizontal gesture past the threshold.
		if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) {
			return;
		}
		if (dx < 0) {
			options.goNext();
		} else {
			options.goPrev();
		}
	}

	return { onTouchStart, onTouchEnd };
}
