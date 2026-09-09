/**
 * SmartArt DiagramML interpreter - hierarchy sibling ordering.
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * this is a standalone concern (fixing up `dgm:ptLst` declaration order into
 * true left-to-right sibling order before `buildTree` runs), unrelated to
 * that module's axis-transposition machinery.
 *
 * Pure geometry/data reordering; no framework code, no DOM.
 */

import type { PptxSmartArtNode } from '../types';

/**
 * Reorder `nodes` by `childOrder` (`childId -> srcOrd`, built from `dgm:cxn`'s
 * own `srcOrd` by `smartart-layout-interpreter.ts`'s `buildChildOrder`) - the
 * flat array is in `dgm:ptLst` declaration order, which is NOT necessarily
 * true left-to-right sibling order (COM-verified against
 * `hierarchy--hier8.pptx`: 5 siblings' `ptLst` order does not match their
 * cached rendering order, but sorting by `srcOrd` reproduces it exactly).
 *
 * `srcOrd` is only meaningful WITHIN one parent's own children - every parent
 * numbers its direct reports independently starting near 0/1, so a manager
 * with id "M2" and a manager with id "M4" can each have a child at `srcOrd
 * 0`. Sorting the WHOLE flat array by that value directly (comparing across
 * different parents) interleaves unrelated branches and corrupts the tree
 * `buildTree` is about to build from this array's order - COM-verified
 * regression against `smartart-orgchart-fan-variants.pptx` (multiple
 * managers, each with several reports): a global sort scattered 14 of the
 * genuine-fixture suite's row/stack assertions by hundreds of pixels, while
 * `hierarchy--hier8.pptx` (a single flat generation, one parent) never
 * exercised the multi-parent case at all. Only compares `srcOrd` between
 * nodes that share the SAME `parentId`; a stable sort (guaranteed by the
 * language since ES2019) preserves the original relative order between
 * different sibling groups untouched, so this generalises to any number of
 * branches instead of only the single-parent case it was first measured on.
 * Falls back to the node's original array position when it has no
 * `childOrder` entry (e.g. the root) so relative order among those is
 * unchanged. A no-op (returns `nodes` unchanged) when `childOrder` is absent,
 * so every caller that does not have connection data keeps prior behaviour.
 */
export function applyChildOrder(
	nodes: PptxSmartArtNode[],
	childOrder: Map<string, number> | undefined,
): PptxSmartArtNode[] {
	if (!childOrder) {
		return nodes;
	}
	return nodes
		.map((node, originalIndex) => ({ node, originalIndex }))
		.sort((a, b) => {
			if (a.node.parentId !== b.node.parentId) {
				return 0;
			}
			const orderA = childOrder.get(a.node.id) ?? a.originalIndex;
			const orderB = childOrder.get(b.node.id) ?? b.originalIndex;
			return orderA - orderB;
		})
		.map((entry) => entry.node);
}
