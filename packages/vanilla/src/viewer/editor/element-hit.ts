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
