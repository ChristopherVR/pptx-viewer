/**
 * SmartArt DiagramML interpreter - re-derive `HierarchyOrientation`'s
 * axis-relative fields for the "centred-on-children, axis-swapped"
 * construct (`smartart-hierarchy-centered-fan-axis.ts`).
 *
 * `resolveHierarchyOrientation`'s STD branch resolves `aspectRatio` as a
 * plain real-space "h:w" ratio, and `generationGapRatio`/
 * `compositeGenerationGapRatio`/`hangHeightRatio` by searching for a `sp`
 * constraint declared relative to the item's own HEIGHT (`'h'`) - both
 * correct for the classic (fan=X, generation=Y) convention that branch
 * assumes. `arrangeHierarchy`'s `axisSwapped` mode runs the SAME
 * std-branch-sized algorithm but through the SAME `effectiveBox`-swap +
 * `transposeResult` post-pass `orientation.transposed` already uses for the
 * unrelated "Horizontal Hierarchy" family (see that field's own module doc
 * comment) - which means the item's LOGICAL width (pre-swap) becomes its
 * FINAL height, and vice versa. Two fields need re-deriving for this reason:
 *
 *   - `aspectRatio` must be INVERTED (mirroring
 *     `resolveHierarchyOrientation`'s own transposed-branch `1 / hToW`): the
 *     STD branch's `h = aspectRatio * w` becomes, after the swap,
 *     `w_final = h_logical = aspectRatio * w_logical = aspectRatio *
 *     h_final` - backwards. Feeding `1 / aspectRatio` into the LOGICAL solve
 *     restores the intended real-space relationship after the swap.
 *   - `generationGapRatio`/`compositeGenerationGapRatio`/`hangHeightRatio`
 *     search for a `sp` constraint on the item's STACKING axis - the STD
 *     branch always searches `'h'` (its own generation axis, in real
 *     terms), but `horizontal-labeled-hierarchy--hier5.pptx`'s own layout
 *     declares this gap relative to `'w'` instead (`<dgm:constr type="sp"
 *     for="des" refType="w" refFor="des" refForName="level1Shape"
 *     fact="0.4"/>`, on an ancestor `mainComposite` wrapper) - because ITS
 *     generation axis's real-space extent IS the item's width (the whole
 *     point of the construct). Re-resolved here with stacking axis `'w'`
 *     via the SAME general `resolveGenerationGapRatio` (including its own
 *     ancestor-index fallback, `smartart-hierarchy-generation-gap.ts`), not
 *     a per-layout special case.
 *
 * `marginXRatio`/`marginYRatio`/`sibSpRatio`/`compositeWidthFactor`/
 * `compositeHeightFactor`/`cardOffsetXRatio`/`compositeChainHeightRatio` need
 * NO adjustment: `fitItemBox`'s own "X" parameter role is always the FAN
 * axis regardless of which real-space axis that maps to (see
 * `smartart-layout-interpreter-hierarchy.ts`'s own module doc comment), and
 * `sibSpRatio`/the composite factors are plain declared ratios, not tied to
 * a specific real `w`/`h` label.
 *
 * No `compositeChild`-aware correction (unlike `resolveHierarchyOrientation`'s
 * own calls): no corpus fixture reaching this construct declares a
 * `composite` wrapper around its item template yet (`horizontal-labeled-
 * hierarchy--hier5.pptx`'s own `level1Shape`/`level2Shape` nest directly
 * under their `hierRoot`) - a successor adding one can re-derive
 * `compositeChild` the same way `resolveHierarchyOrientation` does and
 * thread it through, generalising this function rather than special-casing.
 *
 * Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveGenerationGapRatio } from './smartart-hierarchy-generation-gap';
import type { HierarchyOrientation } from './smartart-hierarchy-orientation-types';

/**
 * Adjust `orientation` (already resolved by `resolveHierarchyOrientation`'s
 * STD branch) for the axis-swapped construct - see the module doc comment.
 * Returns `orientation` unchanged when it is already `transposed` (the
 * "Horizontal Hierarchy" branch resolves its own ratios for its own later
 * swap; this construct's own gate, `hierarchyDeclaresCenteredFanAxisSwap`,
 * never fires for that family anyway, but this keeps the function safe to
 * call unconditionally).
 */
export function adjustOrientationForAxisSwap(
	orientation: HierarchyOrientation,
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
	itemShapeName: string | undefined,
): HierarchyOrientation {
	if (orientation.transposed) {
		return orientation;
	}
	const constraints = algorithmNode?.allConstraints ?? algorithmNode?.constraints;
	const stackingAxis = 'w';
	const gapArgs = [
		constraints,
		stackingAxis,
		orientation.aspectRatio,
		undefined,
		orientation.aspectRatio,
		index,
		itemShapeName,
	] as const;
	return {
		...orientation,
		aspectRatio:
			orientation.aspectRatio > 0 ? 1 / orientation.aspectRatio : orientation.aspectRatio,
		generationGapRatio: resolveGenerationGapRatio(...gapArgs),
		compositeGenerationGapRatio: resolveGenerationGapRatio(...gapArgs),
		hangHeightRatio: resolveGenerationGapRatio(...gapArgs),
	};
}
