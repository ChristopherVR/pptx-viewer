/** Geometry mirrored to the detached selection-handle overlay during a gesture. */
export interface SelectionHandleOverlayGeometry {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	transform?: string;
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
	elementId: string,
	geometry: SelectionHandleOverlayGeometry,
): void {
	if (typeof document === 'undefined') {
		return;
	}

	for (const candidate of document.querySelectorAll<HTMLElement>('[data-pptx-handle-for]')) {
		if (candidate.getAttribute('data-pptx-handle-for') !== elementId) {
			continue;
		}
		if (geometry.x !== undefined) {
			candidate.style.left = `${geometry.x}px`;
		}
		if (geometry.y !== undefined) {
			candidate.style.top = `${geometry.y}px`;
		}
		if (geometry.width !== undefined) {
			candidate.style.width = `${geometry.width}px`;
		}
		if (geometry.height !== undefined) {
			candidate.style.height = `${geometry.height}px`;
		}
		if (geometry.transform !== undefined) {
			candidate.style.transform = geometry.transform;
		}
		return;
	}
}
