/**
 * Which slide element does a pointer event select?
 *
 * Every binding renders one `[data-element-id]` node per element, and a group
 * renders its children's nodes INSIDE its own. A naive `closest()` therefore
 * answers with the innermost node, which is a grouped CHILD, not the group.
 * PowerPoint selects the group on a single click: a group is one object until
 * the user explicitly enters it. Answering with the child instead is not a
 * cosmetic difference, it breaks selection outright, because a child id is not
 * in the slide's top-level element list:
 *
 *   - Angular looked the id up in `allElements` and, finding nothing, reported
 *     "no element here", so a click on a child CLEARED the selection.
 *   - Vue selected the child id, which no top-level element matches, so the
 *     selection chrome and the context menu both came back empty.
 *
 * Either way Ungroup became reachable only by hitting a gap inside the group's
 * bounding box that misses every child, which on a tightly packed group is
 * impossible. React (via DOM bubbling to the group's own handler), Vanilla and
 * Svelte (via the ancestor climb below, which this module absorbs from their
 * duplicated copies) already answered with the group, so the group is the
 * majority behaviour as well as the correct one.
 *
 * Native DOM hit-testing already returns the visually topmost node, so z-order
 * comes for free; this module only decides how far UP from that node to walk.
 *
 * @module render/element-hit-test
 */

/** Attribute every binding puts on an element's rendered root. */
export const ELEMENT_ID_SELECTOR = '[data-element-id]';

/** Marks the selection chrome (box, resize handles, rotate knob). */
export const SELECTION_OVERLAY_SELECTOR = '[data-pptx-selection-overlay]';

/**
 * Narrow an event target to an `Element` by capability rather than
 * `instanceof`, which is false across realms (iframes, popped-out windows) and
 * needs a DOM global that not every consumer's test environment defines.
 */
function asElement(target: EventTarget | null | undefined): Element | null {
	if (!target || typeof (target as Element).closest !== 'function') {
		return null;
	}
	return target as Element;
}

/**
 * The INNERMOST element node under `target`, i.e. the grouped child itself.
 *
 * This is the drill-in half of the hit-test, kept beside the top-level one so a
 * binding that lets the user enter a group ("second click selects the child")
 * does not have to re-derive it from the DOM. Selection must NOT use it.
 */
export function resolveHitElementId(target: EventTarget | null | undefined): string | null {
	return asElement(target)?.closest(ELEMENT_ID_SELECTOR)?.getAttribute('data-element-id') ?? null;
}

/**
 * The chain of element ids under `target`, innermost first, outermost last.
 *
 * `chain[0]` is the grouped child that was physically hit and the last entry is
 * the top-level element a click selects; anything between is an intermediate
 * group in a nested group. Exposed so a binding can implement drill-in (or a
 * "select parent" step) without walking the DOM again.
 */
export function resolveElementIdChain(
	target: EventTarget | null | undefined,
	stageRoot?: Element | null,
): string[] {
	const scoped = stageRoot !== undefined;
	if (scoped && !stageRoot) {
		return [];
	}
	const hit = asElement(target)?.closest(ELEMENT_ID_SELECTOR);
	if (!hit || (scoped && (hit === stageRoot || !stageRoot?.contains(hit)))) {
		return [];
	}
	const chain: string[] = [];
	let node: Element | null = hit;
	while (node && node !== stageRoot) {
		const id = node.getAttribute('data-element-id');
		if (id) {
			chain.push(id);
		}
		node = node.parentElement;
	}
	// A scoped call must land exactly on the stage root: anything else means the
	// hit came from a sibling overlay that happens to carry element ids.
	return scoped && node !== stageRoot ? [] : chain;
}

/**
 * The TOP-LEVEL element id for an event target: what a single click selects.
 *
 * `stageRoot` is the boundary the walk stops at. Pass it to reject hits that
 * came from a sibling overlay rather than the rendered slide; passing `null`
 * (the stage is not mounted yet) resolves to no hit. OMIT the argument
 * entirely to walk to the document root, which is what bindings that have no
 * stage handle at the call site do: only element roots carry
 * `data-element-id`, so the outermost one is still the top-level element.
 */
export function resolveTopLevelElementId(
	target: EventTarget | null | undefined,
	stageRoot?: Element | null,
): string | null {
	// Indexed rather than `.at(-1)`: Angular vendors this file and compiles it
	// against an ES2021 lib, where `Array.prototype.at` does not exist.
	const chain = resolveElementIdChain(target, stageRoot);
	return chain.length > 0 ? chain[chain.length - 1] : null;
}

/**
 * Resolve the element a double-click / double-tap is meant for, tolerating a
 * hit on the selection chrome.
 *
 * On a coarse pointer the resize handles are grown to a finger-friendly 22px so
 * they can be grabbed at all. On a small shape (a Pixel 7 renders a typical
 * text box at roughly 57x43 css px) those handles cover part of the shape's own
 * body, so the second tap of a double-tap lands on a handle button. That button
 * lives in the overlay rather than inside the element, so
 * {@link resolveTopLevelElementId} alone returns `null` and inline edit never
 * opens.
 *
 * The selection chrome only ever renders on the selected element's own box, so
 * a double-tap that landed on it belongs to `selectedElementId`.
 */
export function resolveEditTargetElementId(
	target: EventTarget | null | undefined,
	stageRoot: Element | null,
	selectedElementId: string | null,
): string | null {
	const direct = resolveTopLevelElementId(target, stageRoot);
	if (direct) {
		return direct;
	}
	return asElement(target)?.closest(SELECTION_OVERLAY_SELECTOR) ? selectedElementId : null;
}
