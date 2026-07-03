/**
 * viewer-collab-cursor.service.ts: Viewer-scoped logic for the local
 * collaboration cursor broadcast and the derived remote-cursor overlay list.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the
 * few accessors it alone owns (the `<main>` element, zoom, canvas size, and
 * active-slide-index) via {@link bind}. `CollaborationService` is already
 * provided on the component, so it is injected directly rather than passed
 * through the host.
 *
 * Provide it once on the viewer component (`providers: [ViewerCollabCursorService]`).
 */

import { computed, inject, Injectable } from '@angular/core';

import { BROADCAST_THROTTLE_MS, clampCursorPosition, presenceToCursors } from '../internal/shared';
import type { CanvasSize } from '../internal/shared';
import { CollaborationService } from './collaboration.service';

/** Live host accessors the cursor broadcast needs. */
interface CollabCursorHost {
	readonly mainElement: () => HTMLElement | undefined;
	readonly zoom: () => number;
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
	 * into unscaled slide space (dividing by zoom, matching the cursor overlay)
	 * and clamped to the canvas bounds.
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
		const el = host.mainElement();
		if (!el) {
			return;
		}
		const rect = el.getBoundingClientRect();
		const zoom = host.zoom() || 1;
		const size = host.canvasSize();
		const x = clampCursorPosition((event.clientX - rect.left) / zoom, 0, size.width);
		const y = clampCursorPosition((event.clientY - rect.top) / zoom, 0, size.height);
		this.collab.setCursor(x, y, host.activeSlideIndex());
	}
}
