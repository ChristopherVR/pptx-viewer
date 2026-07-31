/**
 * presentation-overlay-shell.ts: the browser integrations a running slide show
 * layers on top of its CSS-fixed overlay, namely the touch-gesture recogniser
 * and the real Fullscreen API.
 *
 * Both follow the same shape: attach once the overlay root is live
 * (`afterNextRender`) and release on destroy. They are wiring, not slide-show
 * behaviour, and they were the last two things keeping raw `afterNextRender` /
 * `DestroyRef` plumbing inside {@link PresentationOverlayComponent}. Each
 * function must be called from an injection context (a component constructor),
 * which is why they take no `DestroyRef` argument.
 */
import { DestroyRef, afterNextRender, inject } from '@angular/core';

import {
	exitPresentationFullscreen,
	requestPresentationFullscreen,
} from './presentation-fullscreen';
import { attachTouchGestures } from './touch-gestures';

/** Resolves the overlay's root element once it has rendered. */
export type OverlayRootRef = () => HTMLElement | null | undefined;

/**
 * Wire the shared touch-gesture recogniser to the overlay root so a horizontal
 * swipe navigates: swipe left (direction -1) advances to the next visible
 * slide, swipe right (direction 1) returns to the previous. Pinch is made inert
 * (a constant scale) and there is no long-press in presentation mode.
 *
 * A swipe is PowerPoint's on-click advance, so the FORWARD case is handed to
 * `onSwipeForward` (which the caller gates on the slide's `advanceOnClick`);
 * a backward swipe is explicit navigation and is never gated.
 */
export function setupPresentationTouchGestures(
	root: OverlayRootRef,
	handlers: { onSwipeForward: () => void; onSwipeBackward: () => void },
): void {
	const destroyRef = inject(DestroyRef);
	afterNextRender(() => {
		const el = root();
		if (!el) {
			return;
		}
		const teardown = attachTouchGestures(el, {
			getScale: () => 1,
			callbacks: {
				onSwipe: (direction) => {
					if (direction === 1) {
						handlers.onSwipeBackward();
					} else {
						handlers.onSwipeForward();
					}
				},
			},
		});
		destroyRef.onDestroy(teardown);
	});
}

/**
 * Request real fullscreen on the overlay root once it mounts, and release it
 * again when the overlay is destroyed. Mirrors Vue's `onMounted` /
 * `onBeforeUnmount` pair on its own overlay root; feature-detected, so
 * unsupported environments (iOS Safari's partial support, jsdom in tests)
 * degrade silently to the plain CSS overlay.
 */
export function setupPresentationFullscreen(root: OverlayRootRef): void {
	const destroyRef = inject(DestroyRef);
	afterNextRender(() => {
		requestPresentationFullscreen(root());
	});
	destroyRef.onDestroy(() => {
		exitPresentationFullscreen(typeof document === 'undefined' ? null : document);
	});
}
