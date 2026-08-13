import type { PptxElement } from 'pptx-viewer-core';
import type { ResizeHandleId } from 'pptx-viewer-shared';

import type { AdjustGestureController } from './editor-adjust-gesture';
import type { GestureController } from './editor-gestures';
import type { SelectionInteractivity } from './editor-selection-interactivity';

/**
 * The three pointer-downs that start on selection CHROME rather than on the
 * slide: a resize handle, the rotate knob, and the amber shape-adjustment
 * diamond.
 *
 * Each one re-checks the lock that governs it even though `SelectionOverlay`
 * already hides the chrome it belongs to. Hiding a button is presentation; a
 * synthetic pointerdown, an assistive click, or a frame rendered before the
 * selection settled must all still be refused, and the guard belongs beside
 * the gesture it guards rather than in the view.
 *
 * Extracted from `EditorController` so that class stays the event surface and
 * both files stay within the repo's file-size budget.
 *
 * @module editor/editor-handle-handlers
 */

export interface HandleGestureHost {
	/** The primary selected element's id, or null. */
	getSelectedId(): string | null;
	/** The primary selected element, or undefined. */
	getSelectedElement(): PptxElement | undefined;
	/** The collective lock verdict + adjustment descriptor for the selection. */
	getInteractivity(): SelectionInteractivity;
	/** Single-element move / resize / rotate driver. */
	gestures: GestureController;
	/** Collective (multi-selection) driver; returns false for a selection of one. */
	beginCollectiveTransform(
		kind: 'move' | 'resize',
		event: PointerEvent,
		handle?: ResizeHandleId,
	): boolean;
	/** Shape-adjustment (`a:avLst`) driver. */
	adjust: AdjustGestureController;
}

export interface HandleHandlers {
	onHandlePointerDown(handle: ResizeHandleId, event: PointerEvent): void;
	onRotatePointerDown(event: PointerEvent): void;
	onAdjustPointerDown(event: PointerEvent): void;
}

export function createHandleHandlers(host: HandleGestureHost): HandleHandlers {
	return {
		onHandlePointerDown(handle, event) {
			const id = host.getSelectedId();
			if (!id || !host.getInteractivity().resizable) {
				return;
			}
			if (host.beginCollectiveTransform('resize', event, handle)) {
				return;
			}
			host.gestures.begin('resize', id, event, handle);
		},

		onRotatePointerDown(event) {
			const id = host.getSelectedId();
			if (id && host.getInteractivity().rotatable) {
				host.gestures.begin('rotate', id, event);
			}
		},

		/** Writes `shapeAdjustments`, never the element box. */
		onAdjustPointerDown(event) {
			const element = host.getSelectedElement();
			const descriptor = host.getInteractivity().adjust;
			if (element && descriptor) {
				host.adjust.begin(element, descriptor, event);
			}
		},
	};
}
