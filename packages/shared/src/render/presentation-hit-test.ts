/**
 * Which rendered elements may be CLICKED while a slide show runs.
 *
 * In PowerPoint a running show is not a document you can poke at: only shapes
 * carrying an Action Setting, live media transport and real hyperlinks accept
 * the pointer. Everything else is scenery, and a click on it belongs to the
 * show (click-to-advance).
 *
 * React encodes that in its element renderer (`pointer-events-none` unless the
 * element is actionable). The other four bindings left every element hit-
 * testable, which is invisible until a deck stacks a large decorative shape
 * OVER its navigation: on the reporter's deck a 675px ring picture is painted
 * on top of the eight clickable wheel slices, so in Vue / Angular / Vanilla /
 * Svelte the ring swallowed every click and the slices could not be reached at
 * all - the show just stepped to the next slide instead.
 *
 * The rule is CSS rather than per-element style so a nested case works by
 * construction: an actionable shape INSIDE an inert group re-enables itself,
 * which a `pointer-events: none` written onto the group could never do.
 *
 * Scoped to `[data-pptx-presenting]`, which
 * `applyRenderedElementAccessibility` stamps on a stage that is a running show.
 *
 * @module render/presentation-hit-test
 */

/** Marker attribute a binding's stage carries while it is a running show. */
export const PRESENTATION_STAGE_ATTRIBUTE = 'data-pptx-presenting';

/**
 * Stylesheet text making a running show's scenery pointer-transparent.
 *
 * Inject once, alongside the animation keyframes; the attribute scope makes it
 * inert everywhere else.
 */
export const PRESENTATION_HIT_TEST_CSS = `
[${PRESENTATION_STAGE_ATTRIBUTE}] [data-element-id] {
	pointer-events: none;
}
[${PRESENTATION_STAGE_ATTRIBUTE}] [data-pptx-action],
[${PRESENTATION_STAGE_ATTRIBUTE}] [data-element-id] a[href],
[${PRESENTATION_STAGE_ATTRIBUTE}] [data-element-id] video[controls],
[${PRESENTATION_STAGE_ATTRIBUTE}] [data-element-id] audio[controls] {
	pointer-events: auto;
}
`;

/** Inputs for {@link inlineElementPointerEvents}. */
export interface InlinePointerEventsOptions {
	/** Whether this element may be selected / dragged on the editing canvas. */
	interactive: boolean;
	/** Whether the stage painting it is a running slide show. */
	presenting: boolean;
}

/**
 * The inline `pointer-events` an element renderer may write, if any.
 *
 * Off the show stage a locked element (an inherited master / layout shape with
 * template editing off) has to be pointer-transparent, and a binding says so
 * inline because nothing else knows the lock.
 *
 * During a show it must NOT: {@link PRESENTATION_HIT_TEST_CSS} owns the rule
 * there, and it works by re-enabling actionable shapes that sit inside inert
 * ones. An inline `none` on the element outranks any stylesheet, so writing one
 * makes every Action Setting on the slide unclickable and the show advances
 * instead of following the link. That is not a hypothetical: it is why the
 * wheel-of-slices deck could not be navigated in the bindings that wrote it.
 *
 * @returns `'none'` when the binding should write it, `undefined` to leave the
 *   property alone and let the cascade decide.
 */
export function inlineElementPointerEvents(
	options: InlinePointerEventsOptions,
): 'none' | undefined {
	if (options.presenting) {
		return undefined;
	}
	return options.interactive ? undefined : 'none';
}
