/**
 * SmartArt DiagramML interpreter - hierarchy axis orientation.
 *
 * `smartart-layout-interpreter-hierarchy.ts`'s `fitItemBox`/`placeStandardTree`
 * assume the classic org-chart orientation: siblings fan along X, generations
 * stack down Y. "Horizontal Hierarchy" (and its
 * `horizontal-multi-level-hierarchy`/`horizontal-labeled-hierarchy` siblings)
 * is the SAME `hierChild`/`hierRoot` algorithm with the axes swapped -
 * COM-verified against `horizontal-hierarchy--flat3.pptx` (root flush LEFT,
 * its two children stacked in a column at the right, not the
 * top-center/bottom-row shape "Hierarchy" renders).
 *
 * The declarative signal: "Horizontal Hierarchy"'s `layout1.xml` expresses
 * the item's free-variable `w`/`h` pair, `sibSp` (fan-axis gap) and `sp`
 * (generation-axis gap) all relative to `h` (`<dgm:constr type="w" ...
 * refType="h" fact="2"/>`, `<dgm:constr type="sibSp" refType="h" .../>`)
 * where "Hierarchy" expresses the same trio relative to `w`
 * (`h refType="w" fact="0.667"`, `sibSp refType="w"`). Reading which axis
 * `sibSp` references is a genuine declarative transposition signal, not a
 * guess keyed off the layout's name, and reading the `w:h`/`sp` facts
 * directly (rather than hardcoding "Hierarchy"'s own 0.667/0.25) generalises
 * to any hierarchy-family layout with its own aspect/gap.
 *
 * Implementation: rather than teach `placeStandardTree` a second, mirrored
 * code path, `arrangeHierarchy` runs the WHOLE existing (X-fans/Y-stacks)
 * algorithm against a `{width: box.height, height: box.width}` "logical" box
 * when transposed, then `transposeResult` swaps every rendered node's/
 * connector's x<->y (and width<->height) back into the real box's coordinate
 * system as a final pass - zero duplicated placement logic, and a future fix
 * to `placeStandardTree` benefits both orientations for free.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveRatioConstraint } from './smartart-constraint-ratio-fallback';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { roleOf } from './smartart-constraint-solver';

/** COM-verified "Hierarchy" fallback (`h:w`, absent any declared aspect - see `resolveAspectRatio`). */
const DEFAULT_ASPECT_RATIO = 0.667;
/** COM-verified "Hierarchy" fallback generation-to-generation gap (see `resolveGenerationGapRatio`). */
const DEFAULT_GENERATION_GAP_RATIO = 0.25;
/** `sibSp` fallback when a layout declares none (matches "Hierarchy" itself). */
const DEFAULT_SIB_SP_RATIO = 0.1;
/**
 * Outer margin around the whole tree, as a fraction of the diagram box, for
 * a NON-TRANSPOSED hierarchy (plain "Hierarchy" itself). COM-verified (not
 * declared by any `layout1.xml` constraint under either name checked):
 * solving the fan-packing equation below for TWO independent genuine samples
 * with different sibling counts (`hierarchy--flat3.pptx`, a 2-wide fan, and
 * `hierarchy--hier8.pptx`, a 5-wide fan) against the SAME `sibSp` ratio
 * yields a consistent margin on both axes, so it is treated as a fixed
 * diagram-edge inset rather than folded into the packing ratio.
 *
 * A TRANSPOSED hierarchy ("Horizontal Hierarchy" and its siblings) needs NO
 * such margin at all - COM-verified against TWO independent genuine samples
 * on EACH axis (`horizontal-hierarchy--flat3.pptx`, 2-wide fan/2 generations,
 * and `--hier5.pptx`, the SAME 2-wide fan but 3 generations): plugging the
 * layout's own declared `sibSp`/`sp` facts directly into the packing
 * equation with ZERO outer margin reproduces both fixtures' cached item
 * size on BOTH axes to within rounding (fan axis: 247.9 vs cached 248 on
 * both; generation axis: 361.25 vs cached 361 for 2 generations, 228.16 vs
 * cached 228 for 3 generations). This is a real, measured difference
 * between the two orientations (not yet explained from first principles -
 * `layout1.xml` declares no margin-shaped constraint for either family, so
 * it is presumably an artifact of how the two orientations' own connector
 * routing consumes space), keyed off the SAME declarative `transposed`
 * signal `resolveHierarchyOrientation` already derives from `sibSp`'s own
 * `referenceType` - not a per-layout-name guess.
 */
