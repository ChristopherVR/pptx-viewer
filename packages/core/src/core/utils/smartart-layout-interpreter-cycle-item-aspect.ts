/**
 * SmartArt DiagramML interpreter - a ring item's own effective `h:w` aspect,
 * when it is not a plain literal `fact`/sub-1 `val`: derived from an internal
 * composite child pairing ({@link deriveCompositeSquareChildAspect}), or from
 * the constraint GRAPH when the item's own `w` is itself reference-resolved
 * ({@link resolveGraphAspectRatio}).
 *
 * Split out of `smartart-layout-interpreter-cycle-constraints.ts` (the
 * file-size budget). Pure constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveConstraint, roleOf } from './smartart-constraint-solver';
import type { ConstraintIndex } from './smartart-constraint-solver';

/**
 * `radial-list--hier5.pptx`'s own ring item (`node`) is a `composite` of
 * `parentNode` (an ellipse, `alg="tx"`) and `childNode` (a rect, side by
 * side) - `node` itself declares no direct `h` constraint at all, so
 * `resolveRatioConstraint`'s own literal/indexed lookups both decline and
 * `heightOverWidth` fell back to the bare default of `1`, treating this
 * genuinely WIDE composite (ellipse + gap + rect, ~3.4:1) as square and
 * corrupting the ring's anisotropic scale on any non-360 arc (COM-verified
 * regression: satellites landed with `x` far outside the diagram box).
 *
 * The composite's own constrLst declares the real relationship instead:
 * `parentNode.w = fact * node.w` (a `w` constraint targeting `parentNode`,
 * with NO `refFor`/`refForName` - referencing the ENCLOSING composite's own
 * width, ECMA-376's convention for an unqualified reference) PAIRED with
 * `parentNode.h = parentNode.w` (a SELF-referential `h` constraint - same
 * `for`/`forName` as its own `refFor`/`refForName`, i.e. "this child is
 * square"). Since `parentNode` is `t=0`-anchored (the composite's own
 * vertical extent starts at it) and `childNode.h` in turn references
 * `parentNode.h` (never taller), the composite's OWN effective height is
 * exactly `parentNode`'s width-fraction of the composite's own width - the
 * `fact` on that first `w` constraint IS `heightOverWidth`.
 *
 * General, not `radial-list`-specific: matches ANY composite whose
 * constrLst declares a `for="ch"` width fraction (no `refFor`) for some
 * child name, PAIRED with a self-referential `h`-equals-own-`w` constraint
 * for that SAME child name - the first such pair in document order wins
 * (matching `parentNode` appearing before `childNode` in every composite
 * ring item examined). Declines (returns `undefined`) for a plain, non-
 * `composite` item, or when no such pair is found, so
 * `resolveCycleRingParams` keeps its existing fallback chain unchanged for
 * every other ring item (`basic-cycle`'s `dummy`, `basic-radial`'s `node`
 * ellipse-only item, ...).
 */
export function deriveCompositeSquareChildAspect(
	item: PptxSmartArtLayoutNode | undefined,
): number | undefined {
	if (!item || item.algorithm?.type !== 'composite') {
		return undefined;
	}
	const constraints = item.allConstraints ?? item.constraints ?? [];
	for (const width of constraints) {
		if (
			width.type !== 'w' ||
			width.for !== 'ch' ||
			!width.forName ||
			width.referenceForName !== undefined ||
			typeof width.factor !== 'number' ||
			width.factor <= 0
		) {
			continue;
		}
		const childName = width.forName;
		const isSelfSquare = constraints.some(
			(c) =>
				c.type === 'h' &&
				c.for === 'ch' &&
				c.forName === childName &&
				c.referenceType === 'w' &&
				c.referenceFor === 'ch' &&
				c.referenceForName === childName,
		);
		if (isSelfSquare) {
			return width.factor;
		}
	}
	return undefined;
}

/**
 * A ring item's genuine `h:w` aspect ratio, resolved via the constraint
 * GRAPH (`smartart-constraint-solver.ts`'s `resolveConstraint`) when the item
 * declares no LITERAL `h` fact/sub-1 val of its own (`resolveRatioConstraint`'s
 * own literal scan, `ratioConstraint`, already handles that simpler case and
 * is unaffected by this function).
 *
 * `diverging-radial--hier5.pptx`'s own ring item ("node", an ellipse) is the
 * fixture that exposed why this needs to be a SEPARATE step, not just "use
 * the graph-resolved `h`": its own `h refType="w"` (no `fact` at all, i.e.
 * ratio 1 - "my height equals my width", a circle before the ring's
 * anisotropic box-fit stretches it) is declared self-referentially, but its
 * own `w` is ALSO graph-resolved (the composite's OWN `w for="ch"
 * forName="node" refType="w" refFor="ch" refForName="centerShape"
 * fact="1.25"`, from `resolveHubToNodeRatio`'s SAME constraint) to `1.25`
 * root-normalized units (see `smartart-constraint-solver.ts`'s `combine`:
 * every graph-resolved quantity bottoms out at the root layoutNode's own
 * implicit `w=h=1`, so `node.w` and `node.h` are BOTH expressed in that same
 * absolute unit, not as a ratio of each other). Reading the graph-resolved
 * `h` (1.25) directly AS the h:w ratio - what the old code did, because
 * `resolveRatioConstraint`'s "relative" fallback (`resolveReferencedRatio`)
 * has no notion of "also divide by `w`" - silently inflated `heightOverWidth`
 * from the correct `1` (a circle, `h == w` when BOTH read in the same units)
 * to `1.25`, corrupting `computeCycleRingLayout`'s anisotropic scale
 * (COM-verified: interpreted satellite height 8.26% too tall vs the cached
 * ellipse). The correct ratio is `resolvedH / resolvedW`, which is what this
 * computes; it is a no-op improvement (declines, `undefined`, letting the
 * caller's existing fallback chain run exactly as before) whenever the
 * item's own `w` is NOT itself graph-resolved - e.g. `basic-radial`/
 * `radial-cycle`'s own item nodes, whose `sibSp`/`sp` reference the ITEM
 * directly rather than chaining through a `w`-referencing sibling, so their
 * `w` role never gets an indexed entry at all.
 */
export function resolveGraphAspectRatio(
	item: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
): number | undefined {
	if (!item) {
		return undefined;
	}
	const role = roleOf(item);
	const resolvedH = resolveConstraint(index, role, 'h');
	const resolvedW = resolveConstraint(index, role, 'w');
	if (resolvedH === undefined || resolvedW === undefined || resolvedW <= 0) {
		return undefined;
	}
	return resolvedH / resolvedW;
}
