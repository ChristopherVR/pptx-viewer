/**
 * Framework-agnostic touch-gesture state machine for the viewer canvas.
 *
 * Recognises three gestures from raw DOM `TouchEvent`s and emits callbacks:
 *   - Pinch-to-zoom: two-finger spread/pinch, scaled by the distance ratio.
 *   - Swipe: single-finger horizontal swipe (slide navigation).
 *   - Long-press: single-finger hold (context-menu trigger).
 *
 * The recogniser holds all mutable pinch/swipe/long-press state internally and
 * exposes four event handlers plus a `cancel()`. The listener attach/detach
 * lifecycle (and any framework reactivity) stays in each binding; only this
 * pure state machine is shared.
 *
 * @module touch-gestures
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The minimum horizontal distance (px) to recognise a swipe. */
export const SWIPE_THRESHOLD_PX = 50;

/** Maximum vertical deviation (px) for a swipe to still count. */
export const SWIPE_MAX_VERTICAL_PX = 100;

/** The hold duration (ms) for a long-press. */
export const LONG_PRESS_DURATION_MS = 500;

/** If the finger moves more than this (px) during a hold, cancel the long-press. */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

// ---------------------------------------------------------------------------
// Structural DOM-event types (decoupled, no lib.dom hard dependency)
// ---------------------------------------------------------------------------

/** The subset of a DOM `Touch` this state machine reads. */
export interface TouchPoint {
	readonly clientX: number;
	readonly clientY: number;
}

