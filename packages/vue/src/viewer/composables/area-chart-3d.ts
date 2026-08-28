/**
 * Opt-in flag for the Three.js interactive area3D-chart renderer (Vue).
 *
 * `PowerPointViewer.vue` provides this from its `areaChart3D` prop;
 * `ChartRenderer.vue` injects it to choose the WebGL ribbon scene (camera
 * orbit/zoom via OrbitControls) over the flat SVG oblique-projection illusion
 * for `area3D` charts. Mirrors `bar-chart-3d.ts`'s `BarChart3DKey`.
 */
import { inject } from 'vue';
import type { InjectionKey } from 'vue';

/** Injection key carrying the `areaChart3D` opt-in flag. */
export const AreaChart3DKey: InjectionKey<boolean> = Symbol('pptx-area-chart-3d');

/** Read the area3D-chart 3D opt-in flag; defaults to `false` when not provided. */
export function useAreaChart3D(): boolean {
	return inject(AreaChart3DKey, false);
}
