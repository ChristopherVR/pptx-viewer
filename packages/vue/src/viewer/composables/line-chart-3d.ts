/**
 * Opt-in flag for the Three.js interactive line3D-chart renderer (Vue).
 *
 * `PowerPointViewer.vue` provides this from its `lineChart3D` prop;
 * `ChartRenderer.vue` injects it to choose the WebGL tube-path scene (camera
 * orbit/zoom via OrbitControls) over the flat SVG oblique-projection illusion
 * for `line3D` charts. Mirrors `bar-chart-3d.ts`'s `BarChart3DKey`.
 */
import { inject } from 'vue';
import type { InjectionKey } from 'vue';

/** Injection key carrying the `lineChart3D` opt-in flag. */
export const LineChart3DKey: InjectionKey<boolean> = Symbol('pptx-line-chart-3d');

/** Read the line3D-chart 3D opt-in flag; defaults to `false` when not provided. */
export function useLineChart3D(): boolean {
	return inject(LineChart3DKey, false);
}
