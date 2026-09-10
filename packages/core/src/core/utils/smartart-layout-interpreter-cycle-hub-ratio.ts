/**
 * SmartArt DiagramML interpreter - hub/ring-item sizing ratios for a
 * hub+satellite `cycle` composite (`radial-cycle`, `basic-radial`,
 * `diverging-radial`, `converging-radial`, `radial-list`).
 *
 * Split out of `smartart-layout-interpreter-cycle-constraints.ts` to keep
 * that file under the repo's per-file line budget. Pure constraint reading;
 * no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtWhen } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveConstraint } from './smartart-constraint-solver';
import { resolveHubToNodeRatioViaUserSize } from './smartart-layout-interpreter-cycle-hub-ratio-usersize';
import { evaluateWhen } from './smartart-layout-interpreter-when';

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
 *
 * SESSION 12: `resolveHubToNodeRatio` now graph-resolves `node.w` and
 * `hubName.w` independently (`resolveConstraint`, `smartart-constraint-
 * solver.ts`'s own reference-walking machinery, which already honours
 * `op="equ"/"gte"/"lte"`) and returns their RATIO instead of reading this
 * ONE constraint's own raw `fact` in isolation, when `index` is given -
 * falling back to the raw-fact reading unchanged whenever `index` is
 * omitted or either side fails to resolve, so every existing caller is
 * BYTE-IDENTICAL (verified: `basic-radial--hier5.pptx` stays exact).
 *
 * SESSION 17: `diverging-radial--hier5.pptx`'s own hub:satellite size-ratio
 * bug (SESSION 12's own negative result, kept below as history) is NOT a
 * resolution-depth problem after all - it is a count-gated `dgm:rule`
 * (`w for="ch" forName="node"`, six `dgm:choose`/`dgm:if cnt<=N` branches,
 * `fact="1"` for `cnt<=6`, `fact="0.9"` for `cnt<=8`, down to `fact="0.5"`
 * else) that REPLACES the `constrLst`'s own declared ratio (`1.25`) rather
 * than multiplying on top of it, missed entirely because it lives inside a
 * `dgm:choose` (the SAME "rules aren't choose-aware" gap `smartart-layout-
 * interpreter-named-rules.ts` documents for `primFontSz`/`secFontSz`, here
 * hitting `w` instead). COM-verified with TWO independent samples: `n=3`
 * (falls in `cnt<=6`, `fact=1`) renders hub:item at the cached `172:172 =
 * 1:1`, matching `1/1` exactly; a purpose-built `n=8` sample (`cnt<=8`,
 * `fact=0.9`) renders `1281782:1153604 = 1.1111`, matching `1/0.9` exactly -
 * the SAME ratio-inversion relationship (`hub's natural width = 1/fact`)
 * this function already uses for the `constrLst`-only case, just with the
 * RULE's `fact` in place of the constraint's. `resolveRuleCountOverride`
 * below resolves the live branch via `evaluateWhen` given the real
 * satellite count, first-match-wins in document order (matching
 * `dgm:choose` semantics), and its result - when present - REPLACES the
 * constraint-derived factor entirely, not just when no constraint matched.
 *
 * **SESSION 12's own negative result, kept as history**: graph-resolving
 * `node.w`/`hubName.w` independently and dividing (below, unchanged) is
 * provably a mathematical identity with the raw `constrLst` `factor` alone -
 * it can never explain a DIFFERENT final ratio than the declared one, since
 * both sides cascade through the SAME reference chain. The real override
 * was never reachable through `constrLst` resolution at all; it needed the
 * count-gated `ruleLst` this session adds.
 */
export function resolveHubToNodeRatio(
	ringItem: PptxSmartArtLayoutNode | undefined,
	arrangerConstraints: PptxSmartArtLayoutNode['constraints'],
	index?: ConstraintIndex,
	arrangerRuleCandidates?: PptxSmartArtLayoutNode['ruleCandidates'],
	satelliteCount?: number,
	declaringRoleChain?: readonly string[],
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
	if (match) {
		const hubName = match.referenceForName as string;
		const ruleOverride =
			satelliteCount !== undefined && arrangerRuleCandidates
				? resolveRuleCountOverride(arrangerRuleCandidates, ringItem.name, satelliteCount)
				: undefined;
		if (ruleOverride !== undefined) {
			return { hubName, factor: ruleOverride };
		}
		if (index) {
			const resolvedNodeW = resolveConstraint(index, ringItem.name, 'w');
			const resolvedHubW = resolveConstraint(index, hubName, 'w');
			if (resolvedNodeW !== undefined && resolvedHubW !== undefined && resolvedHubW > 0) {
				return { hubName, factor: resolvedNodeW / resolvedHubW };
			}
		}
		return { hubName, factor: match.factor ?? 1 };
	}
	return resolveHubToNodeRatioViaUserSize(ringItem, arrangerConstraints, index, declaringRoleChain);
}

