import type { FieldSubstitutionContext } from 'pptx-viewer-shared';
import { getContext, setContext } from 'svelte';

/**
 * Svelte context wiring for the OOXML field-substitution context (slide number,
 * date/time, header/footer, slide title, custom document properties) used by the
 * text renderers, mirroring Vue's `FieldContextKey` provide/inject and Angular's
 * `FieldContextService`.
 *
 * Two layers share one key, so a consumer only ever reads the nearest value:
 * `PowerPointViewer` provides the deck-level context at the root, and each
 * `SlideStage` re-provides it re-pointed at the slide it actually paints (a
 * thumbnail must show its own number, not the active slide's).
 *
 * The provided value is a GETTER, not a plain context object, because Svelte
 * context is captured once at component initialisation: closing over the live
 * runes state is what keeps a consumer's `$derived` re-running when the deck
 * settings or the current slide change.
 */

/** Getter over the current field-substitution context (`undefined` = no substitution). */
export type FieldContextGetter = () => FieldSubstitutionContext | undefined;

/**
 * Exported (not just module-private) so tests can seed it directly via
 * `mount(Component, { context: new Map([[FieldContextKey, () => ctx]]) })`
 * without needing a full `PowerPointViewer` host tree.
 */
export const FieldContextKey = Symbol('pptx-svelte-field-context');

/** Provide the field-context getter to the component subtree (root and each stage). */
export function provideFieldContext(getFieldContext: FieldContextGetter): void {
	setContext(FieldContextKey, getFieldContext);
}

/**
 * The field-context GETTER for this subtree, or `undefined` when nothing
 * provides one (standalone renderer, export, unit test), in which case field
 * runs keep their authored placeholder text.
 *
 * `getContext` only resolves during component initialisation, so this must be
 * called at init and the returned getter invoked inside a `$derived` to keep the
 * read reactive.
 */
export function getFieldContextGetter(): FieldContextGetter | undefined {
	return getContext<FieldContextGetter | undefined>(FieldContextKey);
}