export const OUTER_MARGIN_X_RATIO = 0.0491;
export const OUTER_MARGIN_Y_RATIO = 0.0707;

export interface HierarchyOrientation {
	/** True when the fan axis is Y (siblings stack vertically) and generations stack along X. */
	transposed: boolean;
	sibSpRatio: number;
	/** `h:w` when `!transposed`; the axes are swapped inside `arrangeHierarchy` when `transposed`, so this is always the ratio to apply to the FAN-axis size to get the CROSS-axis size in "logical" (post-swap) space. */
	aspectRatio: number;
	generationGapRatio: number;
	/** Outer margin (fraction of the effective box) on the FAN axis - see `OUTER_MARGIN_X_RATIO`'s doc comment: 0 when `transposed`. */
	marginXRatio: number;
	/** Outer margin (fraction of the effective box) on the GENERATION axis - see `OUTER_MARGIN_X_RATIO`'s doc comment: 0 when `transposed`. */
	marginYRatio: number;
}

/** A constraint search that only cares about `type`/`referenceType`/`factor` - broader than `findConstraint` (which cannot filter by `referenceType`). */
function findByReference(
	constraints: PptxSmartArtLayoutNode['constraints'],
	type: string,
	referenceType: string,
): number | undefined {
	const match = (constraints ?? []).find(
		(c) => c.type === type && c.referenceType === referenceType && typeof c.factor === 'number',
	);
	return match?.factor;
}

/**
 * The item's own `h:w` (non-transposed) ratio, read directly from whichever
 * of the two equivalent declarations is present: `h` referencing `w` (a
 * fact IS the ratio - "Hierarchy"'s own shape) or `w` referencing `h` (a
 * fact is the ratio's RECIPROCAL - "Horizontal Hierarchy"'s shape, e.g.
 * `w=2*h` means `h:w=0.5`). Falls back to `DEFAULT_ASPECT_RATIO` when
 * neither is declared (matches every layout examined that omits it).
 */
function resolveAspectRatio(constraints: PptxSmartArtLayoutNode['constraints']): number {
	const hRefW = findByReference(constraints, 'h', 'w');
	if (hRefW !== undefined && hRefW > 0) {
		return hRefW;
	}
	const wRefH = findByReference(constraints, 'w', 'h');
	if (wRefH !== undefined && wRefH > 0) {
		return 1 / wRefH;
	}
	return DEFAULT_ASPECT_RATIO;
}

/**
 * Generation-to-generation gap, as a fraction of the item's STACKING-axis
 * size (`h` vertical, `w` transposed - see the module doc comment); falls
 * back to `DEFAULT_GENERATION_GAP_RATIO` when undeclared.
 *
 * `sp` is not always declared relative to the stacking axis: "Hierarchy"
 * itself declares it relative to `h` (the stacking axis, read directly, no
 * conversion needed), but "Organization Chart" declares it relative to `w`
 * (`sp for=des forName=hierRoot1 refType=w refFor=des refForName=
 * rootComposite1 fact=0.21`) - a CROSS-axis reference. COM-verified against
 * `organization-chart--flat3.pptx`: the raw `0.21` fed directly into the
 * stacking-axis formula (the old bug: this function only ever checked
 * `stackingAxis`, silently missing org-chart's own declaration and quietly
 * falling back to the "Hierarchy" default of `0.25`) reproduces the WRONG
 * generation pitch; converting via `aspectRatio` (the item's own `h:w`,
 * already resolved by the caller) - `gap_stacking = declaredFact /
 * aspectRatio` when declared on the cross axis, since a quantity expressed as
 * a fraction of `w` needs multiplying by `w/h = 1/aspectRatio` to become a
 * fraction of `h` - reproduces the cached generation pitch to within
 * rounding on all three "Organization Chart" datasets (`flat3`/`hier5`/
 * `hier8`).
 */
function resolveGenerationGapRatio(
	constraints: PptxSmartArtLayoutNode['constraints'],
	stackingAxis: 'w' | 'h',
	aspectRatio: number,
): number {
	const onStackingAxis = findByReference(constraints, 'sp', stackingAxis);
	if (onStackingAxis !== undefined) {
		return onStackingAxis;
	}
	const crossAxis = stackingAxis === 'h' ? 'w' : 'h';
	const onCrossAxis = findByReference(constraints, 'sp', crossAxis);
	if (onCrossAxis !== undefined && aspectRatio > 0) {
		return stackingAxis === 'h' ? onCrossAxis / aspectRatio : onCrossAxis * aspectRatio;
	}
	return DEFAULT_GENERATION_GAP_RATIO;
}

