/**
 * Decompose groups that take part in a morph, so a `!!`-named shape can be
 * matched across a grouping boundary.
 *
 * PowerPoint's `!!` naming convention pairs two shapes for Morph by name alone,
 * wherever they sit in the shape tree: a shape can be top-level on one slide
 * and nested inside a group on the next, and PowerPoint still carries it
 * through as one continuing object. Our matcher only ever saw a slide's
 * TOP-LEVEL elements, so such a pair never matched and both halves faded
 * instead (issue #131: the wheel deck keeps its centre as a bare shape on the
 * overview slide and wraps the identical artwork in a `!!Circle` group on every
 * topic slide).
 *
 * A group is decomposed only when it CONTAINS a `!!`-named descendant, which is
 * the deck author's explicit signal that its contents take part in the morph.
 * Every other group is left whole, so ordinary grouped artwork keeps animating
 * as a single unit exactly as before.
 *
 * Decomposed children are returned with ABSOLUTE slide coordinates, because
 * that is the space every downstream geometry calculation (deltas, proximity,
 * same-box) works in. A binding renders group children as absolutely positioned
 * boxes inside the group's own box, and the group carries no extra scale, so a
 * translation delta in slide space is also correct inside the group - which is
 * what lets the incoming half animate the child's own node in place.
 *
 * @module render/morph-flatten
 */

import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';

import { getElementMorphName } from './morph-matching';

/** Children of `element` when it is a group, else `undefined`. */
function groupChildren(element: PptxElement): PptxElement[] | undefined {
	if (element.type !== 'group') {
		return undefined;
	}
	const children = (element as GroupPptxElement).children;
	return Array.isArray(children) && children.length > 0 ? children : undefined;
}

/** Whether `element` or any descendant carries a `!!` morph name. */
function containsMorphNamedDescendant(element: PptxElement): boolean {
	const children = groupChildren(element);
	if (!children) {
		return false;
	}
	for (const child of children) {
		if (getElementMorphName(child) !== undefined || containsMorphNamedDescendant(child)) {
			return true;
		}
	}
	return false;
}

/**
 * Re-express a group child in absolute slide coordinates.
 *
 * Group children are stored relative to their group's box origin, already in
 * the group's rendered scale, so an absolute position is the running sum of the
 * ancestors' origins.
 */
function toAbsolute(child: PptxElement, offsetX: number, offsetY: number): PptxElement {
	if (offsetX === 0 && offsetY === 0) {
		return child;
	}
	return { ...child, x: child.x + offsetX, y: child.y + offsetY } as PptxElement;
}

/**
 * The elements of `elements` that a morph should treat as individual units.
 *
 * Groups holding a `!!`-named descendant are replaced by their children (in
 * document order, recursively, in absolute coordinates); everything else is
 * passed through untouched.
 */
export function flattenMorphElements(
	elements: readonly PptxElement[],
	offsetX = 0,
	offsetY = 0,
): PptxElement[] {
	const out: PptxElement[] = [];
	for (const element of elements) {
		const children = groupChildren(element);
		if (children && containsMorphNamedDescendant(element)) {
			out.push(...flattenMorphElements(children, offsetX + element.x, offsetY + element.y));
			continue;
		}
		out.push(toAbsolute(element, offsetX, offsetY));
	}
	return out;
}

/**
 * True when `elements` holds a group that {@link flattenMorphElements} would
 * decompose. Lets a caller skip the copy entirely for the overwhelmingly common
 * case of a slide with no `!!`-named group content.
 */
export function needsMorphFlattening(elements: readonly PptxElement[]): boolean {
	return elements.some((element) => containsMorphNamedDescendant(element));
}
