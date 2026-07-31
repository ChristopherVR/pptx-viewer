import type { PptxElement } from 'pptx-viewer-core';
import { getContext, setContext } from 'svelte';

/**
 * Svelte context wiring for the element list of the slide currently being
 * painted, mirroring Vue's `SlideElementsKey` provide/inject, Angular's
 * `slideElements` input and the `slide` already on Vanilla's render context.
 *
 * Why a context rather than a prop: the only consumer is the text renderer, and
 * what it needs is its SIBLINGS, not its own data. Threading a whole slide's
 * element array down `SlideStage` -> `ElementRenderer` (and through the group
 * renderer's recursion) to serve one feature would put an array-typed prop on
 * every element in the deck; context reaches the same consumers without touching
 * the render path, exactly as the field context next door does.
 *
 * The consumer is `a:linkedTxbx` overflow: a text box in a linked chain renders
 * only the slice of the chain's text that the preceding boxes could not hold,
 * which is computable only from the other boxes in the chain. Without this,
 * every box in a chain painted the chain's FULL text.
 *
 * The provided value is a GETTER, not a plain array, because Svelte context is
 * captured once at component initialisation: closing over the live runes state
 * is what keeps a consumer's `$derived` re-running when the stage changes slide
 * or an element is edited.
 */

/** Getter over the current slide's element list (`undefined` = no chain resolution). */
export type SlideElementsGetter = () => readonly PptxElement[] | undefined;

/**
 * Exported (not just module-private) so tests can seed it directly via
 * `mount(Component, { context: new Map([[SlideElementsKey, () => els]]) })`
 * without needing a full `SlideStage` host tree.
 */
export const SlideElementsKey = Symbol('pptx-svelte-slide-elements');

/**
 * Publish the element list of the slide this subtree paints.
 *
 * Provided per stage rather than once at the viewer root because a thumbnail,
 * presenter preview or export stage paints a slide other than the active one,
 * and resolving a chain against the wrong slide's elements would distribute the
 * wrong text (or find no chain at all).
 */
export function provideSlideElements(getSlideElements: SlideElementsGetter): void {
	setContext(SlideElementsKey, getSlideElements);
}

/**
 * The slide-elements GETTER for this subtree, or `undefined` when nothing
 * provides one (standalone renderer, export, unit test), in which case a linked
 * text box falls back to its own authored segments.
 *
 * `getContext` only resolves during component initialisation, so this must be
 * called at init and the returned getter invoked inside a `$derived` to keep the
 * read reactive.
 */
export function getSlideElementsGetter(): SlideElementsGetter | undefined {
	return getContext<SlideElementsGetter | undefined>(SlideElementsKey);
}
