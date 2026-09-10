/**
 * SmartArt DiagramML interpreter - hierarchy generation-axis gap ratio.
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * `resolveGenerationGapRatio` itself, alongside its own fallback constant.
 *
 * Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { CompositeChildGeometry } from './smartart-hierarchy-composite-child';
import { findByReference } from './smartart-hierarchy-orientation';

/** COM-verified "Hierarchy" fallback generation-to-generation gap (see `resolveGenerationGapRatio`). */
const DEFAULT_GENERATION_GAP_RATIO = 0.25;

/**
 * A generation-axis `sp` declared on an ANCESTOR of the `hierChild`
 * algorithm node itself, not reachable via that node's own (`allConstraints`
 * already includes descendants, never ancestors) local search - SESSION 24
 * finding (`labeled-hierarchy--hier5.pptx`, the "hierarchy6" layout): its
 * own `mainComposite` wrapper (the TOP-LEVEL `composite`-alg node, itself an
 * ancestor of `hierChild1` two levels up via the intervening `hierFlow`
 * `lin` node) declares `sp for="des" refType="h" refFor="des"
 * refForName="level1Shape" fact="0.4"` in ITS OWN constrLst - a broad
 * `for="des"` declaration with NO `forName` of its own, so `buildConstraint
 * Index` indexes it under the DECLARING node's own role ("mainComposite"),
 * not under `hierChild1`'s. Local-coordinate analysis of this fixture's own
 * cached row centres (`120`/`317`/`513`, i.e. ~196.5px generation-to-
 * generation) confirmed `0.4` (not the `0.25` default that search miss
 * silently fell back to) reproduces the real spacing almost exactly, so
 * this searches the WHOLE index (every role, not just `hierChild1`'s own)
 * for ANY `sp` constraint that references the ITEM TEMPLATE's own name
 * (`itemShapeName`, e.g. `level1Shape`) on `stackingAxis` - a general
 * mechanism (find "the generation gap declared relative to my own item's
 * size, wherever in the tree it was written"), not a `labeled-hierarchy`
 * special case: any hierarchy-family layout whose OWN generation gap lives
 * on an ancestor `composite`/`choose` wrapper rather than on `hierChild`
 * itself benefits identically. Tried ONLY after the existing local
 * (`hierChild`-scoped) search comes up empty, so every fixture that already
 * resolves its own gap locally (plain "Hierarchy", "Organization Chart") is
 * completely unaffected - confirmed via a full corpus baseline regen.
 */
function resolveGenerationGapFromIndex(
	index: ConstraintIndex | undefined,
	itemShapeName: string | undefined,
	stackingAxis: 'w' | 'h',
): number | undefined {
	if (!index || !itemShapeName) {
		return undefined;
	}
	for (const entries of index.entries.values()) {
		for (const entry of entries) {
			const c = entry.constraint;
			if (
				c.type === 'sp' &&
				c.referenceType === stackingAxis &&
				c.referenceForName === itemShapeName &&
				typeof c.factor === 'number'
			) {
				return c.factor;
			}
		}
	}
	return undefined;
}

