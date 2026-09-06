import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import type { ComputedFillStyle } from 'pptx-viewer-shared';
import {
	getContainerStyle,
	getGroupChildParentFill,
	resolveGroupChildFill,
} from 'pptx-viewer-shared';

import { createEl } from '../dom';
import { getShapeFillStrokeStyle } from '../element-styles';
import type { ElementRenderer } from '../types';
import { renderReflectionOverlay, renderShapeFilterDefs } from './shape-filter-defs';

/**
 * Paint a group child's `a:grpFill` inheritance onto its already-rendered node.
 *
 * The registry's `renderElement` contract is fixed (element, zIndex, context),
 * so the group renderer cannot thread the parent fill down as an argument the
 * way the component bindings do. Instead we resolve the inherited fill here and
 * apply it directly to the child's root node, overriding its (transparent)
 * self-fill. A no-op unless the child is a shape painted with `a:grpFill`.
 */
function applyGroupChildFill(node: HTMLElement | SVGElement, fill: ComputedFillStyle): void {
	if (fill.backgroundColor !== undefined) {
		node.style.backgroundColor = fill.backgroundColor;
	}
	if (fill.backgroundImage !== undefined) {
		node.style.backgroundImage = fill.backgroundImage;
	}
	if (fill.backgroundRepeat !== undefined) {
		node.style.backgroundRepeat = fill.backgroundRepeat;
	}
	if (fill.backgroundSize !== undefined) {
		node.style.backgroundSize = fill.backgroundSize;
	}
}

/**
 * Index an already-rendered subtree by `data-element-id`.
 *
 * Every renderer sets `dataset.elementId` on its root node (the registry
 * contract in `render/types.ts` requires it), so this recovers the node that
 * belongs to a given descendant element without depending on child ORDER -
 * `renderElement` returns `null` for a Selection-Pane-hidden element, so the
 * DOM children of a group are not 1:1 with its `children` array.
 */
function indexRenderedNodes(root: HTMLElement | SVGElement): Map<string, HTMLElement | SVGElement> {
	const byId = new Map<string, HTMLElement | SVGElement>();
	for (const node of root.querySelectorAll<HTMLElement | SVGElement>('[data-element-id]')) {
		const id = node.dataset.elementId;
		if (id !== undefined && !byId.has(id)) {
			byId.set(id, node);
		}
	}
	return byId;
}

/**
 * Paint the `a:grpFill` inheritance for one rendered group child and, when that
 * child is itself a group, for everything inside it.
 *
 * The outermost group does the whole subtree because the fixed
 * `renderElement(element, zIndex, context)` contract gives a nested group's own
 * invocation no way to learn what its parent inherited: it would resolve
 * against its own (absent) fill and paint the shapes inside it transparent.
 * `a:grpFill` resolves against the nearest ANCESTOR that has a fill, which is
 * what {@link getGroupChildParentFill} chains here.
 */
function paintInheritedFill(
	node: HTMLElement | SVGElement,
	element: PptxElement,
	parentGroupFill: ShapeStyle | undefined,
): void {
	const inherited = resolveGroupChildFill(element, parentGroupFill);
	if (inherited) {
		applyGroupChildFill(node, inherited);
	}
	if (element.type !== 'group') {
		return;
	}
	const childFill = getGroupChildParentFill(element, parentGroupFill);
	if (!childFill) {
		return;
	}
	const byId = indexRenderedNodes(node);
	for (const grandchild of element.children) {
		const grandchildNode = byId.get(grandchild.id);
		if (grandchildNode) {
			paintInheritedFill(grandchildNode, grandchild, childFill);
		}
	}
}

/**
 * Renderer for `group` elements: an absolutely positioned container that
 * recurses into `children` through the registry (so custom renderers apply
 * inside groups too). Children painted with `a:grpFill` inherit the fill of the
 * nearest enclosing group that has one.
 */
export const renderGroupElement: ElementRenderer = (element, zIndex, context) => {
	const el = createEl(context.document, 'div', 'pptxv-element pptxv-group', {
		...getContainerStyle(element, zIndex),
		// A group paints no fill/outline of its own, but `p:grpSpPr/a:effectLst`
		// DOES carry a shadow/glow/soft-edge for the group's own composite
		// raster (see shared `getComputedEffectStyle`), expressed as `filter` /
		// `overflow` here.
		...getShapeFillStrokeStyle(element),
	});
	el.dataset.elementId = element.id;

	// The soft-edge feather `<filter>` def, when the group carries one (its
	// `url(#soft-edge-<id>)` reference rides on the `filter` merged in above).
	const filterDefs = renderShapeFilterDefs(context.document, element);
	if (filterDefs) {
		el.appendChild(filterDefs);
	}

	// `p:grpSpPr/a:effectLst/a:reflection` (parsed onto `groupEffectStyle`)
	// mirrors the whole group subtree.
	const reflection = renderReflectionOverlay(context.document, element, context.mediaDataUrls);
	if (reflection) {
		el.appendChild(reflection);
	}

	if (element.type === 'group' && element.children?.length) {
		const parentGroupFill = getGroupChildParentFill(element);
		element.children.forEach((child: PptxElement, index) => {
			const childEl = context.renderElement(child, index);
			if (childEl) {
				paintInheritedFill(childEl, child, parentGroupFill);
				el.appendChild(childEl);
			}
		});
	}

	return el;
};
