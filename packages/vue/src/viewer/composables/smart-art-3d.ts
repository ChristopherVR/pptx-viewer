/**
 * Opt-in flag for the Three.js SmartArt renderer (Vue).
 *
 * `PowerPointViewer.vue` provides this from its `smartArt3D` prop; the element
 * dispatcher injects it to choose the WebGL renderer over the SVG one. Mirrors
 * the React `SmartArt3DContext`.
 */
import { inject } from 'vue';
import type { InjectionKey } from 'vue';

/** Injection key carrying the `smartArt3D` opt-in flag. */
export const SmartArt3DKey: InjectionKey<boolean> = Symbol('pptx-smartart-3d');

/** Read the SmartArt 3D opt-in flag; defaults to `false` when not provided. */
export function useSmartArt3D(): boolean {
	return inject(SmartArt3DKey, false);
}
