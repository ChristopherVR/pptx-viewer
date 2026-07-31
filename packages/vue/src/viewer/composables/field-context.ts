import type { PptxSlide } from 'pptx-viewer-core';
import type { FieldSubstitutionContext } from 'pptx-viewer-shared';
import { deriveSlideFieldContext } from 'pptx-viewer-shared';
import type { InjectionKey, MaybeRefOrGetter } from 'vue';
import { inject, provide, toValue } from 'vue';

/**
 * Field-substitution context made available to the element text renderers for
 * resolving OOXML field runs (slide number, date/time, header/footer, slide
 * title, document properties) into display text.
 *
 * Provided at the viewer root via {@link FieldContextKey} and injected by
 * `ElementRenderer` / `WordArtText`, so the hot `SlideStage` -> `ElementRenderer`
 * prop chain does not have to thread the context through every element. Mirrors
 * the React `fieldContext` built in `ViewerCanvasArea`.
 *
 * Two layers share the one key: the root provides the deck-level context built
 * from the ACTIVE slide, and every `SlideStage` re-provides it re-pointed at the
 * slide it actually paints (see {@link provideSlideFieldContext}), so a consumer
 * only ever reads the nearest value.
 */

/** Typed injection key for the field-substitution context (reactive getter or ref). */
export const FieldContextKey: InjectionKey<MaybeRefOrGetter<FieldSubstitutionContext | undefined>> =
	Symbol('pptx-vue-field-context');

/**
 * Resolve the injected field-context source, if any. Must be called from a
 * component `setup`. Returns the raw injected getter/ref so the caller can read
 * it reactively inside a `computed` via {@link resolveFieldContext}.
 */
export function injectFieldContext():
	| MaybeRefOrGetter<FieldSubstitutionContext | undefined>
	| undefined {
	return inject(FieldContextKey, undefined);
}

/** Unwrap an injected field-context source to its current value (reactive-safe inside `computed`). */
export function resolveFieldContext(
	source: MaybeRefOrGetter<FieldSubstitutionContext | undefined> | undefined,
): FieldSubstitutionContext | undefined {
	return source ? toValue(source) : undefined;
}

/**
 * Re-provide the injected field context, re-pointed at ONE slide, for the whole
 * subtree below the calling component (must be called from `setup`).
 *
 * The date / header / footer / document-property fields are presentation-wide,
 * but the slide number and slide title are not: a surface painting a slide other
 * than the active one (thumbnail rail, presenter preview, off-screen export
 * stage) has to resolve those from the slide it actually renders, or every
 * thumbnail prints the active slide's number.
 *
 * `inject` always reads the PARENT's provides in Vue, so re-providing the same
 * key here cannot make this lookup self-referential. The provided value stays a
 * getter so the derivation re-runs when the deck settings or the slide change.
 */
export function provideSlideFieldContext(slide: () => PptxSlide | undefined): void {
	const deckSource = injectFieldContext();
	provide(FieldContextKey, () => deriveSlideFieldContext(resolveFieldContext(deckSource), slide()));
}
