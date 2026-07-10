import { getContext, setContext } from 'svelte';

/**
 * Svelte context wiring for the opt-in Three.js SmartArt renderer flag
 * (mirrors Vue's `smart-art-3d.ts` composable, which uses `provide`/`inject`
 * for the same purpose). `PowerPointViewer` provides its `smartArt3D` prop
 * from the root; `ElementRenderer` consumes it deep in the tree to choose the
 * WebGL renderer over the SVG one for `smartArt` elements.
 *
 * The provided value is a getter function, not a raw boolean, so a change to
 * the root `smartArt3D` prop stays visible to consumers (context is captured
 * once at component initialisation; closing over the prop keeps it live).
 */
/**
 * Exported (not just module-private) so tests can seed it directly via
 * `mount(Component, { context: new Map([[SmartArt3DContextKey, () => true]]) })`
 * without needing a full `PowerPointViewer` host tree.
 */
export const SmartArt3DContextKey = Symbol('pptx-svelte-smartart-3d');

/** Provide the `smartArt3D` opt-in flag to the component subtree (root only). */
export function provideSmartArt3D(getFlag: () => boolean): void {
	setContext(SmartArt3DContextKey, getFlag);
}

/** Read the SmartArt 3D opt-in flag; defaults to `false` when not provided. */
export function useSmartArt3D(): boolean {
	const fromContext = getContext<(() => boolean) | undefined>(SmartArt3DContextKey);
	return fromContext ? fromContext() : false;
}
