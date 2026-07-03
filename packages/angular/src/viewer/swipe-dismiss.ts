/**
 * swipe-dismiss.ts: Reusable pointer-drag-to-dismiss gesture for a docked
 * sheet/panel that lives in normal document flow (not a fixed overlay), so a
 * downward swipe is surfaced as a live drag offset (applied via a CSS
 * transform) rather than relying on a native overlay's dismiss gesture.
 *
 * Shared by the mobile notes sheet and the mobile inspector host in
 * {@link PowerPointViewerComponent}, which both need identical drag-to-dismiss
 * behaviour, differing only in what happens once the drag clears the
 * threshold (their own `onDismiss` callback).
 */

import { signal } from '@angular/core';

/** Downward drag distance (px) past which releasing the pointer dismisses. Matches `pptx-mobile-sheet`'s DISMISS_THRESHOLD. */
const DISMISS_THRESHOLD_PX = 120;

/** Live drag state + pointer handlers for one swipe-to-dismiss surface. */
export interface SwipeDismissDrag {
	/** Live downward drag offset (px; 0 when idle). */
	readonly dragY: () => number;
	/** True while a drag is in progress (disables the snap-back transition). */
	readonly dragging: () => boolean;
	onPointerDown(event: PointerEvent): void;
	onPointerMove(event: PointerEvent): void;
	onPointerUp(event: PointerEvent): void;
}

/**
 * Create an independent swipe-to-dismiss drag tracker. `onDismiss` fires once,
 * on pointer-up, when the downward drag exceeded {@link DISMISS_THRESHOLD_PX}.
 */
export function createSwipeDismissDrag(onDismiss: () => void): SwipeDismissDrag {
	const dragYSignal = signal(0);
	const draggingSignal = signal(false);
	let startY: number | null = null;

	return {
		dragY: dragYSignal,
		dragging: draggingSignal,
		onPointerDown(event: PointerEvent): void {
			startY = event.clientY;
			draggingSignal.set(true);
			(event.target as HTMLElement).setPointerCapture?.(event.pointerId);
		},
		onPointerMove(event: PointerEvent): void {
			if (startY === null) {
				return;
			}
			dragYSignal.set(Math.max(0, event.clientY - startY));
		},
		onPointerUp(event: PointerEvent): void {
			if (startY === null) {
				return;
			}
			const delta = event.clientY - startY;
			startY = null;
			draggingSignal.set(false);
			(event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
			if (delta > DISMISS_THRESHOLD_PX) {
				onDismiss();
			}
			dragYSignal.set(0);
		},
	};
}
