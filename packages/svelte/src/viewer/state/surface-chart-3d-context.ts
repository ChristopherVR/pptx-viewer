import { getContext, setContext } from 'svelte';

/**
 * Svelte context wiring for the opt-in Three.js interactive surface-chart
 * renderer flag (mirrors `smart-art-3d-context.ts`, which uses the same
 * pattern for SmartArt). `PowerPointViewer` provides its `surfaceChart3D`
 * prop from the root; `ElementRenderer` consumes it deep in the tree to
 * choose the WebGL scene (camera orbit/zoom via OrbitControls) over the
 * static SVG isometric projection for `surface`/`surface3D` charts.
 *
 * The provided value is a getter function, not a raw boolean, so a change to
 * the root `surfaceChart3D` prop stays visible to consumers (context is
 * captured once at component initialisation; closing over the prop keeps it
 * live).
 */
export const SurfaceChart3DContextKey = Symbol('pptx-svelte-surface-chart-3d');

/** Provide the `surfaceChart3D` opt-in flag to the component subtree (root only). */
export function provideSurfaceChart3D(getFlag: () => boolean): void {
	setContext(SurfaceChart3DContextKey, getFlag);
}

/** Read the surface-chart 3D opt-in flag; defaults to `false` when not provided. */
export function useSurfaceChart3D(): boolean {
	const fromContext = getContext<(() => boolean) | undefined>(SurfaceChart3DContextKey);
	return fromContext ? fromContext() : false;
}
