import { getContext, setContext } from 'svelte';

/**
 * Svelte context wiring for the opt-in Three.js interactive line3D-chart
 * renderer flag (mirrors `bar-chart-3d-context.ts`, which uses the same
 * pattern for the bar3D chart). `PowerPointViewer` provides its
 * `lineChart3D` prop from the root; `ElementRenderer` consumes it deep in the
 * tree to choose the WebGL tube-path scene (camera orbit/zoom via
 * OrbitControls) over the flat SVG oblique-projection illusion for `line3D`
 * charts.
 *
 * The provided value is a getter function, not a raw boolean, so a change to
 * the root `lineChart3D` prop stays visible to consumers (context is captured
 * once at component initialisation; closing over the prop keeps it live).
 */
export const LineChart3DContextKey = Symbol('pptx-svelte-line-chart-3d');

/** Provide the `lineChart3D` opt-in flag to the component subtree (root only). */
export function provideLineChart3D(getFlag: () => boolean): void {
	setContext(LineChart3DContextKey, getFlag);
}

/** Read the line3D-chart 3D opt-in flag; defaults to `false` when not provided. */
export function useLineChart3D(): boolean {
	const fromContext = getContext<(() => boolean) | undefined>(LineChart3DContextKey);
	return fromContext ? fromContext() : false;
}
