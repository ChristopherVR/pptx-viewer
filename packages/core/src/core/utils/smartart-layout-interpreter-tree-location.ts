/**
 * SmartArt DiagramML interpreter - flattened layout-node tree walk.
 *
 * Split out of `smartart-layout-interpreter-model.ts` (the repo's per-file
 * line budget) so `discoverArrangement` can give each visited `dgm:choose`
 * its declaring node's position among its siblings, sibling count, depth,
 * and the tree's max depth - the context `dgm:if` needs to decide
 * `func="pos"`/`"revPos"`/`"posEven"`/`"posOdd"`/`"depth"`/`"maxDepth"` (see
 * `smartart-layout-interpreter-when.ts`'s `WhenContext`). Pure TypeScript -
 * no framework code, no DOM.
 *
 * @module smartart-layout-interpreter-tree-location
 */

import type { PptxSmartArtLayoutNode } from '../types';

/** A node's location within the flattened layout-node tree, for `dgm:if` position/depth functions. */
export interface TreeLocation {
	/** 1-based ordinal among this node's own siblings (the parent's `children` array). */
	position: number;
	/** Sibling count `position` is measured against (for `revPos`). */
	total: number;
	/** 0-based depth from the root. */
	depth: number;
}

/** Depth-first walk of the flattened layout-node tree, tracking each node's {@link TreeLocation}. */
export function walkWithTreeLocation(
	node: PptxSmartArtLayoutNode,
	visit: (node: PptxSmartArtLayoutNode, location: TreeLocation) => void,
	location: TreeLocation = { position: 1, total: 1, depth: 0 },
): void {
	visit(node, location);
	const children = node.children ?? [];
	children.forEach((child, i) => {
		walkWithTreeLocation(child, visit, {
			position: i + 1,
			total: children.length,
			depth: location.depth + 1,
		});
	});
}

/** Deepest `depth` reached by {@link walkWithTreeLocation} over the whole tree, for `dgm:if func="maxDepth"`. */
export function treeMaxDepth(node: PptxSmartArtLayoutNode, depth = 0): number {
	const children = node.children ?? [];
	if (children.length === 0) {
		return depth;
	}
	return Math.max(...children.map((child) => treeMaxDepth(child, depth + 1)));
}
