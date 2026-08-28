/**
 * Opt-in flag for the Three.js SmartArt renderer (Vue).
 *
 * `PowerPointViewer.vue` provides this from its `smartArt3D` prop; the element
 * dispatcher injects it to choose the WebGL renderer over the SVG one. Mirrors
 * the React `SmartArt3DContext`.
 */
import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * Injection key carrying the `smartArt3D` opt-in flag, ANDed with Options >
 * Advanced > "Disable 3D rendering" (see `resolve3DRenderingFlags`). A
 * computed ref, not a plain boolean, so a live Options change reaches every
 * injector without a reload.
 */
export const SmartArt3DKey: InjectionKey<ComputedRef<boolean>> = Symbol('pptx-smartart-3d');

/** Read the SmartArt 3D opt-in flag; defaults to `false` when not provided. */
export function useSmartArt3D(): ComputedRef<boolean> {
	return inject(
		SmartArt3DKey,
		computed(() => false),
	);
}
