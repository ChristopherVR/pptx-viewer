import { createTouchGestureRecognizer } from 'pptx-viewer-shared';

/** Vanilla's zoom bounds, shared with the regular zoom controls. */
const MIN_ZOOM_SCALE = 0.1;
const MAX_ZOOM_SCALE = 8;

export interface TouchGestureHandlers {
	/** Read the current effective scale, including fit-to-viewport resolution. */
	getScale(): number;
	/** Persist a concrete scale after a two-finger pinch. */
	onPinchZoom(scale: number): void;
	/** Whether a one-finger swipe may change slides at this moment. */
	isSwipeEnabled(): boolean;
	onNext(): void;
	onPrevious(): void;
}

/**
 * Attach React-parity touch gestures to the stable viewport node. Pinching is
 * available in every mode; slide swipes deliberately stay disabled while
 * editing so they cannot steal element move/resize gestures.
 */
export function attachTouchGestures(
	target: HTMLElement,
	handlers: TouchGestureHandlers,
): () => void {
	const recognizer = createTouchGestureRecognizer({
		getScale: handlers.getScale,
		minScale: MIN_ZOOM_SCALE,
		maxScale: MAX_ZOOM_SCALE,
		callbacks: {
			onPinchZoom: handlers.onPinchZoom,
			onSwipe: (direction) => {
				if (!handlers.isSwipeEnabled()) {
					return;
				}
				if (direction === -1) {
					handlers.onNext();
				} else {
					handlers.onPrevious();
				}
			},
		},
	});

	const onStart = (event: TouchEvent): void => recognizer.onTouchStart(event);
	const onMove = (event: TouchEvent): void => recognizer.onTouchMove(event);
	const onEnd = (event: TouchEvent): void => recognizer.onTouchEnd(event);
	const onCancel = (): void => recognizer.onTouchCancel();
	target.addEventListener('touchstart', onStart, { passive: false, capture: true });
	target.addEventListener('touchmove', onMove, { passive: false, capture: true });
	target.addEventListener('touchend', onEnd, { passive: true, capture: true });
	target.addEventListener('touchcancel', onCancel, { passive: true, capture: true });

	return () => {
		target.removeEventListener('touchstart', onStart, true);
		target.removeEventListener('touchmove', onMove, true);
		target.removeEventListener('touchend', onEnd, true);
		target.removeEventListener('touchcancel', onCancel, true);
		recognizer.cancel();
	};
}