/**
 * Resolve whether `algorithmNode` is a transposed (horizontal-fan) hierarchy
 * and every ratio `fitItemBox` needs, all read from its own declared
 * constraints where possible (see the module doc comment for the exact
 * `dgm:constr` shapes distinguishing the two orientations).
 */
export function resolveHierarchyOrientation(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
	mode: 'std' | 'tailed' | 'hanging' = 'std',
): HierarchyOrientation {
	const constraints = algorithmNode?.allConstraints ?? algorithmNode?.constraints;
	// `sibSp` referencing `h` is the fan-axis-is-vertical signal (see the
	// module doc comment); referencing `w`, or unresolvable, is the classic
	// (non-transposed) orientation.
	const sibSpReferencesHeight = (constraints ?? []).some(
		(c) => c.type === 'sibSp' && c.referenceType === 'h',
	);
	const sibSpRatio = resolveRatioConstraint(
		constraints,
		index,
		roleOf(algorithmNode),
		['sibSp'],
		DEFAULT_SIB_SP_RATIO,
		algorithmNode?.rules,
	);
	if (sibSpReferencesHeight) {
		// Transposed: the fan axis's own size is `h`; the stacking axis is `w`,
		// and the item's cross-axis (logical "cross") size comes from `w:h`
		// resolved as a ratio TO h (i.e. `w = aspectRatio * h`), which the
		// `resolveAspectRatio` helper already gives as `h:w` - invert it here so
		// callers always multiply the fan-axis size to get the cross size.
		const hToW = resolveAspectRatio(constraints);
		return {
			transposed: true,
			sibSpRatio,
			aspectRatio: hToW > 0 ? 1 / hToW : 1 / DEFAULT_ASPECT_RATIO,
			generationGapRatio: resolveGenerationGapRatio(constraints, 'w', hToW),
			// See `OUTER_MARGIN_X_RATIO`'s doc comment: a transposed hierarchy
			// needs no outer margin at all on either axis, COM-verified.
			marginXRatio: 0,
			marginYRatio: 0,
		};
	}
	const aspectRatio = resolveAspectRatio(constraints);
	// A `tailed` (org-chart-family) hierarchy needs NO outer margin either -
	// COM-verified against `organization-chart--flat3.pptx`/`--hier5.pptx`/
	// `--hier8.pptx`: plugging the layout's own declared `sibSp` directly into
	// the fan-axis packing equation with ZERO margin reproduces the cached
	// item width on all three datasets (the `OUTER_MARGIN_X_RATIO`/
	// `OUTER_MARGIN_Y_RATIO` constants are a "Hierarchy"-family-specific
	// measurement - see their own doc comment - and do not generalise to
	// org-chart's own declared shape, which has no comparable internal
	// composite shrink to compensate for). `std` mode (plain "Hierarchy"
	// itself) keeps the existing, still-correct constants.
	const tailedMargin = mode === 'tailed';
	return {
		transposed: false,
		sibSpRatio,
		aspectRatio,
		generationGapRatio: resolveGenerationGapRatio(constraints, 'h', aspectRatio),
		marginXRatio: tailedMargin ? 0 : OUTER_MARGIN_X_RATIO,
		marginYRatio: tailedMargin ? 0 : OUTER_MARGIN_Y_RATIO,
	};
}

// `transposeResult` (the axis-transposition post-pass) now lives in
// `smartart-hierarchy-transpose.ts` (file-size budget); re-exported here so
// existing callers of this module are unaffected.
export { transposeResult } from './smartart-hierarchy-transpose';

// `fitItemBox` (the item-size solve `marginXRatio`/`marginYRatio`/etc feed
// into) now lives in `smartart-hierarchy-fit-item-box.ts` (file-size budget);
// re-exported here so existing callers of this module are unaffected.
export { fitItemBox } from './smartart-hierarchy-fit-item-box';

// `applyChildOrder` (sibling reordering by `dgm:cxn` `srcOrd`) now lives in
// `smartart-hierarchy-child-order.ts` (file-size budget); re-exported here so
// existing callers of this module are unaffected.
export { applyChildOrder } from './smartart-hierarchy-child-order';
