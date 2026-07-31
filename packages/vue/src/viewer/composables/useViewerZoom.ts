/**
 * useViewerZoom: the editor canvas's two independent scale factors.
 *
 * `zoom` is the user's zoom level (the status bar's +/- and Ctrl+scroll).
 * `fitScale` is the fit-to-viewport factor (<= 1) that `SlideCanvas` measures
 * with a ResizeObserver so a whole slide is visible by default instead of
 * overflowing a small viewport. Everything that renders or maps pointer
 * coordinates must use `effectiveZoom` (their product), matching React and
 * Angular where "100%" means "fit to viewport".
 *
 * The step and bounds come from `pptx-viewer-shared` so one press is worth the
 * same amount of zoom in every binding.
 */
import { zoomInScale, zoomOutScale } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';

export interface UseViewerZoomResult {
	/** The user's zoom level (1 = fit to viewport). */
	zoom: Ref<number>;
	/** Fit-to-viewport factor reported by `SlideCanvas`'s ResizeObserver. */
	fitScale: Ref<number>;
	/** Effective on-screen scale: `fitScale x zoom`. */
	effectiveZoom: ComputedRef<number>;
	zoomIn: () => void;
	zoomOut: () => void;
	zoomReset: () => void;
}

export function useViewerZoom(): UseViewerZoomResult {
	const zoom = ref(1);
	const fitScale = ref(1);
	const effectiveZoom = computed(() => fitScale.value * zoom.value);

	return {
		zoom,
		fitScale,
		effectiveZoom,
		zoomIn: () => {
			zoom.value = zoomInScale(zoom.value);
		},
		zoomOut: () => {
			zoom.value = zoomOutScale(zoom.value);
		},
		zoomReset: () => {
			zoom.value = 1;
		},
	};
}
