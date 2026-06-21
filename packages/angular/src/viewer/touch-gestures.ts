/**
 * touch-gestures.ts: thin Angular adapter over the framework-agnostic
 * `createTouchGestureRecognizer` from `pptx-viewer-shared`.
 *
 * The gesture state machine itself (pinch-to-zoom, swipe, long-press) lives in
 * shared and is identical across React / Vue / Angular. This adapter only owns
 * the DOM listener attach/detach lifecycle, mirroring the React hook
 * `packages/react/src/viewer/hooks/useTouchGestures.ts`:
 *   - `touchstart` / `touchmove` are registered with `{ passive: false }` so the
 *     recogniser can call `preventDefault()` to suppress the browser's native
 *     pinch-zoom on the canvas;
 *   - `touchend` / `touchcancel` are passive (they never call preventDefault).
 *
 * `attachTouchGestures(element, config)` returns a teardown function that
 * removes every listener and cancels any pending long-press timer. Components
 * call it from `afterNextRender` (when the target node is live) and run the
 * teardown via `DestroyRef.onDestroy`.
 *
 * @module touch-gestures (angular)
 */
import {
	clampScale as clampScaleShared,
	createTouchGestureRecognizer,
	getTouchDistance,
	LONG_PRESS_DURATION_MS,
	LONG_PRESS_MOVE_TOLERANCE_PX,
	SWIPE_MAX_VERTICAL_PX,
	SWIPE_THRESHOLD_PX,
} from '../internal/shared';
import type { TouchGestureCallbacks } from '../internal/shared';

// ---------------------------------------------------------------------------
// Re-exports (kept stable for consumers and colocated tests)
// ---------------------------------------------------------------------------

export {
	getTouchDistance,
	SWIPE_THRESHOLD_PX,
	SWIPE_MAX_VERTICAL_PX,
	LONG_PRESS_DURATION_MS,
	LONG_PRESS_MOVE_TOLERANCE_PX,
};
export type { TouchGestureCallbacks };

/**
 * Viewer zoom bounds. The Angular viewer clamps zoom to [0.2, 3] (see
 * `ZOOM_MIN` / `ZOOM_MAX` in `power-point-viewer.component.ts`); the pinch path
 * must clamp to the same range so a pinch can never exceed the buttons.
 */
export const MIN_ZOOM_SCALE = 0.2;
export const MAX_ZOOM_SCALE = 3;

/** Clamp a scale value to the Angular viewer's allowed zoom range. */
export function clampScale(value: number): number {
	return clampScaleShared(value, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);
}

/** Configuration for {@link attachTouchGestures}. */
export interface AttachTouchGesturesConfig {
	/** Returns the current zoom scale; used as the baseline for pinch gestures. */
	getScale: () => number;
	/** Gesture-event callbacks (pinch / swipe / long-press). */
	callbacks: TouchGestureCallbacks;
}

/**
 * Attach the shared touch-gesture recogniser to `element` and return a teardown
 * function. Mirrors the React hook's listener lifecycle exactly:
 * `touchstart`/`touchmove` are non-passive (so pinch can `preventDefault`),
 * `touchend`/`touchcancel` are passive.
 */
export function attachTouchGestures(
	element: HTMLElement,
	config: AttachTouchGesturesConfig,
): () => void {
	const recognizer = createTouchGestureRecognizer({
		getScale: config.getScale,
		minScale: MIN_ZOOM_SCALE,
		maxScale: MAX_ZOOM_SCALE,
		callbacks: config.callbacks,
	});

	const onStart = (e: TouchEvent): void => recognizer.onTouchStart(e);
	const onMove = (e: TouchEvent): void => recognizer.onTouchMove(e);
	const onEnd = (e: TouchEvent): void => recognizer.onTouchEnd(e);
	const onCancel = (): void => recognizer.onTouchCancel();

	element.addEventListener('touchstart', onStart, { passive: false });
	element.addEventListener('touchmove', onMove, { passive: false });
	element.addEventListener('touchend', onEnd, { passive: true });
	element.addEventListener('touchcancel', onCancel, { passive: true });

	return () => {
		element.removeEventListener('touchstart', onStart);
		element.removeEventListener('touchmove', onMove);
		element.removeEventListener('touchend', onEnd);
		element.removeEventListener('touchcancel', onCancel);
		recognizer.cancel();
	};
}
