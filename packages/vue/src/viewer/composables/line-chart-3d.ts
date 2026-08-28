/**
 * Opt-in flag for the Three.js interactive line3D-chart renderer (Vue).
 *
 * `PowerPointViewer.vue` provides this from its `lineChart3D` prop;
 * `ChartRenderer.vue` injects it to choose the WebGL tube-path scene (camera
 * orbit/zoom via OrbitControls) over the flat SVG oblique-projection illusion
 * for `line3D` charts. Mirrors `bar-chart-3d.ts`'s `BarChart3DKey`.
 */
import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * Injection key carrying the `lineChart3D` opt-in flag, ANDed with Options >
 * Advanced > "Disable 3D rendering" (see `resolve3DRenderingFlags`). A
 * computed ref, not a plain boolean, so a live Options change reaches every
 * injector without a reload.
 */
export const LineChart3DKey: InjectionKey<ComputedRef<boolean>> = Symbol('pptx-line-chart-3d');

/** Read the line3D-chart 3D opt-in flag; defaults to `false` when not provided. */
export function useLineChart3D(): ComputedRef<boolean> {
	return inject(
		LineChart3DKey,
		computed(() => false),
	);
}
