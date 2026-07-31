import type { PptxElement } from 'pptx-viewer-core';
import type { InjectionKey, MaybeRefOrGetter } from 'vue';
import { inject, provide, toValue } from 'vue';

/**
 * The list of elements on the slide currently being painted, made available to
 * the element renderers.
 *
 * Why an injection rather than a prop: the only consumer is the text renderer,
 * and it needs its SIBLINGS, not its own data. Threading a whole slide's element
 * array down the hot `SlideStage` -> `ElementRenderer` prop chain (and through
 * the group renderer's recursion) to serve one feature would put an array-typed
 * prop on every element in the deck; provide/inject reaches the same consumers
 * without touching the render path. This mirrors the field-context composable
 * next door, which exists for the same reason.
 *
 * The consumer is `a:linkedTxbx` overflow: a text box in a linked chain renders
 * the slice of the chain's text that the preceding boxes could not hold, which
 * is only computable from the other boxes in the chain. Without this, every box
 * in a chain painted the chain's FULL text, so the same run appeared in each box
 * (React resolves the same thing from its `activeSlide.elements` prop).
 *
 * The provided value is a getter/ref, not a plain array, so a consumer's
 * `computed` re-runs when the stage changes slide or an element is edited.
 */

/** Typed injection key for the current slide's element list (reactive getter or ref). */
export const SlideElementsKey: InjectionKey<MaybeRefOrGetter<readonly PptxElement[] | undefined>> =
	Symbol('pptx-vue-slide-elements');

/**
 * Resolve the injected slide-element source, if any. Must be called from a
 * component `setup`; the raw getter/ref is returned so the caller can read it
 * reactively inside a `computed` via {@link resolveSlideElements}.
 */
export function injectSlideElements():
	| MaybeRefOrGetter<readonly PptxElement[] | undefined>
	| undefined {
	return inject(SlideElementsKey, undefined);
}

/** Unwrap an injected slide-element source to its current value (reactive-safe inside `computed`). */
export function resolveSlideElements(
	source: MaybeRefOrGetter<readonly PptxElement[] | undefined> | undefined,
): readonly PptxElement[] | undefined {
	return source ? toValue(source) : undefined;
}

/**
 * Publish the element list of the slide this subtree paints (must be called
 * from `setup`).
 *
 * Provided per stage rather than once at the viewer root because a thumbnail,
 * presenter preview or export stage paints a slide other than the active one,
 * and resolving a chain against the wrong slide's elements would distribute the
 * wrong text (or find no chain at all).
 */
export function provideSlideElements(elements: () => readonly PptxElement[] | undefined): void {
	provide(SlideElementsKey, elements);
}
