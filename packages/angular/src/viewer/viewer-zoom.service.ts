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

// The step and its bounds are shared with the other four bindings so the same
// button press is worth the same amount of zoom everywhere.
import { clampZoomScale, zoomInScale, zoomOutScale } from '../internal/shared';

@Injectable()
export class ViewerZoomService {
	/** Current zoom multiplier applied to the main slide canvas (1 = 100%). */
	readonly zoom = signal(1);
	/** {@link zoom} rounded to a whole percentage for display. */
	readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

	/** Jump to an explicit zoom level, clamped by the shared bounds. */
	setZoom(level: number): void {
		this.zoom.set(clampZoomScale(level));
	}

	zoomIn(): void {
		this.zoom.set(zoomInScale(this.zoom()));
	}

	zoomOut(): void {
		this.zoom.set(zoomOutScale(this.zoom()));
	}

	zoomReset(): void {
		this.zoom.set(1);
	}
}
