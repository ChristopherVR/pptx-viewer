/**
 * SmartArt DiagramML interpreter - hierarchy generation-axis gap ratio.
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * `resolveGenerationGapRatio` itself, alongside its own fallback constant.
 *
 * Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import type { CompositeChildGeometry } from './smartart-hierarchy-composite-child';
import { findByReference } from './smartart-hierarchy-orientation';

/** COM-verified "Hierarchy" fallback generation-to-generation gap (see `resolveGenerationGapRatio`). */
const DEFAULT_GENERATION_GAP_RATIO = 0.25;

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
): number {
	const onStackingAxis = findByReference(constraints, 'sp', stackingAxis);
	if (onStackingAxis !== undefined) {
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
	return DEFAULT_GENERATION_GAP_RATIO;
}
