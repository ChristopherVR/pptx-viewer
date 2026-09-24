/**
 * Tab / Shift+Tab selection cycling: PowerPoint moves the current selection to
 * the next (or previous) object on the slide, in tab order, wrapping at both
 * ends. This is the one pure decision the five bindings would otherwise each
 * reimplement over their own element-id array, so it lives here once.
 *
 * @module render/selection-cycle
 */

/** A Tab press's direction through the slide's elements. */
export type SelectionCycleDirection = 'next' | 'prev';

/**
 * Resolve the element a Tab (or Shift+Tab) press should select next.
 *
 * `ids` is the slide's elements in tab order (typically z-order, matching
 * `slide.elements`). With nothing currently selected, `next` lands on the
 * first element and `prev` on the last, mirroring PowerPoint. With a
 * selection that is no longer in `ids` (the element was deleted, or belongs
 * to another slide), the cycle restarts the same way. Returns `null` only
 * when the slide has no elements to select.
 */
export function cycleSelectableElement(
	ids: readonly string[],
	currentId: string | null,
	direction: SelectionCycleDirection,
): string | null {
	if (ids.length === 0) {
		return null;
	}
	const currentIndex = currentId === null ? -1 : ids.indexOf(currentId);
	if (currentIndex === -1) {
		return direction === 'next' ? ids[0] : ids[ids.length - 1];
	}
	const step = direction === 'next' ? 1 : -1;
	const nextIndex = (currentIndex + step + ids.length) % ids.length;
	return ids[nextIndex];
}
