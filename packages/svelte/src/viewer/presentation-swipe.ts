import { createTouchGestureRecognizer } from 'pptx-viewer-shared';

export interface PresentationSwipeOptions {
	isEnabled(): boolean;
	onNext(): void;
	onPrevious(): void;
}

/** Svelte action that adds touch slide navigation to the presentation root. */
export function presentationSwipe(node: HTMLElement, initial: PresentationSwipeOptions) {
	let options = initial;
	const recognizer = createTouchGestureRecognizer({
		getScale: () => 1,
		minScale: 0.1,
		maxScale: 8,
		callbacks: {
			onPinchZoom: () => undefined,
			onSwipe: (direction) => {
				if (!options.isEnabled()) {
					return;
				}
				if (direction === -1) {
					options.onNext();
				} else {
					options.onPrevious();
				}
			},
		},
	});
	const start = (event: TouchEvent) => recognizer.onTouchStart(event);
	const move = (event: TouchEvent) => recognizer.onTouchMove(event);
	const end = (event: TouchEvent) => recognizer.onTouchEnd(event);
	const cancel = () => recognizer.onTouchCancel();
	node.addEventListener('touchstart', start, { passive: false, capture: true });
	node.addEventListener('touchmove', move, { passive: false, capture: true });
	node.addEventListener('touchend', end, { passive: true, capture: true });
	node.addEventListener('touchcancel', cancel, { passive: true, capture: true });

	return {
		update(next: PresentationSwipeOptions) {
			options = next;
		},
		destroy() {
			node.removeEventListener('touchstart', start, true);
			node.removeEventListener('touchmove', move, true);
			node.removeEventListener('touchend', end, true);
			node.removeEventListener('touchcancel', cancel, true);
			recognizer.cancel();
		},
	};
}
