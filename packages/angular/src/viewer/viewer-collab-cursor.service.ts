/**
 * viewer-collab-cursor.service.ts: Viewer-scoped logic for the local
 * collaboration cursor broadcast and the derived remote-cursor overlay list.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the
 * few accessors it alone owns (the slide-stage element, canvas size, and
 * active-slide-index) via {@link bind}. `CollaborationService` is already
 * provided on the component, so it is injected directly rather than passed
 * through the host.
 *
 * Provide it once on the viewer component (`providers: [ViewerCollabCursorService]`).
 */

import { computed, inject, Injectable } from '@angular/core';

import { BROADCAST_THROTTLE_MS, presenceToCursors } from '../internal/shared';
import type { CanvasSize } from '../internal/shared';
import { clientPointToSlide } from './collaboration-overlay-geometry';
import { CollaborationService } from './collaboration.service';

/** Live host accessors the cursor broadcast needs. */
interface CollabCursorHost {
	/**
	 * The scaled slide stage (`.pptx-ng-canvas-stage`), NOT the `<main>` scroll
	 * host: cursor coordinates are broadcast in slide space, so they have to be
	 * measured against the slide's own origin.
	 */
	readonly stageElement: () => HTMLElement | undefined;
	readonly canvasSize: () => CanvasSize;
	readonly activeSlideIndex: () => number;
}

@Injectable()
export class ViewerCollabCursorService {
	private readonly collab = inject(CollaborationService);

	/** Timestamp of the last cursor broadcast (throttle gate). */
	private lastCursorBroadcast = 0;

	private host: CollabCursorHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: CollabCursorHost): void {
		this.host = host;
	}

	private requireHost(): CollabCursorHost {
		if (!this.host) {
			throw new Error('ViewerCollabCursorService.bind() was not called');
		}
		return this.host;
	}

	/**
	 * Remote cursors filtered to the slide the local user is viewing, so peers'
	 * cursors only appear on the shared slide (mirrors React/Vue).
	 */
	readonly cursors = computed(() =>
		presenceToCursors(this.collab.presence(), this.requireHost().activeSlideIndex()),
	);

	/**
	 * Publish the local cursor while the pointer moves over the canvas. Throttled
	 * to {@link BROADCAST_THROTTLE_MS}; coordinates are mapped from client space
	 * into unscaled slide space by {@link clientPointToSlide}, measured against
	 * the stage rect (see that helper for why `<main>` + the user zoom is wrong).
	 */
	onPointerMove(event: PointerEvent): void {
		if (!this.collab.active()) {
			return;
		}
		const now = Date.now();
		if (now - this.lastCursorBroadcast < BROADCAST_THROTTLE_MS) {
			return;
		}
		this.lastCursorBroadcast = now;
		const host = this.requireHost();
		const el = host.stageElement();
		if (!el) {
			return;
		}
		const point = clientPointToSlide(
			el.getBoundingClientRect(),
			host.canvasSize(),
			event.clientX,
			event.clientY,
		);
		this.collab.setCursor(point.x, point.y, host.activeSlideIndex());
	}
}
