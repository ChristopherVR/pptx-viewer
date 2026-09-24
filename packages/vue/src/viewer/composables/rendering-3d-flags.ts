/**
 * The host's opt-in 3D rendering flags (`smartArt3D`, `surfaceChart3D`,
 * `barChart3D`, `lineChart3D`, `areaChart3D`, `pieChart3D`), already narrowed
 * by the viewer user's own Options > Advanced > "Disable 3D rendering"
 * override (see `resolve3DRenderingFlags`).
 *
 * `PowerPointViewer.vue` provides ONE computed ref of all six; every chart /
 * SmartArt element injects it and hands it straight to
 * `resolveChartThreeViewSpec` / `resolveSmartArtThreeViewSpec`, which decide
 * per element whether a `<pptx-three-view>` spec applies. Mirrors React's
 * `Rendering3DFlagsContext`.
 */
import type { Rendering3DFlags } from 'pptx-viewer-shared';
import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/** All off: the safe default outside `PowerPointViewer` (tests, isolated thumbnails). */
export const DEFAULT_RENDERING_3D_FLAGS: Rendering3DFlags = {
	smartArt3D: false,
	surfaceChart3D: false,
	barChart3D: false,
	lineChart3D: false,
	areaChart3D: false,
	pieChart3D: false,
};

/** Injection key for the resolved flags; a computed ref so a live Options change reaches every injector. */
export const Rendering3DFlagsKey: InjectionKey<ComputedRef<Rendering3DFlags>> =
	Symbol('pptx-rendering-3d-flags');

/** Read the resolved 3D flags; all off when not provided. */
export function useRendering3DFlags(): ComputedRef<Rendering3DFlags> {
	return inject(
		Rendering3DFlagsKey,
		computed(() => DEFAULT_RENDERING_3D_FLAGS),
	);
}
