import { getContext, setContext } from 'svelte';

/**
 * Svelte context wiring for the opt-in Three.js interactive pie3D-chart
 * renderer flag (mirrors `bar-chart-3d-context.ts`, which uses the same
 * pattern for the bar3D chart). `PowerPointViewer` provides its
 * `pieChart3D` prop from the root; `ElementRenderer` consumes it deep in the
 * tree to choose the WebGL wedge-mesh scene (camera orbit/zoom via
 * OrbitControls) over the flat SVG oblique-projection illusion for `pie3D`
 * charts.
 *
 * The provided value is a getter function, not a raw boolean, so a change to
 * the root `pieChart3D` prop stays visible to consumers (context is captured
 * once at component initialisation; closing over the prop keeps it live).
 */
export const PieChart3DContextKey = Symbol('pptx-svelte-pie-chart-3d');

/** Provide the `pieChart3D` opt-in flag to the component subtree (root only). */
export function providePieChart3D(getFlag: () => boolean): void {
	setContext(PieChart3DContextKey, getFlag);
}

/** Read the pie3D-chart 3D opt-in flag; defaults to `false` when not provided. */
export function usePieChart3D(): boolean {
	const fromContext = getContext<(() => boolean) | undefined>(PieChart3DContextKey);
	return fromContext ? fromContext() : false;
}