/**
 * Resolve a count-gated `w`-type `dgm:rule` override for `itemName` (the
 * ring item's own layoutNode name, e.g. `node`) against the real satellite
 * count - see `resolveHubToNodeRatio`'s own SESSION 17 doc comment for the
 * COM measurement that established this mechanism. Matches a rule with a
 * BARE `factor` (no `value`/`max` - the shape this specific override always
 * takes; a rule that DOES carry a literal `value` is a different construct,
 * e.g. `primFontSz`'s own shrink-search floor, and stays out of scope here)
 * whose EXPLICIT (non-empty) guard chain evaluates true (`!== false`, the
 * same "undecidable passes" convention `resolvePresentationOf` already
 * uses) against `satelliteCount` with no tree context (`evaluateWhen`
 * falls back to a flat count comparison when `context.nodes` is omitted,
 * exactly the comparison this compound-axis `cnt` condition needs - see
 * that function's own `cnt` case). First match wins in document order.
 *
 * Deliberately does NOT fall through to an `else`-only rule the way
 * `dgm:choose` itself would (a genuinely conditional gap, not an oversight):
 * `nestedRuleCandidates` is choose-BLIND per-candidate (the SAME convention
 * `nestedConstraints`/`nestedPresOfCandidates` already use, see their own
 * doc comments), so an `else` branch's own EMPTY guard chain cannot be told
 * apart from "genuinely unconditional" - it is only true "everywhere its
 * sibling `if`s are false", which this function has no way to verify
 * without re-deriving the WHOLE sibling `dgm:choose`'s own condition set.
 * COM-verified this restriction is necessary, not just cautious:
 * `converging-radial--hier5.pptx` declares `w forName="node" fact="0.7"`
 * ONLY inside a `cnt<=5`/`else` choose's `else` branch (its OWN `cnt<=5` `if`
 * branch, the one n=3 actually falls in, has NO `node` rule at all - only a
 * `centerShape` one) - trusting the else's empty guard as "always true"
 * fired this rule for n=3 anyway, growing the hub from a already-close
 * 234px (10.51% max delta) to a wildly wrong 338px (19.51%), a measured
 * regression caught and reverted by adding this restriction.
 */
function resolveRuleCountOverride(
	candidates: NonNullable<PptxSmartArtLayoutNode['ruleCandidates']>,
	itemName: string,
	satelliteCount: number,
): number | undefined {
	const match = candidates.find(
		(entry) =>
			entry.guard.length > 0 &&
			entry.rule.type === 'w' &&
			entry.rule.forName === itemName &&
			typeof entry.rule.factor === 'number' &&
			entry.rule.factor > 0 &&
			// `val="NaN"` (ECMA-376's own "not applicable" convention for this
			// field - see this module's own doc comment) parses to `Number.NaN`,
			// NOT `undefined` (`xsdDouble` in `smartart-constraint-rules.ts`
			// handles the literal string `"NaN"` explicitly) - `!finiteRuleValue`
			// catches both that and a genuinely absent `@_val` attribute.
			!Number.isFinite(entry.rule.value) &&
			entry.guard.every(
				(guard: PptxSmartArtWhen) => evaluateWhen(guard, satelliteCount, {}) !== false,
			),
	);
	return match ? (match.rule.factor as number) : undefined;
}

// `resolveHubToNodeRatioViaUserSize` (the `resolveHubToNodeRatio` fallback
// for a ring item that declares its size INDIRECTLY through `userS`,
// possibly at a distant ancestor's own `constrLst`) lives in
// `smartart-layout-interpreter-cycle-hub-ratio-usersize.ts` (the repo's
// per-file line budget) - see that module's own doc comment.

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
