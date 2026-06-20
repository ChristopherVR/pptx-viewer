/**
 * useSwipeNavigation: Horizontal-swipe slide navigation for touch devices.
 *
 * Returns `touchstart`/`touchend` handlers to spread onto a container. A
 * predominantly horizontal drag past the threshold fires `onNext` (swipe left)
 * or `onPrev` (swipe right). Vertical-dominant gestures are ignored so the user
 * can still scroll. When `enabled` is false the handlers are no-ops, which lets
 * callers disable swipe-nav while editing (where touch gestures belong to
 * element drag/resize) without changing the JSX.
 */
import { useCallback, useRef } from 'react';
import type React from 'react';

/** Minimum horizontal travel (px) required to treat a drag as a navigation swipe. */
const SWIPE_THRESHOLD = 50;

export interface UseSwipeNavigationInput {
	/** Whether swipe navigation is active. */
	enabled: boolean;
	/** Advance to the next slide (swipe left). */
	onNext: () => void;
	/** Go to the previous slide (swipe right). */
	onPrev: () => void;
}

export interface UseSwipeNavigationResult {
	onTouchStart: (e: React.TouchEvent) => void;
	onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipeNavigation(input: UseSwipeNavigationInput): UseSwipeNavigationResult {
	const { enabled, onNext, onPrev } = input;
	const startRef = useRef<{ x: number; y: number } | null>(null);

	const onTouchStart = useCallback(
		(e: React.TouchEvent) => {
			if (!enabled || e.changedTouches.length !== 1) {
				startRef.current = null;
				return;
			}
			const touch = e.changedTouches[0];
			startRef.current = { x: touch.clientX, y: touch.clientY };
		},
		[enabled],
	);

	const onTouchEnd = useCallback(
		(e: React.TouchEvent) => {
			const start = startRef.current;
			startRef.current = null;
			if (!enabled || start === null || e.changedTouches.length !== 1) {
				return;
			}
			const touch = e.changedTouches[0];
			const dx = touch.clientX - start.x;
			const dy = touch.clientY - start.y;
			// Require a mostly-horizontal gesture past the threshold; ignore scrolls.
			if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) {
				return;
			}
			if (dx < 0) {
				onNext();
			} else {
				onPrev();
			}
		},
		[enabled, onNext, onPrev],
	);

	return { onTouchStart, onTouchEnd };
}
