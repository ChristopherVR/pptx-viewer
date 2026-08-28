/**
 * Opt-in flag for the Three.js interactive surface-chart renderer (Vue).
 *
 * `PowerPointViewer.vue` provides this from its `surfaceChart3D` prop;
 * `ChartRenderer.vue` injects it to choose the WebGL scene (camera
 * orbit/zoom via OrbitControls) over the static SVG isometric projection for
 * `surface`/`surface3D` charts. Mirrors `smart-art-3d.ts`'s `SmartArt3DKey`.
 */
import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * Injection key carrying the `surfaceChart3D` opt-in flag, ANDed with Options
 * > Advanced > "Disable 3D rendering" (see `resolve3DRenderingFlags`). A
 * computed ref, not a plain boolean, so a live Options change reaches every
 * injector without a reload.
 */
export const SurfaceChart3DKey: InjectionKey<ComputedRef<boolean>> =
	Symbol('pptx-surface-chart-3d');

/** Read the surface-chart 3D opt-in flag; defaults to `false` when not provided. */
export function useSurfaceChart3D(): ComputedRef<boolean> {
	return inject(
		SurfaceChart3DKey,
		computed(() => false),
	);
}
