import { getContext, setContext } from 'svelte';

/**
 * Svelte context wiring for the opt-in Three.js interactive area3D-chart
 * renderer flag (mirrors `bar-chart-3d-context.ts`, which uses the same
 * pattern for the bar3D chart). `PowerPointViewer` provides its
 * `areaChart3D` prop from the root; `ElementRenderer` consumes it deep in the
 * tree to choose the WebGL ribbon scene (camera orbit/zoom via
 * OrbitControls) over the flat SVG oblique-projection illusion for `area3D`
 * charts.
 *
 * The provided value is a getter function, not a raw boolean, so a change to
 * the root `areaChart3D` prop stays visible to consumers (context is captured
 * once at component initialisation; closing over the prop keeps it live).
 */
export const AreaChart3DContextKey = Symbol('pptx-svelte-area-chart-3d');

/** Provide the `areaChart3D` opt-in flag to the component subtree (root only). */
export function provideAreaChart3D(getFlag: () => boolean): void {
	setContext(AreaChart3DContextKey, getFlag);
}

/** Read the area3D-chart 3D opt-in flag; defaults to `false` when not provided. */
export function useAreaChart3D(): boolean {
	const fromContext = getContext<(() => boolean) | undefined>(AreaChart3DContextKey);
	return fromContext ? fromContext() : false;
}
