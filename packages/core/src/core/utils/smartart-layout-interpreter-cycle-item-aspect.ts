/**
 * SmartArt DiagramML interpreter - a ring item's own effective `h:w` aspect,
 * when it is not a plain literal `fact`/sub-1 `val`: derived from an internal
 * composite self+child pairing ({@link deriveCompositeSelfChildLayout}), or
 * from the constraint GRAPH when the item's own `w` is itself reference-
 * resolved ({@link resolveGraphAspectRatio}).
 *
 * Split out of `smartart-layout-interpreter-cycle-constraints.ts` (the
 * file-size budget). Pure constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveConstraint, roleOf } from './smartart-constraint-solver';
import type { ConstraintIndex } from './smartart-constraint-solver';

/** A composite ring item's own self (uniform, ring-placed) + content-dependent child sub-shapes. */
export interface CompositeContentLayout {
	/** The "self" sub-shape's own `dgm:layoutNode/@name` (e.g. `parentNode`). */
	selfName: string;
	/** `self.w = selfWidthFactor * composite.w` - always a SQUARE (`self.h = self.w`), see the doc comment below. */
	selfWidthFactor: number;
	/** The content-dependent "child" sub-shape's own name (e.g. `childNode`), when found alongside `self`. */
	childName?: string;
	/** `child.l = childLeftFactor * self.w` (offset from the self shape's OWN left edge, in self-width units). */
	childLeftFactor?: number;
	/** `child.w = childWidthFactor * composite.w` (same "fraction of the whole composite" convention `selfWidthFactor` uses). */
	childWidthFactor?: number;
}

/**
 * `radial-list--hier5.pptx`'s own ring item (`node`) is a `composite` of
 * `parentNode` (an ellipse, `alg="tx"`, the point's OWN text - always
 * present) and `childNode` (a rect, side by side, the point's CHILD text -
 * only present when the point has one) - `node` itself declares no direct
 * `h` constraint at all, so `resolveRatioConstraint`'s own literal/indexed
 * lookups both decline.
 *
 * The composite's own constrLst declares the real relationship: `parentNode
 * .w = fact * node.w` (a `w` constraint targeting `parentNode`, with NO
 * `refFor`/`refForName` - referencing the ENCLOSING composite's own width,
 * ECMA-376's convention for an unqualified reference) PAIRED with `parentNode
 * .h = parentNode.w` (a SELF-referential `h` constraint - same `for`/
 * `forName` as its own `refFor`/`refForName`, i.e. "this child is square").
 *
 * An EARLIER round of this derivation used `selfWidthFactor` itself
 * (`0.4` for `radial-list`) as the WHOLE ring item's own `heightOverWidth`,
 * reasoning that `node.h = parentNode.h = parentNode.w = 0.4 * node.w`. That
 * is arithmetically true but the WRONG quantity for `computeCycleRingLayout`'s
 * own uniform "every point occupies the same natural footprint" ring-placement
 * model: `node`'s own FULL width (including room for `childNode`) is only
 * needed by a point that HAS a child - `radial-list--hier5.pptx`'s own cached
 * ground truth shows a point WITHOUT a child rendering `parentNode` ALONE, at
 * the SAME uniform size as every other point's own `parentNode` (204x154 for
 * all three satellites, COM-verified), not stretched to fill the composite's
 * full (content-dependent) width. The ring's own natural unit-width should
 * therefore be `parentNode`'s OWN footprint, not the composite's - and since
 * `parentNode` is declared SELF-SQUARE (`h = w`), that natural aspect is
 * simply `1` (a circle, before the ring's own anisotropic scale renders it as
 * an ellipse) - `resolveCycleRingParams` now uses this function only to
 * DETECT the pattern (and recover the `1` fallback for `heightOverWidth`
 * instead of the composite's own inflated aspect); the descriptor itself
 * (`selfWidthFactor`/`childLeftFactor`/`childWidthFactor`) is threaded through
 * for `smartart-layout-interpreter-cycle-ring-item.ts`'s own POST-PASS
 * (mirroring `repositionPyramidBands`) that repositions each point's own
 * content-dependent `childNode` copy relative to its already-correctly-placed
 * `parentNode` copy.
 *
 * The child descriptor is read the SAME way: a sibling `dgm:layoutNode`
 * declaring `l for="ch" forName=<child> refType="w" refFor="ch"
 * refForName=<self> fact=G` (the child's own left edge, as a fraction of the
 * self shape's width) PAIRED with `w for="ch" forName=<child> refType="w"
 * fact=H` (the child's own width, as a fraction of the WHOLE composite -
 * the SAME unqualified-reference convention `selfWidthFactor` itself uses).
 * `radial-list--hier5.pptx`: `childLeftFactor=1.1`, `childWidthFactor=0.6` -
 * COM-verified: `childNode.w = 0.6*node.w = 0.6*(parentNode.w/0.4) =
 * 1.5*parentNode.w`, matching the cached rect's own width (305) against the
 * cached ellipse's own width (204) to within rounding (204*1.5=306).
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
export function deriveCompositeSelfChildLayout(
	item: PptxSmartArtLayoutNode | undefined,
): CompositeContentLayout | undefined {
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
		const selfName = width.forName;
		const isSelfSquare = constraints.some(
			(c) =>
				c.type === 'h' &&
				c.for === 'ch' &&
				c.forName === selfName &&
				c.referenceType === 'w' &&
				c.referenceFor === 'ch' &&
				c.referenceForName === selfName,
		);
		if (!isSelfSquare) {
			continue;
		}
		const childLeft = constraints.find(
			(c) =>
				c.type === 'l' &&
				c.for === 'ch' &&
				c.forName !== undefined &&
				c.forName !== selfName &&
				c.referenceType === 'w' &&
				c.referenceFor === 'ch' &&
				c.referenceForName === selfName &&
				typeof c.factor === 'number',
		);
		const childName = childLeft?.forName;
		const childWidth = childName
			? constraints.find(
					(c) =>
						c.type === 'w' &&
						c.for === 'ch' &&
						c.forName === childName &&
						c.referenceForName === undefined &&
						typeof c.factor === 'number',
				)
			: undefined;
		return {
			selfName,
			selfWidthFactor: width.factor,
			childName,
			childLeftFactor: childLeft?.factor,
			childWidthFactor: childWidth?.factor,
		};
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
