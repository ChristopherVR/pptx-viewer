import type { ElementAnimationState } from 'pptx-viewer-shared';
import { getContext, setContext } from 'svelte';

/**
 * Svelte context wiring for the presentation-mode native-animation element
 * state map (mirrors Vue's `presentation-element-states` provide/inject and the
 * Svelte `smart-art-3d-context`).
 *
 * The running presentation (`PresentationController`, via `AnimationPlayback`)
 * owns a runes `Map<elementId, ElementAnimationState>` describing each element's
 * current native-timeline playback state (visibility, CSS animation, staged
 * chart / SmartArt build progress, `p:animClr` fill / stroke targets).
 * `PowerPointViewer` provides a getter over that map here; the element renderers
 * consume it deep in the tree and read their own element's state to reveal
 * staged builds and relinquish animated fill / stroke.
 *
 * The provided value is a getter function, not a raw map, so reading it inside a
 * `$derived` in a descendant keeps the runes read reactive (context is captured
 * once at component initialisation; closing over the live map keeps it live).
 * Outside a running presentation the context is absent, so editor / read-only
 * rendering is unaffected: consumers fall back to an empty map.
 */

/** Getter over the reactive per-element native-animation state map. */
export type PresentationElementStatesGetter = () => Map<string, ElementAnimationState>;

/**
 * Exported (not just module-private) so tests can seed it directly via
 * `mount(Component, { context: new Map([[PresentationElementStatesKey, () => map]]) })`
 * without needing a full `PowerPointViewer` host tree.
 */
export const PresentationElementStatesKey = Symbol('pptx-svelte-presentation-element-states');

/** Provide the element-states getter to the component subtree (root only). */
export function providePresentationElementStates(getStates: PresentationElementStatesGetter): void {
	setContext(PresentationElementStatesKey, getStates);
}

/**
 * Read the presentation element-state for `elementId`, or `undefined` when no
 * presentation is providing a map (editor / read-only rendering). Call inside a
 * `$derived` so the read stays reactive.
 */
export function usePresentationElementState(elementId: string): ElementAnimationState | undefined {
	const getStates = getContext<PresentationElementStatesGetter | undefined>(
		PresentationElementStatesKey,
	);
	return getStates ? getStates().get(elementId) : undefined;
}

/**
 * Read the whole element-state map, for consumers that need sub-element ids
 * rather than one element's own state - notably a staged text build, whose
 * pieces are keyed `<elementId>::c0-3`. Returns `undefined` outside a running
 * presentation so editor rendering skips the split entirely.
 */
export function usePresentationElementStates(): Map<string, ElementAnimationState> | undefined {
	const getStates = getContext<PresentationElementStatesGetter | undefined>(
		PresentationElementStatesKey,
	);
	return getStates ? getStates() : undefined;
}
