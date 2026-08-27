import { getContext, setContext } from 'svelte';

/**
 * Svelte context wiring for the opt-in Three.js interactive bar3D-chart
 * renderer flag (mirrors `surface-chart-3d-context.ts`, which uses the same
 * pattern for the surface chart). `PowerPointViewer` provides its
 * `barChart3D` prop from the root; `ElementRenderer` consumes it deep in the
 * tree to choose the WebGL box-mesh scene (camera orbit/zoom via
 * OrbitControls) over the flat SVG oblique-projection illusion for `bar3D`
 * charts.
 *
 * The provided value is a getter function, not a raw boolean, so a change to
 * the root `barChart3D` prop stays visible to consumers (context is captured
 * once at component initialisation; closing over the prop keeps it live).
 */
export const BarChart3DContextKey = Symbol('pptx-svelte-bar-chart-3d');

/** Provide the `barChart3D` opt-in flag to the component subtree (root only). */
export function provideBarChart3D(getFlag: () => boolean): void {
	setContext(BarChart3DContextKey, getFlag);
}

/** Read the bar3D-chart 3D opt-in flag; defaults to `false` when not provided. */
export function useBarChart3D(): boolean {
	const fromContext = getContext<(() => boolean) | undefined>(BarChart3DContextKey);
	return fromContext ? fromContext() : false;
}
