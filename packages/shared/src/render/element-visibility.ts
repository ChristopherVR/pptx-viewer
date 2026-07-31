/**
 * The single rule that decides whether a slide element reaches the canvas.
 *
 * PowerPoint's Selection Pane eye toggle writes `p:cNvPr/@hidden="1"` on the
 * shape. A hidden shape is still an object on the slide (it keeps its place in
 * the z-order, stays listed and selectable in the Selection Pane, and survives
 * a save), but PowerPoint draws nothing for it: not on the editing canvas, not
 * in a slide show, not in print or export.
 *
 * Every binding routes its element renderer through {@link isElementHidden} so
 * one rule governs all five, rather than five copies drifting apart. The
 * bindings skip the element entirely instead of painting it with
 * `visibility: hidden`, because "not drawn" is the behaviour being modelled:
 * skipping guarantees the element cannot be hit-tested, cannot take focus,
 * cannot reach the accessibility tree, is never rasterised by the html2canvas
 * export path, and does not keep a `<video>` playing or a WebGL scene running
 * behind an invisible box. Nothing that must keep working depends on the DOM
 * node: the Selection Pane lists and selects from the slide model, not from the
 * rendered tree.
 *
 * `pptx-viewer-shared`'s `getContainerStyle` additionally emits `display: none`
 * for a hidden element. That is deliberate belt-and-braces for any surface that
 * paints an element without going through a binding's element-renderer entry
 * point; it is not the primary mechanism.
 *
 * @module render/element-visibility
 */

/** The subset of an element this module needs; keeps the helpers usable on partials. */
interface HideableElement {
	hidden?: boolean;
}

/**
 * Whether the Selection Pane has hidden this element.
 *
 * @param element - Any slide element (or a partial carrying `hidden`).
 * @returns `true` when the element must not be drawn.
 */
export function isElementHidden(element: HideableElement | null | undefined): boolean {
	return element?.hidden === true;
}

/**
 * Whether a renderer should draw this element. The inverse of
 * {@link isElementHidden}, spelled out so call sites read as intent
 * (`if (!isElementRendered(el)) return null`) rather than as a negated flag.
 *
 * @param element - Any slide element (or a partial carrying `hidden`).
 * @returns `true` when the element should reach the canvas.
 */
export function isElementRendered(element: HideableElement | null | undefined): boolean {
	return !isElementHidden(element);
}

/**
 * Drop hidden elements from a list, for the consumers that need a filtered
 * array rather than a per-element guard (reading order, export data, and any
 * loop that cannot early-return).
 *
 * Returns the input array unchanged (same reference) when nothing is hidden, so
 * the common case allocates nothing and reference-equality memoisation in the
 * bindings is not defeated on every render.
 *
 * @param elements - The elements to filter.
 * @returns The visible elements, in their original order.
 */
export function filterRenderedElements<T extends HideableElement>(
	elements: readonly T[],
): readonly T[] {
	return elements.some(isElementHidden) ? elements.filter(isElementRendered) : elements;
}
