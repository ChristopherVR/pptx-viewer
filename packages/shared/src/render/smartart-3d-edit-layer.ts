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

/**
 * Controls the layer shows on top of the diagram copy (the node editor, the
 * fill swatches). They are real UI, so they keep their accessible name.
 */
const CONTROL_SELECTOR = 'button, textarea, input, select';

/** Remove the element markers from `root` and everything under it, except on its controls. */
export function stripEditLayerMarkers(root: Element): void {
	for (const el of [root, ...root.querySelectorAll('*')]) {
		if (el.matches(CONTROL_SELECTOR)) {
			continue;
		}
		for (const attr of EDIT_LAYER_MARKER_ATTRS) {
			if (el.hasAttribute(attr)) {
				el.removeAttribute(attr);
			}
		}
	}
}

/** Shapes a node group draws (the text and decoration carry no hit area of their own). */
const GEOMETRY_SELECTOR = 'path, rect, polygon, polyline, ellipse, circle';

/**
 * Whether viewport point `(x, y)` is on one of `node`'s drawn shapes, tested in
 * each shape's own coordinates so a turned or scaled diagram is hit where it is
 * drawn, not where its axis-aligned bounding box reaches. `null` when the node
 * has no shape this can be asked of (a host without SVG geometry).
 */
function nodeShapeContainsPoint(node: Element, x: number, y: number): boolean | null {
	let tested = false;
	for (const shape of node.querySelectorAll(GEOMETRY_SELECTOR)) {
		const geometry = shape as Partial<SVGGeometryElement>;
		const matrix = geometry.getScreenCTM?.();
		if (!matrix || typeof geometry.isPointInFill !== 'function') {
			continue;
		}
		const det = matrix.a * matrix.d - matrix.b * matrix.c;
		if (!det) {
			continue;
		}
		tested = true;
		const dx = x - matrix.e;
		const dy = y - matrix.f;
		const local = {
			x: (matrix.d * dx - matrix.c * dy) / det,
			y: (matrix.a * dy - matrix.b * dx) / det,
		};
		if (geometry.isPointInFill(local) || geometry.isPointInStroke?.(local)) {
			return true;
		}
	}
	return tested ? false : null;
}

/**
 * The `[data-smartart-node-id]` element under viewport point `(x, y)` inside
 * `root`, by geometry: the smallest node containing the point. Unlike
 * `document.elementsFromPoint`, this finds nodes that hit-testing skips, such
 * as a hidden layer's `pointer-events: none` groups.
 *
 * A node is tested against its drawn shapes where the host can, so a rotated
 * diagram resolves the node under the pointer rather than a neighbour whose
 * bounding box merely overlaps it; otherwise by its bounding box.
 */
export function smartArtNodeAtPoint(root: ParentNode, x: number, y: number): Element | null {
	let best: Element | null = null;
	let bestArea = Number.POSITIVE_INFINITY;
	for (const node of root.querySelectorAll('[data-smartart-node-id]')) {
		const box = node.getBoundingClientRect();
		const area = box.width * box.height;
		if (area <= 0 || area >= bestArea) {
			continue;
		}
		const onShape = nodeShapeContainsPoint(node, x, y);
		const hit = onShape ?? (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
		if (hit) {
			best = node;
			bestArea = area;
		}
	}
	return best;
}
