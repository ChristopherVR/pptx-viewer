/**
 * SmartArt DiagramML interpreter - `self`+`des` slot pairing for the
 * `composite` arranger's `dgm:presOf`-aware mapping.
 *
 * Split out of `smartart-layout-interpreter-composite.ts` (the repo's
 * per-file line budget): `arrangeByPresentationOf` needs this same
 * self-rect/des-fold resolution BEFORE it can run the shared font-fit
 * (round 18, `smartart-layout-interpreter-composite-fontfit.ts`) - the fit
 * needs every item's box and descendant text up front, not discovered one
 * at a time while rendering.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { findRingDesSibling, ringFoldRect } from './smartart-layout-interpreter-composite-ring';
import type { Slot, SlottedDims } from './smartart-layout-interpreter-composite-slots';
import { resolveSlot } from './smartart-layout-interpreter-composite-slots';
import type { BoundingBox } from './smartart-layout-types';
import { smartArtDescendantsWithText } from './smartart-node-tree-axis';

/** One `self`-anchored point, its resolved rect, and its paired `des` fold (when any). */
export interface SelfDesPair {
	node: PptxSmartArtNode;
	selfRect: Slot;
	/**
	 * The `self` slot's OWN layoutNode (round 28: for `findCompositeItemShape`
	 * to resolve its real declared preset from - `renderAnchoredPair` never
	 * had access to this before, so every self-anchored box silently fell
	 * through to the caller's own hardcoded family default).
	 */
	selfLayoutNode: PptxSmartArtLayoutNode;
	desSlot:
		| { rect: Slot; content: PptxSmartArtNode[]; layoutNode: PptxSmartArtLayoutNode }
		| undefined;
}

/** Resolve every `self`/`des` pair `arrangeByPresentationOf` will render, in point order. */
export function collectSelfDesPairs(
	selfSlots: SlottedDims[],
	desSlots: SlottedDims[],
	allChildren: PptxSmartArtLayoutNode[],
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	absX: number,
	absY: number,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	count: number,
): SelfDesPair[] {
	const pairs: SelfDesPair[] = [];
	for (let i = 0; i < count; i++) {
		const node = nodes[i];
		const selfRect = resolveSlot(selfSlots[i].dims, box, absX, absY);
		const desSlotted = desSlots[i];
		let desSlot = desSlotted
			? {
					rect: resolveSlot(desSlotted.dims, box, absX, absY),
					content: smartArtDescendantsWithText(node, childrenOf),
					layoutNode: desSlotted.node,
				}
			: undefined;
		const ringDesSibling = findRingDesSibling(allChildren, selfSlots[i].node);
		if (!desSlot && ringDesSibling) {
			const content = smartArtDescendantsWithText(node, childrenOf);
			if (content.length > 0) {
				desSlot = { rect: ringFoldRect(selfRect), content, layoutNode: ringDesSibling };
			}
		}
		pairs.push({ node, selfRect, selfLayoutNode: selfSlots[i].node, desSlot });
	}
	return pairs;
}
