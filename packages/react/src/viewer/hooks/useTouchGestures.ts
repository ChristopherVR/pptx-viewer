import {
	createTouchGestureRecognizer,
	getTouchDistance,
	clampScale as clampScaleShared,
	SWIPE_THRESHOLD_PX,
	SWIPE_MAX_VERTICAL_PX,
	LONG_PRESS_DURATION_MS,
	LONG_PRESS_MOVE_TOLERANCE_PX,
} from 'pptx-viewer-shared';
import type { TouchGestureCallbacks } from 'pptx-viewer-shared';
/**
 * useTouchGestures: Multi-touch gesture detection for the viewer canvas.
 *
 * Supports:
 *   - **Pinch-to-zoom**: Two-finger spread/pinch to zoom in/out.
 *   - **Swipe**: Single-finger horizontal swipe (for slide navigation in
 *     presentation mode).
 *   - **Long-press**: Single-finger press held for 500ms (context menu trigger).
 *
 * The gesture state machine itself is framework-agnostic and lives in
 * `pptx-viewer-shared` (`createTouchGestureRecognizer`); this hook only owns the
 * React lifecycle: attaching native `touch*` listeners with `{ passive: false }`
 * so the recogniser can call `preventDefault()` to suppress the browser's
 * default pinch-zoom, and re-attaching them when the target node identity
 * changes.
 *
 * @module useTouchGestures
 */
import { useEffect, useRef, useState } from 'react';

import { MIN_ZOOM_SCALE, MAX_ZOOM_SCALE } from '../constants';

// ---------------------------------------------------------------------------
// Re-exports (kept stable for consumers and existing tests)
// ---------------------------------------------------------------------------

export {
	getTouchDistance,
	SWIPE_THRESHOLD_PX,
	SWIPE_MAX_VERTICAL_PX,
	LONG_PRESS_DURATION_MS,
	LONG_PRESS_MOVE_TOLERANCE_PX,
};
export type { TouchGestureCallbacks };

/** Clamp a scale value to the viewer's allowed zoom range. */
export function clampScale(value: number): number {
	return clampScaleShared(value, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseTouchGesturesInput {
	/** The element to attach touch listeners to. */
	targetRef: React.RefObject<HTMLElement | null>;
	/** Current zoom scale: used as the baseline for pinch gestures. */
	currentScale: number;
	/** Callbacks for gesture events. */
	callbacks: TouchGestureCallbacks;
	/** Set to false to disable all gesture handling. Default: true. */
	enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTouchGestures(input: UseTouchGesturesInput): void {
	const { targetRef, currentScale, callbacks, enabled = true } = input;
	const callbacksRef = useRef(callbacks);
	callbacksRef.current = callbacks;

	const scaleRef = useRef(currentScale);
	scaleRef.current = currentScale;

	// React refs are mutable but don't trigger re-renders when their `current`
	// is reassigned. If the underlying DOM node is replaced (e.g., conditional
	// rendering swaps the canvas wrapper), our effect would never re-attach
	// listeners because its deps array hasn't changed.
	//
	// Mitigation: poll `targetRef.current` on every render via state, and when
	// the node identity changes, bump `targetVersion` so the listener-attaching
	// effect re-runs. This keeps the public API (a RefObject) intact while
	// behaving like a callback ref.
	const [targetVersion, setTargetVersion] = useState(0);
	const lastTargetRef = useRef<HTMLElement | null>(null);
	if (targetRef.current !== lastTargetRef.current) {
		lastTargetRef.current = targetRef.current;
		// Schedule a re-run on next microtask (avoid setState during render).
		queueMicrotask(() => setTargetVersion((v) => v + 1));
	}

	useEffect(() => {
		const el = targetRef.current;
		if (!el || !enabled) {
			return;
		}

		const recognizer = createTouchGestureRecognizer({
			getScale: () => scaleRef.current,
			minScale: MIN_ZOOM_SCALE,
			maxScale: MAX_ZOOM_SCALE,
			callbacks: {
				onPinchZoom: (newScale) => callbacksRef.current.onPinchZoom?.(newScale),
				onSwipe: (direction) => callbacksRef.current.onSwipe?.(direction),
				onLongPress: (x, y) => callbacksRef.current.onLongPress?.(x, y),
			},
		});

		const handleTouchStart = (e: TouchEvent) => recognizer.onTouchStart(e);
		const handleTouchMove = (e: TouchEvent) => recognizer.onTouchMove(e);
		const handleTouchEnd = (e: TouchEvent) => recognizer.onTouchEnd(e);
		const handleTouchCancel = () => recognizer.onTouchCancel();

		el.addEventListener('touchstart', handleTouchStart, { passive: false });
		el.addEventListener('touchmove', handleTouchMove, { passive: false });
		el.addEventListener('touchend', handleTouchEnd, { passive: true });
		el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

		return () => {
			el.removeEventListener('touchstart', handleTouchStart);
			el.removeEventListener('touchmove', handleTouchMove);
			el.removeEventListener('touchend', handleTouchEnd);
			el.removeEventListener('touchcancel', handleTouchCancel);
			recognizer.cancel();
		};
		// targetVersion changes when the underlying DOM node identity changes,
		// triggering listener re-attachment.
	}, [targetRef, enabled, targetVersion]);
}
