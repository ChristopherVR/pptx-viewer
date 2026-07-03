/**
 * viewer-zoom.service.ts: Viewer-scoped zoom-level state for the main editing
 * canvas (not the auto-fit scale, which stays internal to `SlideCanvasComponent`).
 *
 * Extracted from {@link PowerPointViewerComponent}: the ribbon/status-bar zoom
 * controls and the pinch-to-zoom touch gesture all read/write this one signal.
 *
 * Provide it once on the viewer component (`providers: [ViewerZoomService]`).
 */

import { computed, Injectable, signal } from '@angular/core';

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;

@Injectable()
export class ViewerZoomService {
	/** Current zoom multiplier applied to the main slide canvas (1 = 100%). */
	readonly zoom = signal(1);
	/** {@link zoom} rounded to a whole percentage for display. */
	readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

	zoomIn(): void {
		this.zoom.set(Math.min(ZOOM_MAX, Number((this.zoom() + ZOOM_STEP).toFixed(2))));
	}

	zoomOut(): void {
		this.zoom.set(Math.max(ZOOM_MIN, Number((this.zoom() - ZOOM_STEP).toFixed(2))));
	}

	zoomReset(): void {
		this.zoom.set(1);
	}
}
