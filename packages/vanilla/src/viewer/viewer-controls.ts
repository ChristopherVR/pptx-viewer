import type { RenderController } from './render-controller';
import { clampSlideIndex } from './state';
import type { Store, ViewerState, ZoomLevel } from './state';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;

/**
 * Navigation + zoom controls for the vanilla viewer, factored out of
 * `PptxViewer` so the orchestrator class stays within its file-size budget.
 * Pure store/renderer plumbing: slide clamping and zoom-scale math only.
 */
export interface ViewerControls {
	next(): void;
	prev(): void;
	goToSlide(index: number): void;
	slideCount(): number;
	currentSlide(): number;
	zoom(): number;
	setZoom(zoom: ZoomLevel): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
}

export function createViewerControls(
	store: Store<ViewerState>,
	renderer: RenderController,
): ViewerControls {
	const goToSlide = (index: number): void => {
		store.set({ currentSlide: clampSlideIndex(index, store.get().slides.length) });
	};
	const setZoom = (zoom: ZoomLevel): void => {
		store.set({
			zoom: zoom === 'fit' ? 'fit' : Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM),
		});
	};
	return {
		next: () => goToSlide(store.get().currentSlide + 1),
		prev: () => goToSlide(store.get().currentSlide - 1),
		goToSlide,
		slideCount: () => store.get().slides.length,
		currentSlide: () => store.get().currentSlide,
		zoom: () => renderer.effectiveScale(),
		setZoom,
		zoomIn: () => setZoom(renderer.effectiveScale() * ZOOM_STEP),
		zoomOut: () => setZoom(renderer.effectiveScale() / ZOOM_STEP),
		zoomToFit: () => setZoom('fit'),
	};
}
