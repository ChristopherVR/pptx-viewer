import type { PptxElement } from 'pptx-viewer-core';

import type { ElementRenderContext } from './types';

/** An element located in the render tree, with its z-index among its siblings. */
interface LocatedElement {
	element: PptxElement;
	zIndex: number;
}

/**
 * Depth-first locate a renderable element by id in a slide element tree,
 * descending into group children. The returned `zIndex` is the element's index
 * among its own siblings, matching how the stage / group renderers assign it.
 */
function findRenderable(elements: readonly PptxElement[], id: string): LocatedElement | undefined {
	for (const [index, element] of elements.entries()) {
		if (element.id === id) {
			return { element, zIndex: index };
		}
		if (element.type === 'group') {
			const nested = findRenderable(element.children ?? [], id);
			if (nested) {
				return nested;
			}
		}
	}
	return undefined;
}

/** Find the rendered wrapper node for an element id under `root`. */
function findElementNode(root: HTMLElement, id: string): HTMLElement | null {
	for (const node of root.querySelectorAll<HTMLElement>('[data-element-id]')) {
		if (node.dataset.elementId === id) {
			return node;
		}
	}
	return null;
}

/**
 * Re-render the given tracked elements in place against the current playback
 * element states (read by the renderers from `context.presentationStates`).
 *
 * Chart / SmartArt wrappers keep their node identity (only their content is
 * swapped) so a running wrapper CSS animation is not restarted by a per-frame
 * staged-build re-render; other elements (shapes relinquishing static paint for
 * a `p:animClr` colour animation) are replaced wholesale because the wrapper's
 * own box paint changes. Mirrors the reactive per-element re-render the React /
 * Vue bindings get for free from their frameworks.
 */
export function reRenderPresentationElements(
	context: ElementRenderContext,
	stage: HTMLElement,
	ids: readonly string[],
): void {
	for (const id of ids) {
		const found = findRenderable(context.slide.elements, id);
		const old = findElementNode(stage, id);
		if (!found || !old) {
			continue;
		}
		const fresh = context.renderElement(found.element, found.zIndex);
		if (!fresh) {
			continue;
		}
		if (found.element.type === 'chart' || found.element.type === 'smartArt') {
			old.replaceChildren(...Array.from(fresh.childNodes));
		} else {
			old.replaceWith(fresh);
		}
	}
}
