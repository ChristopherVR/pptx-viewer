import type { Rendering3DFlags } from 'pptx-viewer-shared';
import { getContext, setContext } from 'svelte';

/**
 * Svelte context for the host's opt-in 3D rendering flags (`smartArt3D`,
 * `surfaceChart3D`, `barChart3D`, `lineChart3D`, `areaChart3D`, `pieChart3D`),
 * already narrowed by the viewer user's Options > Advanced > "Disable 3D
 * rendering" override (see `resolve3DRenderingFlags`). ONE context replaces
 * the six per-kind ones; every chart / SmartArt element hands the flags to
 * `resolveChartThreeViewSpec` / `resolveSmartArtThreeViewSpec`. Mirrors
 * React's `Rendering3DFlagsContext` and Vue's `Rendering3DFlagsKey`.
 *
 * The provided value is a getter, so reading it inside a `$derived` stays
 * live when a root prop or the Options override changes.
 */

/** Exported so tests and the export stage can seed it via `mount(..., { context })`. */
export const Rendering3DFlagsContextKey = Symbol('pptx-svelte-rendering-3d-flags');

/** All off: the default outside `PowerPointViewer` (tests, isolated thumbnails). */
export const DEFAULT_RENDERING_3D_FLAGS: Rendering3DFlags = {
	smartArt3D: false,
	surfaceChart3D: false,
	barChart3D: false,
	lineChart3D: false,
	areaChart3D: false,
	pieChart3D: false,
};

/** Provide the resolved flags to the component subtree (root only). */
export function provideRendering3DFlags(getFlags: () => Rendering3DFlags): void {
	setContext(Rendering3DFlagsContextKey, getFlags);
}

/**
 * The flags getter; call it inside a `$derived` to stay reactive. Must be
 * called during component initialisation (`getContext` only resolves there).
 */
export function useRendering3DFlags(): () => Rendering3DFlags {
	return (
		getContext<(() => Rendering3DFlags) | undefined>(Rendering3DFlagsContextKey) ??
		(() => DEFAULT_RENDERING_3D_FLAGS)
	);
}