/** The subset of a DOM `TouchEvent` this state machine reads. */
export interface TouchEventLike {
	readonly touches: ArrayLike<TouchPoint>;
	readonly changedTouches: ArrayLike<TouchPoint>;
	readonly preventDefault: () => void;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Compute the Euclidean distance between two touch points. */
export function getTouchDistance(t1: TouchPoint, t2: TouchPoint): number {
	const dx = t1.clientX - t2.clientX;
	const dy = t1.clientY - t2.clientY;
	return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Clamp a scale value into the allowed zoom range. The bounds are parameters
 * (not imported constants) to keep this module framework- and binding-agnostic.
 */
export function clampScale(value: number, minScale: number, maxScale: number): number {
	return Math.min(Math.max(value, minScale), maxScale);
}

// ---------------------------------------------------------------------------
// Recogniser config / surface types
// ---------------------------------------------------------------------------

export interface TouchGestureCallbacks {
	/** Called continuously during a pinch gesture with the new (clamped) scale. */
	onPinchZoom?: (newScale: number) => void;
	/** Called when a horizontal swipe is detected. direction: -1 = left, 1 = right. */
	onSwipe?: (direction: -1 | 1) => void;
	/** Called when a long-press is detected, with the press coordinates. */
	onLongPress?: (clientX: number, clientY: number) => void;
}

export interface TouchGestureConfig {
	/** Returns the current zoom scale; used as the baseline for pinch gestures. */
	getScale: () => number;
	/** Minimum zoom scale for clamping. */
	minScale: number;
	/** Maximum zoom scale for clamping. */
	maxScale: number;
	/** Gesture-event callbacks. */
	callbacks: TouchGestureCallbacks;
}

export interface TouchGestureRecognizer {
	readonly onTouchStart: (e: TouchEventLike) => void;
	readonly onTouchMove: (e: TouchEventLike) => void;
	readonly onTouchEnd: (e: TouchEventLike) => void;
	readonly onTouchCancel: () => void;
	/** Cancel any pending long-press timer and reset transient pinch state. */
	readonly cancel: () => void;
}

// ---------------------------------------------------------------------------
// Recogniser factory
// ---------------------------------------------------------------------------

/**
 * Create a stateful touch-gesture recogniser. The returned handlers mirror the
 * React viewer's native `touch*` listeners exactly, including `preventDefault()`
 * on the pinch path and the `setTimeout`-based long-press timer.
 */
export function createTouchGestureRecognizer(config: TouchGestureConfig): TouchGestureRecognizer {
	const { getScale, minScale, maxScale, callbacks } = config;

	// Pinch state.
	let initialPinchDistance = 0;
	let pinchBaseScale = 1;
	let isPinching = false;

	// Swipe state.
	let swipeStartX = 0;
	let swipeStartY = 0;
	// Most recent single-finger position. Lets a swipe still be measured when
	// `touchend` arrives with an empty `changedTouches` list (some synthetic
	// dispatchers, e.g. CDP `Input.dispatchTouchEvent`, omit it). Real
	// browsers always populate `changedTouches`, so their behaviour is
	// unchanged.
	let swipeLastX = 0;
	let swipeLastY = 0;

	// Long-press state.
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressStartX = 0;
	let longPressStartY = 0;

	const cancelLongPress = (): void => {
		if (longPressTimer !== null) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	};

	const onTouchStart = (e: TouchEventLike): void => {
		if (e.touches.length === 2) {
			// Start pinch.
			isPinching = true;
			initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
			pinchBaseScale = getScale();
			cancelLongPress();
			e.preventDefault();
		} else if (e.touches.length === 1) {
			// Potential swipe or long-press.
			swipeStartX = e.touches[0].clientX;
			swipeStartY = e.touches[0].clientY;
			swipeLastX = swipeStartX;
			swipeLastY = swipeStartY;

			longPressStartX = e.touches[0].clientX;
			longPressStartY = e.touches[0].clientY;

			cancelLongPress();
			longPressTimer = setTimeout(() => {
				longPressTimer = null;
				callbacks.onLongPress?.(longPressStartX, longPressStartY);
			}, LONG_PRESS_DURATION_MS);
		}
	};

	const onTouchMove = (e: TouchEventLike): void => {
		if (e.touches.length === 2 && isPinching) {
			e.preventDefault();
			const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
			if (initialPinchDistance > 0) {
				const ratio = currentDistance / initialPinchDistance;
				const newScale = clampScale(pinchBaseScale * ratio, minScale, maxScale);
				callbacks.onPinchZoom?.(newScale);
			}
		} else if (e.touches.length === 1) {
			swipeLastX = e.touches[0].clientX;
			swipeLastY = e.touches[0].clientY;
			// Cancel the long-press if the finger moved too far.
			const dx = e.touches[0].clientX - longPressStartX;
			const dy = e.touches[0].clientY - longPressStartY;
			if (
				Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE_PX ||
				Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE_PX
			) {
				cancelLongPress();
			}
		}
	};

	const onTouchEnd = (e: TouchEventLike): void => {
		if (isPinching) {
			isPinching = false;
			initialPinchDistance = 0;
			return;
		}

		cancelLongPress();

		// Detect a swipe from the touch that just ended, but only once every
		// finger is up. Prefer the lifted touch's coordinates; fall back to the
		// last tracked move position when `changedTouches` is empty (synthetic
		// dispatchers), so a swipe is not silently dropped.
		if (e.touches.length === 0) {
			const endX = e.changedTouches.length >= 1 ? e.changedTouches[0].clientX : swipeLastX;
			const endY = e.changedTouches.length >= 1 ? e.changedTouches[0].clientY : swipeLastY;
			const deltaX = endX - swipeStartX;
			const deltaY = endY - swipeStartY;

			if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX && Math.abs(deltaY) < SWIPE_MAX_VERTICAL_PX) {
				callbacks.onSwipe?.(deltaX > 0 ? 1 : -1);
			}
		}
	};

	const onTouchCancel = (): void => {
		isPinching = false;
		initialPinchDistance = 0;
		cancelLongPress();
	};

	return {
		onTouchStart,
		onTouchMove,
		onTouchEnd,
		onTouchCancel,
		cancel: onTouchCancel,
	};
}
