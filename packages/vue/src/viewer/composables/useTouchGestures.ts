import { createTouchGestureRecognizer } from 'pptx-viewer-shared';
import type { TouchGestureCallbacks } from 'pptx-viewer-shared';
import { onScopeDispose, unref, watch } from 'vue';
import type { Ref } from 'vue';

/**
 * `useTouchGestures`: attach the shared multi-touch gesture recogniser to a
 * canvas element on touch devices.
 *
 * The gesture state machine itself is framework-agnostic and lives in
 * `pptx-viewer-shared` (`createTouchGestureRecognizer`); this composable only
 * owns the Vue lifecycle: attaching native `touch*` listeners with
 * `{ passive: false }` for `touchstart` / `touchmove` so the recogniser can call
 * `preventDefault()` to suppress the browser's default pinch-zoom, attaching
 * `touchend` / `touchcancel` passively, and re-attaching when the target node
 * identity changes. Mirrors the React `useTouchGestures` hook wiring.
 *
 * Supports:
 *   - Pinch-to-zoom: two-finger spread/pinch to zoom in/out.
 *   - Swipe: single-finger horizontal swipe (slide navigation in present mode).
 *   - Long-press: single-finger hold for 500ms (context-menu trigger).
 *
 * @module useTouchGestures
 */

export interface UseTouchGesturesInput {
	/** The element to attach touch listeners to (reactive ref). */
	targetRef: Ref<HTMLElement | null>;
	/** Current zoom scale: used as the baseline for pinch gestures (reactive). */
	currentScale: Ref<number>;
	/** Minimum zoom scale for clamping. */
	minScale: number;
	/** Maximum zoom scale for clamping. */
	maxScale: number;
	/** Callbacks for gesture events. */
	callbacks: TouchGestureCallbacks;
	/** Set to a falsey ref/value to disable all gesture handling. Default: enabled. */
	enabled?: Ref<boolean> | boolean;
}

export function useTouchGestures(input: UseTouchGesturesInput): void {
	const { targetRef, currentScale, minScale, maxScale, callbacks, enabled = true } = input;

	let detach: (() => void) | null = null;

	const teardown = (): void => {
		detach?.();
		detach = null;
	};

	const attach = (el: HTMLElement): void => {
		const recognizer = createTouchGestureRecognizer({
			// Read the current scale lazily so each pinch uses the live baseline.
			getScale: () => currentScale.value,
			minScale,
			maxScale,
			callbacks: {
				onPinchZoom: (newScale) => callbacks.onPinchZoom?.(newScale),
				onSwipe: (direction) => callbacks.onSwipe?.(direction),
				onLongPress: (x, y) => callbacks.onLongPress?.(x, y),
			},
		});

		const onStart = (e: TouchEvent): void => recognizer.onTouchStart(e);
		const onMove = (e: TouchEvent): void => recognizer.onTouchMove(e);
		const onEnd = (e: TouchEvent): void => recognizer.onTouchEnd(e);
		const onCancel = (): void => recognizer.onTouchCancel();

		// `{ passive: false }` on start/move so the recogniser may call
		// `preventDefault()` to suppress the browser's native pinch-zoom.
		el.addEventListener('touchstart', onStart, { passive: false });
		el.addEventListener('touchmove', onMove, { passive: false });
		el.addEventListener('touchend', onEnd, { passive: true });
		el.addEventListener('touchcancel', onCancel, { passive: true });

		detach = (): void => {
			el.removeEventListener('touchstart', onStart);
			el.removeEventListener('touchmove', onMove);
			el.removeEventListener('touchend', onEnd);
			el.removeEventListener('touchcancel', onCancel);
			recognizer.cancel();
		};
	};

	// Re-attach whenever the target node identity or the enabled flag changes.
	watch(
		[() => targetRef.value, () => unref(enabled)],
		([el, isEnabled]) => {
			teardown();
			if (el && isEnabled) {
				attach(el);
			}
		},
		{ immediate: true },
	);

	onScopeDispose(teardown);
}
