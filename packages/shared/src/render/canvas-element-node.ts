/**
 * Find the editing canvas's DOM node for a slide element.
 *
 * Every binding marks a rendered element with `data-element-id`, but Angular,
 * Svelte and Vanilla leave that marker on the slides-pane thumbnails too, and
 * the thumbnail rail sits AHEAD of the main canvas in their DOM. A bare
 * `document.querySelector('[data-element-id="..."]')` therefore returned the
 * thumbnail's copy: the ribbon's animation Preview played on a 150px
 * thumbnail, and the Paste Options toolbar anchored itself to one. The main
 * canvas is the `[data-pptx-viewport]` subtree in all five bindings, so that
 * copy wins; anywhere else is only a fallback for hosts without one.
 *
 * @module render/canvas-element-node
 */

function idSelector(elementId: string): string {
	const escaped =
		typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
			? CSS.escape(elementId)
			: elementId.replace(/["\\]/gu, '\\$&');
	return `[data-element-id="${escaped}"]`;
}

/**
 * The main-canvas node for `elementId`, else (unless `canvasOnly`) the first
 * node anywhere, else null. Pass `canvasOnly` when a thumbnail copy would be
 * actively wrong, e.g. anchoring on-canvas chrome to a node that has not
 * rendered on the canvas yet.
 */
export function findCanvasElementNode(
	root: ParentNode,
	elementId: string,
	options: { canvasOnly?: boolean } = {},
): HTMLElement | null {
	const selector = idSelector(elementId);
	const onCanvas = root.querySelector<HTMLElement>(`[data-pptx-viewport] ${selector}`);
	if (onCanvas || options.canvasOnly) {
		return onCanvas;
	}
	return root.querySelector<HTMLElement>(selector);
}
