import type { ElementAnimationState } from 'pptx-viewer-shared';
import type { InjectionKey, Ref } from 'vue';
import { inject, provide, shallowRef } from 'vue';

/**
 * Presentation-mode native-animation element state.
 *
 * The running presentation (`PresentationMode.vue`, via `useAnimationPlayback`)
 * owns a reactive `Map<elementId, ElementAnimationState>` describing each
 * element's current native-timeline playback state (visibility, CSS animation,
 * staged chart / SmartArt build progress, `p:animClr` fill / stroke targets). It
 * provides that map here; the element renderers inject it and read their own
 * element's state to reveal staged builds and relinquish animated fill / stroke.
 *
 * Outside a running presentation the context is absent (the injector returns an
 * empty map ref), so editor / read-only rendering is unaffected. This mirrors
 * React, which threads the same `presentationElementStates` map down by props.
 *
 * @module composables/presentation-element-states
 */

/** Reactive per-element native-animation state, keyed by element id. */
export type PresentationElementStates = Ref<Map<string, ElementAnimationState>>;

/** Typed injection key for the presentation element-states map. */
export const PresentationElementStatesKey: InjectionKey<PresentationElementStates> = Symbol(
	'pptx-vue-presentation-element-states',
);

/** Provide the reactive element-states map to descendant renderers. */
export function providePresentationElementStates(states: PresentationElementStates): void {
	provide(PresentationElementStatesKey, states);
}

/**
 * Resolve the injected element-states map. Returns an empty (stable) map ref
 * when no presentation is providing one, so callers can read
 * `states.value.get(id)` unconditionally.
 */
export function injectPresentationElementStates(): PresentationElementStates {
	return inject(
		PresentationElementStatesKey,
		() => shallowRef(new Map<string, ElementAnimationState>()),
		true,
	);
}
