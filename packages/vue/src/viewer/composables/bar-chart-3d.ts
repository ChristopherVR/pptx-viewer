/**
 * Opt-in flag for the Three.js interactive bar3D-chart renderer (Vue).
 *
 * `PowerPointViewer.vue` provides this from its `barChart3D` prop;
 * `ChartRenderer.vue` injects it to choose the WebGL box-mesh scene (camera
 * orbit/zoom via OrbitControls) over the flat SVG oblique-projection illusion
 * for `bar3D` charts. Mirrors `surface-chart-3d.ts`'s `SurfaceChart3DKey`.
 */
import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * Injection key carrying the `barChart3D` opt-in flag, ANDed with Options >
 * Advanced > "Disable 3D rendering" (see `resolve3DRenderingFlags`). A
 * computed ref, not a plain boolean, so a live Options change reaches every
 * injector without a reload.
 */
export const BarChart3DKey: InjectionKey<ComputedRef<boolean>> = Symbol('pptx-bar-chart-3d');

/** Read the bar3D-chart 3D opt-in flag; defaults to `false` when not provided. */
export function useBarChart3D(): ComputedRef<boolean> {
	return inject(
		BarChart3DKey,
		computed(() => false),
	);
}
