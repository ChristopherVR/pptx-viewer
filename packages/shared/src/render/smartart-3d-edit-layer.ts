/**
 * The inline-editing layer over a 3D SmartArt view (framework-agnostic).
 *
 * `<pptx-three-view>` keeps a SmartArt's 2D SVG only as its fallback, hidden
 * once the scene is up, so a binding that edits node text on the canvas lays
 * a second render of the diagram over the scene with its SVG paint hidden:
 * its `[data-smartart-node-id]` groups still take the double-click and the
 * textarea it opens is not SVG, so it shows. That layer is an input surface,
 * not a second copy of the element, so its element markers go.
 *
 * @module smartart-3d-edit-layer
 */

/** Element markers a second render of a diagram must not repeat. */
export const EDIT_LAYER_MARKER_ATTRS = [
	'data-element-id',
	'data-testid',
	'data-pptx-element',
	'role',
	'aria-label',
	'aria-roledescription',
] as const;

/** Remove the element markers from `root` and everything under it. */
export function stripEditLayerMarkers(root: Element): void {
	for (const el of [root, ...root.querySelectorAll('*')]) {
		for (const attr of EDIT_LAYER_MARKER_ATTRS) {
			if (el.hasAttribute(attr)) {
				el.removeAttribute(attr);
			}
		}
	}
}

/**
 * The `[data-smartart-node-id]` element under viewport point `(x, y)` inside
 * `root`, by geometry: the smallest node box containing the point. Unlike
 * `document.elementsFromPoint`, this finds nodes that hit-testing skips, such
 * as a hidden layer's `pointer-events: none` groups.
 */
export function smartArtNodeAtPoint(root: ParentNode, x: number, y: number): Element | null {
	let best: Element | null = null;
	let bestArea = Number.POSITIVE_INFINITY;
	for (const node of root.querySelectorAll('[data-smartart-node-id]')) {
		const box = node.getBoundingClientRect();
		const area = box.width * box.height;
		if (
			area > 0 &&
			x >= box.left &&
			x <= box.right &&
			y >= box.top &&
			y <= box.bottom &&
			area < bestArea
		) {
			best = node;
			bestArea = area;
		}
	}
	return best;
}