/**
 * Generation-to-generation gap, as a fraction of the item's STACKING-axis
 * size (`h` vertical, `w` transposed - see `smartart-hierarchy-
 * orientation.ts`'s own module doc comment); falls back to
 * `DEFAULT_GENERATION_GAP_RATIO` when undeclared.
 *
 * `sp` is not always declared relative to the stacking axis: "Hierarchy"
 * itself declares it relative to `h` (the stacking axis), but "Organization
 * Chart" declares it relative to `w` (`sp for=des forName=hierRoot1
 * refType=w refFor=des refForName=rootComposite1 fact=0.21`) - a CROSS-axis
 * reference. COM-verified against `organization-chart--flat3.pptx`: the raw
 * `0.21` fed directly into the stacking-axis formula (the old bug: this
 * function only ever checked `stackingAxis`, silently missing org-chart's
 * own declaration and quietly falling back to the "Hierarchy" default of
 * `0.25`) reproduces the WRONG generation pitch; converting via
 * `aspectRatio` (the item's own `h:w`, already resolved by the caller) -
 * `gap_stacking = declaredFact / aspectRatio` when declared on the cross
 * axis, since a quantity expressed as a fraction of `w` needs multiplying by
 * `w/h = 1/aspectRatio` to become a fraction of `h` - reproduces the cached
 * generation pitch to within rounding on all three "Organization Chart"
 * datasets (`flat3`/`hier5`/`hier8`).
 *
 * A SEPARATE correction applies when the layout declares a `composite`
 * wrapper (`compositeChild` defined - see `smartart-hierarchy-composite-
 * child.ts`): "Hierarchy"'s own `sp` (declared ON the stacking axis, `h`,
 * `fact="0.25"`) references `composite`'s own `h`, not the RENDERED item's
 * `h` - the SAME composite-vs-rendered-item mismatch `resolveAspectRatio`'s
 * caller already corrects for the aspect ratio itself (`smartart-hierarchy-
 * composite-child.ts`'s own module doc comment). Reading it unconverted (the
 * pre-existing "same axis, no conversion needed" assumption) silently
 * assumes `composite.h === renderedItem.h`, which is false whenever
 * `compositeChild.widthFactor !== 1` (`composite` is WIDER than the
 * rendered item, per its own `w` shrink). Converting: `composite.h =
 * compositeAspect * composite.w = compositeAspect * (renderedItem.w /
 * widthFactor)`, and `renderedItem.h = renderedAspect * renderedItem.w`, so
 * `declaredFact * composite.h / renderedItem.h = declaredFact *
 * compositeAspect / (widthFactor * renderedAspect^2)`. COM-verified against
 * THREE independent depths of `hierarchy--{flat3,hier5,hier8}.pptx` (2/3/4
 * generations): the row-to-row gap, measured directly from each fixture's
 * own raw `dsp:sp` offsets (NOT the "solve to fill the box" quantity
 * `computeAxisPitch` used to derive, which only coincidentally matches this
 * for a fully-fanned tree - see that function's own doc comment), is
 * `0.4580 * renderedItem.h` on ALL THREE samples exactly; this formula
 * (`0.25 * 0.667 / (0.9 * 0.635^2)`) gives `0.4596` - within 0.35% of every
 * sample, i.e. within the same rounding band every other ratio in this
 * derivation chain shows, not a separate discrepancy.
 */
export function resolveGenerationGapRatio(
	constraints: PptxSmartArtLayoutNode['constraints'],
	stackingAxis: 'w' | 'h',
	aspectRatio: number,
	compositeChild?: CompositeChildGeometry,
	compositeAspect?: number,
	index?: ConstraintIndex,
	itemShapeName?: string,
): number {
	const onStackingAxis = findByReference(constraints, 'sp', stackingAxis);
	if (onStackingAxis !== undefined) {
		// SESSION 32: the "parent-relative" composite-child shape
		// (`compositeChild.heightFactor` defined - see `smartart-hierarchy-
		// composite-child.ts`'s own module doc comment, e.g. `circle-picture-
		// hierarchy--hier5.pptx`) declares `sp` relative to the WRAPPING
		// `composite`'s own stacking-axis size directly (the SAME `refFor=des
		// refForName=composite` shape "Hierarchy" itself declares), but its
		// composite.h -> renderedItem.h relationship is `heightFactor` ALONE
		// (`renderedItem.h = composite.h * heightFactor`, declared directly,
		// no width-axis indirection) - not the squared-`aspectRatio` formula
		// below, which is derived from the SELF-referential shape's own
		// composite.h -> renderedItem.h path THROUGH the width axis
		// (`widthFactor`/`aspectRatio`) and does not apply here. Converting:
		// `gapRatio = declaredFact * composite.h / renderedItem.h =
		// declaredFact / heightFactor`. COM-verified against `circle-picture-
		// hierarchy--hier5.pptx`: `0.25 / 0.8 = 0.3125` reproduces the cached
		// row-to-row generation pitch (`~189.5px` local, depth 3) within 0.3%
		// once `fitItemBox`'s own SESSION 32 `compositeChainHeightRatio` fix
		// lands alongside this (sizing and positioning must move together -
		// see `smartart-track-r-successor.md`'s SESSION 31 finding this
		// completes).
		if (compositeChild?.heightFactor !== undefined && compositeChild.heightFactor > 0) {
			return onStackingAxis / compositeChild.heightFactor;
		}
		if (
			compositeChild &&
			compositeAspect !== undefined &&
			compositeAspect > 0 &&
			compositeChild.widthFactor > 0 &&
			aspectRatio > 0
		) {
			return (
				(onStackingAxis * compositeAspect) /
				(compositeChild.widthFactor * aspectRatio * aspectRatio)
			);
		}
		return onStackingAxis;
	}
	const crossAxis = stackingAxis === 'h' ? 'w' : 'h';
	const onCrossAxis = findByReference(constraints, 'sp', crossAxis);
	if (onCrossAxis !== undefined && aspectRatio > 0) {
		return stackingAxis === 'h' ? onCrossAxis / aspectRatio : onCrossAxis * aspectRatio;
	}
	const fromAncestor = resolveGenerationGapFromIndex(index, itemShapeName, stackingAxis);
	if (fromAncestor !== undefined) {
		return fromAncestor;
	}
	return DEFAULT_GENERATION_GAP_RATIO;
}
