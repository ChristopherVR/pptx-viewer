import { createTouchGestureRecognizer } from 'pptx-viewer-shared';

export interface CanvasPinchZoomOptions {
	/** Current manual zoom scale (0.2-5); the baseline each pinch gesture scales from. */
	getScale(): number;
	minScale: number;
	maxScale: number;
	onPinchZoom(scale: number): void;
}

/**
 * Svelte action: two-finger pinch-to-zoom on the editor canvas viewport,
 * mirroring Vue's `useTouchGestures` (React/Angular/Vanilla have the same via
 * their own wrappers around the shared recogniser). Svelte had no pinch-zoom
 * path at all on the editor canvas; only presentation mode had a touch
 * gesture (swipe, via `presentation-swipe.ts`).
 *
 * The gesture state machine is framework-agnostic (`pptx-viewer-shared`);
 * this action only owns the native-listener lifecycle, matching
 * `presentationSwipe`'s shape.
 */
export function canvasPinchZoom(node: HTMLElement, initial: CanvasPinchZoomOptions) {
	let options = initial;
	const recognizer = createTouchGestureRecognizer({
		getScale: () => options.getScale(),
		minScale: options.minScale,
		maxScale: options.maxScale,
		callbacks: {
			onPinchZoom: (scale) => options.onPinchZoom(scale),
		},
	});
	const start = (event: TouchEvent) => recognizer.onTouchStart(event);
	const move = (event: TouchEvent) => recognizer.onTouchMove(event);
	const end = (event: TouchEvent) => recognizer.onTouchEnd(event);
	const cancel = () => recognizer.onTouchCancel();
	// `{ passive: false }` on start/move so the recogniser may call
	// `preventDefault()` to suppress the browser's native pinch-zoom.
	node.addEventListener('touchstart', start, { passive: false });
	node.addEventListener('touchmove', move, { passive: false });
	node.addEventListener('touchend', end, { passive: true });
	node.addEventListener('touchcancel', cancel, { passive: true });

	return {
		update(next: CanvasPinchZoomOptions) {
			options = next;
		},
		destroy() {
			node.removeEventListener('touchstart', start);
			node.removeEventListener('touchmove', move);
			node.removeEventListener('touchend', end);
			node.removeEventListener('touchcancel', cancel);
			recognizer.cancel();
		},
	};
}
