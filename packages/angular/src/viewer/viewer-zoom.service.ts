/**
 * viewer-zoom.service.ts: Viewer-scoped zoom-level state for the main editing
 * canvas (not the auto-fit scale, which stays internal to `SlideCanvasComponent`).
 *
 * Extracted from {@link PowerPointViewerComponent}: the ribbon/status-bar zoom
 * controls and the pinch-to-zoom touch gesture all read/write this one signal.
 *
 * Provide it once on the viewer component (`providers: [ViewerZoomService]`).
 *
 * The state itself lives in the shared `createViewerZoomStore`, so the zoom
 * model (and not merely the step size) is the same in all five bindings; this
 * service is the Angular projection of it. `viewerStoreSignal` keeps the signal
 * fed and unsubscribes with the service's own `DestroyRef`.
 */

import { computed, Injectable } from '@angular/core';
import type { Signal } from '@angular/core';

import { createViewerZoomStore, viewerZoomPercent } from '../internal/shared';
import { viewerStoreSignal } from './viewer-store-signal';

@Injectable()
export class ViewerZoomService {
	private readonly store = createViewerZoomStore();
	private readonly zoomSignal = viewerStoreSignal(this.store, (state) => state.zoom);

	/** Current zoom multiplier applied to the main slide canvas (1 = 100%). */
	readonly zoom: Signal<number> = this.zoomSignal.value;
	/** {@link zoom} rounded to a whole percentage for display. */
	readonly zoomPercent = computed(() => viewerZoomPercent(this.zoom()));

	/** Jump to an explicit zoom level, clamped by the shared bounds. */
	setZoom(level: number): void {
		this.store.dispatch({ type: 'set-zoom', zoom: level });
	}

	zoomIn(): void {
		this.store.dispatch({ type: 'zoom-in' });
	}

	zoomOut(): void {
		this.store.dispatch({ type: 'zoom-out' });
	}

	zoomReset(): void {
		this.store.dispatch({ type: 'zoom-to-fit' });
	}
}
