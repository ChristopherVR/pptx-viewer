/**
 * SmartArt DiagramML interpreter - composite slot alternative detection.
 *
 * `discoverArrangement`'s own top-level walk (`smartart-layout-interpreter-
 * model.ts`) can reach a `dgm:choose`-flattened branch that describes ONE of
 * an already-resolved top-level `composite`'s OWN slots, not a competing
 * whole-diagram algorithm - `radial-cluster--hier5.pptx`'s `singleCycle`, a
 * `cycle` alg reached through `Name0`'s own `<dgm:forEach name="singleCycle"
 * ...>`. Pure TypeScript - no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode } from '../types';

/**
 * `true` when `node` was reached through one of `compositeSlot`'s OWN
 * `dgm:forEach` children (matched by `@name`, the one stable identity a
 * choose-flattened forEach-wrapped alternative still carries after
 * `nestedLayoutNodes` flattens both the `dgm:forEach` and any `dgm:choose`
 * wrapping it onto `.children`) - i.e. `node` IS one of `compositeSlot`'s
 * own child slots, reached via a different branch of the same `dgm:choose`
 * machinery that `compositeSlot` itself already resolved through
 * `mapsSlots`. A structural algorithm resolved from such a node describes
 * that ONE SLOT's own small internal arrangement, not a competing
 * whole-diagram algorithm - `compositeSlot`'s own top-level composite
 * identity must win instead.
 *
 * `false` whenever `compositeSlot` is not yet resolved (nothing to compare
 * against - by construction the composite root is always visited before any
 * descendant reached through one of its own forEach-wrapped slots, in the
 * same preorder walk, so this never fires prematurely), or `node` carries no
 * `forEachOrigin` of its own (a direct child, never reached through ANY
 * forEach).
 */
export function isMappedSlotAlternative(
	compositeSlot: PptxSmartArtLayoutNode | undefined,
	node: PptxSmartArtLayoutNode,
): boolean {
	const originName = node.forEachOrigin?.name;
	if (!compositeSlot || !originName) {
		return false;
	}
	return (compositeSlot.forEach ?? []).some((entry) => entry.name === originName);
}
