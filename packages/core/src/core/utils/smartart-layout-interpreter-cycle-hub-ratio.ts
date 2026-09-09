/**
 * SmartArt DiagramML interpreter - hub/ring-item sizing ratios for a
 * hub+satellite `cycle` composite (`radial-cycle`, `basic-radial`,
 * `diverging-radial`, `converging-radial`, `radial-list`).
 *
 * Split out of `smartart-layout-interpreter-cycle-constraints.ts` to keep
 * that file under the repo's per-file line budget. Pure constraint reading;
 * no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';

/**
 * `node.w = fact * <hubName>.w` (`radial-cycle`'s `w for="ch" forName="node"
 * refType="w" refFor="ch" refForName="centerShape" fact="0.7"`, or
 * `basic-radial`'s SAME shape with NO `fact` at all - `op="equ"` with an
 * implicit `factor` of 1, ECMA-376's own default for an omitted `fact`,
 * COM-verified: `basic-radial--hier5.pptx`'s cached hub is the literal SAME
 * size as its satellites): the ring item's own width, DECLARED as a
 * fraction of the hub's, in the SAME "natural" (pre-anisotropic-scale) unit
 * space `computeCycleRingLayout` already works in (the ring item's own
 * natural width is fixed at 1 there) - so the hub's own natural width is
 * `1 / fact`, giving the hub's SCALED size directly from the ring's own
 * already-solved `scaleX`/`scaleY` without a separate geometric "clears the
 * nearest ring node" guess. `hubName` (the OTHER end of the reference) is
 * returned too so a caller can sanity-check it against the actual hub
 * node's own name when one is known, though every composite ring layout
 * examined names it `centerShape`.
 */
export function resolveHubToNodeRatio(
	ringItem: PptxSmartArtLayoutNode | undefined,
	arrangerConstraints: PptxSmartArtLayoutNode['constraints'],
): { hubName: string; factor: number } | undefined {
	if (!ringItem?.name) {
		return undefined;
	}
	const match = (arrangerConstraints ?? []).find(
		(c) =>
			c.type === 'w' &&
			c.forName === ringItem.name &&
			c.referenceType === 'w' &&
			(c.factor === undefined || (typeof c.factor === 'number' && c.factor > 0)) &&
			typeof c.referenceForName === 'string',
	);
	if (!match) {
		return undefined;
	}
	return { hubName: match.referenceForName as string, factor: match.factor ?? 1 };
}

/**
 * The natural (ring-item-width-unit) gap between the hub and each ring node,
 * from the arranger's own `sp` constraint - ECMA-376's "space between a
 * hierarchical parent and its children", reused by every hub+ring composite
 * examined for "space between the centre shape and each satellite".
 * COM-verified against `basic-radial--hier5.pptx`: the hub-to-satellite
 * screen distance (measured from the cached drawing) divides out to
 * `r0 = 1.306` in this module's own natural unit space (ring item width =
 * 1); `hubHalfWidth(0.5, hubRatio factor 1) + sp(0.3) + itemHalfWidth(0.5) =
 * 1.3` matches within rounding of the cached pixel measurement. This is a
 * DIFFERENT quantity from `sibSp` (adjacent-SATELLITE spacing, used for the
 * chord-based `r0` solve `ringLayoutForGapFactor` already does for a plain,
 * hub-less ring) - a hub+ring composite's own `r0` is governed by the
 * hub-to-satellite gap instead, not by how close adjacent satellites sit to
 * EACH OTHER (see `computeCycleRingLayout`'s own doc comment for how the two
 * combine).
 *
 * `sp`'s own `refFor`/`refForName` can point at either end of the hub/item
 * relationship - `basic-radial`/`radial-cycle` reference the ring ITEM
 * itself (`sp` already in ring-item units, used directly); `diverging-radial`/
 * `converging-radial` reference the HUB instead (`sp refForName="centerShape"`)
 * - converted to ring-item units via `hubFactor` (the hub's own natural width
 * is `1/hubFactor` in this unit space, same conversion `resolveHubToNodeRatio`
 * itself uses). Returns `undefined` when `sp` references neither name (a
 * plain ring's own `sp`, e.g. `basic-cycle`'s referencing `composite` itself,
 * or when no hub is present at all) so the caller keeps the existing,
 * COM-verified chord-only `r0` for every fixture this does not apply to.
 */
export function resolveHubGapRatio(
	itemName: string | undefined,
	hubRatio: { hubName: string; factor: number } | undefined,
	arrangerConstraints: PptxSmartArtLayoutNode['constraints'],
): number | undefined {
	if (!hubRatio) {
		return undefined;
	}
	const sp = (arrangerConstraints ?? []).find(
		(c) =>
			c.type === 'sp' && typeof c.factor === 'number' && typeof c.referenceForName === 'string',
	);
	if (!sp || typeof sp.factor !== 'number') {
		return undefined;
	}
	if (sp.referenceForName === itemName) {
		return sp.factor;
	}
	if (sp.referenceForName === hubRatio.hubName) {
		return sp.factor / hubRatio.factor;
	}
	return undefined;
}
