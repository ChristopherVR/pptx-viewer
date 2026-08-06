/**
 * viewer-touch-gestures.service.ts: Wires the framework-agnostic touch-gesture
 * recogniser ({@link attachTouchGestures}) to the main canvas host. Mirrors
 * React's `useTouchGestures` wiring:
 *   - pinch-to-zoom always updates {@link ViewerZoomService}'s zoom signal
 *     (clamped to the viewer range), with `preventDefault()` on the pinch path
 *     to suppress the browser's native pinch-zoom;
 *   - horizontal swipe navigates slides, but only when editing is off
 *     (`!canEdit()`): in edit mode single-finger gestures belong to element
 *     manipulation (move/resize/rotate), so we never hijack them. The large
 *     ‹ › buttons remain available for explicit navigation in all modes;
 *   - long-press in edit mode opens the editor context menu at the press point
 *     for the current selection (mirrors React's onLongPress path).
 *
 * Extracted from {@link PowerPointViewerComponent}: the component calls
 * {@link setup} once from its constructor with the `<main>` element accessor and
 * the mode/navigation accessors the callbacks gate on. The recogniser's swipe/
 * long-press callbacks check the live accessors, so a single attach handles
 * every mode without re-binding.
 *
 * Provide it once on the viewer component (`providers: [ViewerTouchGesturesService]`).
 */

import { afterNextRender, DestroyRef, inject, Injectable } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import { attachTouchGestures } from './touch-gestures';
import { ViewerZoomService } from './viewer-zoom.service';

/** Live host accessors the gesture recogniser consults. */
interface TouchGesturesHost {
	readonly canEdit: () => boolean;
	readonly presenting: () => boolean;
	readonly selectedElement: () => PptxElement | null;
	readonly goPrev: () => void;
	readonly goNext: () => void;
	readonly setContextMenuPos: (pos: { x: number; y: number }) => void;
}

@Injectable()
export class ViewerTouchGesturesService {
	private readonly zoomSvc = inject(ViewerZoomService);
	private readonly destroyRef = inject(DestroyRef);

	/**
	 * Attach the recogniser to `mainEl()`'s element once it is in the DOM
	 * (called once from the host component's constructor).
	 */
	setup(mainEl: () => HTMLElement | undefined, host: TouchGesturesHost): void {
		afterNextRender(() => {
			const el = mainEl();
			if (!el) {
				return;
			}
			const teardown = attachTouchGestures(el, {
				getScale: () => this.zoomSvc.zoom(),
				callbacks: {
					onPinchZoom: (newScale) => this.zoomSvc.setZoom(newScale),
					onSwipe: (direction) => {
						// Edit mode: leave single-finger gestures to element manipulation.
						if (host.canEdit()) {
							return;
						}
						// direction 1 = swipe right (previous), -1 = swipe left (next).
						if (direction === 1) {
							host.goPrev();
						} else {
							host.goNext();
						}
					},
					onLongPress: (x, y) => {
						if (!host.canEdit() || host.presenting()) {
							return;
						}
						const selected = host.selectedElement();
						if (!selected) {
							return;
						}
						host.setContextMenuPos({ x, y });
					},
				},
			});
			this.destroyRef.onDestroy(teardown);
		});
	}
}
