/** Geometry mirrored to the detached selection-handle overlay during a gesture. */
export interface SelectionHandleOverlayGeometry {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	transform?: string;
}

/**
 * The subtree one viewer instance owns. Every binding's canvas wrapper carries
 * this attribute, so it bounds the lookup to the instance the gesture is
 * happening in.
 */
const VIEWPORT_SELECTOR = '[data-pptx-viewport]';

/**
 * Find the selection-handle host that shadows `elementId`, searching only the
 * viewer instance that contains `elementNode`.
 *
 * Scoped, not `document`-wide, because element ids are per deck, not per
 * page: two viewers of the same deck on one page (the docs landing, a
 * side-by-side collab demo) each render a `[data-pptx-handle-for="<id>"]` for
 * the same selected id, and a page-wide query would move the OTHER viewer's
 * handles. Falls back to the element's parent (the stage) when a caller
 * mounts the node outside a viewport wrapper, as unit tests do.
 *
 * Matched by attribute compare rather than by splicing the id into a
 * selector: the id is deck-authored text, and the same pattern as shared's
 * `findMediaElementByElementId` keeps it out of the selector grammar.
 */
export function findSelectionHandleHost(
	elementNode: Element,
	elementId: string,
): HTMLElement | null {
	const scope = elementNode.closest(VIEWPORT_SELECTOR) ?? elementNode.parentElement;
	if (!scope) {
		return null;
	}
	for (const candidate of scope.querySelectorAll<HTMLElement>('[data-pptx-handle-for]')) {
		if (candidate.getAttribute('data-pptx-handle-for') === elementId) {
			return candidate;
		}
	}
	return null;
}

/**
 * Keep React's stage-level selection handles aligned with the element DOM node
 * while drag, resize, and rotate gestures bypass React state for live preview.
 *
 * The overlay is a sibling rather than a child of the element, so it does not
 * inherit those imperative style writes. React remains authoritative after the
 * pointer-up commit and replaces these temporary values on the next render.
 */
export function syncSelectionHandleOverlay(
	elementNode: Element,
	elementId: string,
	geometry: SelectionHandleOverlayGeometry,
): void {
	const host = findSelectionHandleHost(elementNode, elementId);
	if (!host) {
		return;
	}
	if (geometry.x !== undefined) {
		host.style.left = `${geometry.x}px`;
	}
	if (geometry.y !== undefined) {
		host.style.top = `${geometry.y}px`;
	}
	if (geometry.width !== undefined) {
		host.style.width = `${geometry.width}px`;
	}
	if (geometry.height !== undefined) {
		host.style.height = `${geometry.height}px`;
	}
	if (geometry.transform !== undefined) {
		host.style.transform = geometry.transform;
	}
}
