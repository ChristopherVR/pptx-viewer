/**
 * Depth-first flattening of a slide's element tree.
 *
 * `PptxSlide.elements` is a tree, not a list: a `group` element carries its own
 * `children`, which may themselves be groups. Any pass that walks only the top
 * level therefore silently skips everything the user grouped. That is how a
 * chart dropped into a group ended up with no `chartData` and rendered as a
 * placeholder, while the identical chart outside the group rendered fine.
 *
 * @module flatten-elements
 */

import type { PptxElement } from '../types';

/** Depth cap mirroring the group parser's own recursion guard. */
const MAX_ELEMENT_DEPTH = 32;

/**
 * Walk an element tree depth-first, yielding every element including the
 * groups themselves.
 *
 * @param elements - The roots to walk (typically `slide.elements`).
 * @returns Every element in the tree, parents before their children.
 */
export function flattenElementsDeep(elements: readonly PptxElement[]): PptxElement[] {
	const out: PptxElement[] = [];
	const visit = (list: readonly PptxElement[], depth: number): void => {
		if (depth > MAX_ELEMENT_DEPTH) {
			return;
		}
		for (const element of list) {
			out.push(element);
			if (element.type === 'group' && Array.isArray(element.children)) {
				visit(element.children, depth + 1);
			}
		}
	};
	visit(elements, 0);
	return out;
}
