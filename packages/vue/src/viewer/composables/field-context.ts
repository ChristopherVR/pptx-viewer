import type { PptxSlide } from 'pptx-viewer-core';
import type { FieldSubstitutionContext } from 'pptx-viewer-shared';
import type { InjectionKey, MaybeRefOrGetter } from 'vue';
import { inject, toValue } from 'vue';

/**
 * Field-substitution context made available to the element text renderers for
 * resolving OOXML field runs (slide number, date/time, header/footer, slide
 * title, document properties) into display text.
 *
 * Provided once at the viewer root via {@link FieldContextKey} and injected by
 * `ElementRenderer` / `WordArtText`, so the hot `SlideStage` -> `ElementRenderer`
 * prop chain does not have to thread the context through every element. Mirrors
 * the React `fieldContext` built in `ViewerCanvasArea`.
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
 * Extract the slide-title text from the first title / centre-title placeholder
 * element on a slide, mirroring React's `ViewerCanvasArea` title scan. The
 * `placeholderType` discriminant is not a typed field on `PptxElement`, so it
 * is read via a narrow cast.
 */
export function resolveSlideTitle(slide: PptxSlide | undefined): string | undefined {
	if (!slide) {
		return undefined;
	}
	for (const el of slide.elements) {
		const phType = (el as { placeholderType?: string }).placeholderType;
		if (phType === 'title' || phType === 'ctrTitle') {
			const txt = (el as { text?: string }).text;
			if (txt) {
				return txt;
			}
		}
	}
	return undefined;
}
