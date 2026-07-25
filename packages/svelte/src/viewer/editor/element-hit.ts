/**
 * Hit-testing for the editing layer: map a pointer-event target inside the
 * rendered stage back to the TOP-LEVEL slide element it belongs to.
 *
 * Renderers set `data-element-id` on every element root (groups nest their
 * children's roots inside their own), so the innermost match identifies the
 * hit and the outermost ancestor with the attribute identifies the top-level
 * element the editor selects and transforms. Native DOM hit-testing already
 * gives us the visually topmost node, so z-order comes for free.
 */

const ELEMENT_SELECTOR = '[data-element-id]';

/** Marks the selection chrome (box, resize handles, rotate knob). */
const SELECTION_OVERLAY_SELECTOR = '[data-pptx-selection-overlay]';

/**
 * Resolve the top-level element id for an event target within `stageRoot`,
 * or `null` when the target is not inside a rendered element (empty canvas,
 * chrome, overlay).
 */
export function resolveTopLevelElementId(
	target: EventTarget | null,
	stageRoot: Element | null,
): string | null {
	if (!stageRoot || !(target instanceof Element)) {
		return null;
	}
	const hit = target.closest(ELEMENT_SELECTOR);
	if (!hit || !stageRoot.contains(hit) || hit === stageRoot) {
		return null;
	}
	// Climb to the outermost element node below the stage root (group children
	// resolve to their group so the whole group moves as one).
	let top: Element = hit;
	let parent = hit.parentElement;
	while (parent && parent !== stageRoot) {
		if (parent.hasAttribute('data-element-id')) {
			top = parent;
		}
		parent = parent.parentElement;
	}
	// The hit must actually be inside the stage subtree (not a sibling overlay).
	return parent === stageRoot ? top.getAttribute('data-element-id') : null;
}

/**
 * Resolve the element a double-click / double-tap is meant for, tolerating a
 * hit on the selection chrome.
 *
 * On a coarse pointer the resize handles are grown to a finger-friendly 22px so
 * they can be grabbed at all. On a small shape - a Pixel 7 renders a typical
 * text box at roughly 57x43 css px - those handles cover part of the shape's
 * own body, so the second tap of a double-tap lands on a handle button. That
 * button lives in the overlay rather than inside the element, so
 * {@link resolveTopLevelElementId} alone returns `null` and inline edit never
 * opens.
 *
 * The selection chrome only ever renders on the selected element's own box, so
 * a double-tap that landed on it belongs to `selectedElementId`.
 */
export function resolveEditTargetElementId(
	target: EventTarget | null,
	stageRoot: Element | null,
	selectedElementId: string | null,
): string | null {
	const direct = resolveTopLevelElementId(target, stageRoot);
	if (direct) {
		return direct;
	}
	if (target instanceof Element && target.closest(SELECTION_OVERLAY_SELECTOR)) {
		return selectedElementId;
	}
	return null;
}
