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
import {
	compositeDeclaresCompoundTextRole,
	resolveCompositeChildGeometry,
} from './smartart-hierarchy-composite-child';
import { DEFAULT_ASPECT_RATIO, resolveAspectRatio } from './smartart-hierarchy-constraint-lookup';
import { resolveGenerationGapRatio } from './smartart-hierarchy-generation-gap';
import type { HierarchyOrientation } from './smartart-hierarchy-orientation-types';
import { tailedHierarchyDeclaresChAlign } from './smartart-hierarchy-tailed-transpose';

export { findByReference } from './smartart-hierarchy-constraint-lookup';

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

// `HierarchyOrientation` (the descriptor this module resolves) now lives in
// `smartart-hierarchy-orientation-types.ts` (file-size budget); re-exported
// here so existing callers of this module are unaffected.
export type { HierarchyOrientation };

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
	itemShapeName?: string,
): HierarchyOrientation {
	const constraints = algorithmNode?.allConstraints ?? algorithmNode?.constraints;
	// `sibSp` referencing `h` is the fan-axis-is-vertical signal (see the
	// module doc comment); referencing `w`, or unresolvable, is the classic
	// (non-transposed) orientation.
	// Requires `for`/`forName` BOTH absent: a SCOPED `sibSp` (`for="des"
	// forName="childShape" refType="h" ...`, a generation-2+ hanging row's own
	// vertical gap - `hierarchy-list`/`horizontal-labeled-hierarchy`/`titled-
	// picture-accent-list` all declare one) is not the whole-diagram
	// transposition signal; only an UNSCOPED `sibSp refType="h"` (the genuine
	// "Horizontal Hierarchy" shape) is. See `smartart-track-r-successor.md`'s
	// SESSION 36 section for the corpus derivation - landing this alone
	// regressed `hierarchy-list`/`horizontal-labeled-hierarchy` when they had
	// no correct arranger to route to instead; `hierarchy-list` now takes the
	// dedicated corner-anchored `mode==='hanging'` path (`smartart-hierarchy-
	// corner-plan.ts`) BEFORE this function is ever called, so that
	// interaction no longer applies to it.
	const sibSpReferencesHeight = (constraints ?? []).some(
		(c) =>
			c.type === 'sibSp' &&
			c.referenceType === 'h' &&
			c.for === undefined &&
			c.forName === undefined,
	);
	// The `tailed` (org-chart) family's own transposition signal is DIFFERENT
	// from the `std` "Hierarchy" family's `sibSp`-referencing-`h` one: every
	// `tailed` variant checked (plain "Organization Chart", "Half Circle
	// Organization Chart", "Name and Title Organization Chart", "Horizontal
	// Organization Chart") declares `sibSp refType="w"` identically, so that
	// signal never fires for this family at all. The REAL declarative
	// difference is on `algorithmNode`'s own TOP-LEVEL `hierChild` algorithm
	// (governing the ROOT's own direct-children fan, always live regardless of
	// `hierBranch`/`dir`): classic vertical variants declare ONLY a `linDir`
	// `fromL`/`fromR` mirror pair (RTL, unrelated to orientation) with NO
	// `chAlign` at that level; "Horizontal Organization Chart" ADDITIONALLY
	// declares `chAlign` `l`/`r` there (children aligned LEFT/RIGHT of a
	// vertical connecting stem, i.e. stacked in a column beside the parent,
	// not fanned in a row below it) alongside `linDir fromT`. Verified
	// directly against all four `tailed` fixtures' own cached `layout1.xml`
	// (`half-circle`/`name-and-title`/plain `organization-chart` all omit
	// `chAlign` here; `horizontal-organization-chart` alone declares it) - a
	// structural signal, not a per-layout-name guess. Needs
	// `tailedHierarchyDeclaresChAlign`, not `algorithmParam`:
	// `discoverArrangement` deliberately keeps `algorithmNode` as the
	// ORIGINAL, choose-wrapped node (see that function's own comment), so
	// `algorithmNode.algorithm` is `undefined` for every real org-chart
	// fixture and `chAlign` has to be read out of the raw `dgm:choose`
	// directly - see that module's own doc comment for the full derivation.
	const tailedTransposed = mode === 'tailed' && tailedHierarchyDeclaresChAlign(algorithmNode);
	const sibSpRatio = resolveRatioConstraint(
		constraints,
		index,
		roleOf(algorithmNode),
		['sibSp'],
		DEFAULT_SIB_SP_RATIO,
		algorithmNode?.rules,
	);
	if (sibSpReferencesHeight || tailedTransposed) {
		// Transposed: the fan axis's own size is `h`; the stacking axis is `w`,
		// and the item's cross-axis (logical "cross") size comes from `w:h`
		// resolved as a ratio TO h (i.e. `w = aspectRatio * h`), which the
		// `resolveAspectRatio` helper already gives as `h:w` - invert it here so
		// callers always multiply the fan-axis size to get the cross size.
		const hToW = resolveAspectRatio(constraints, itemShapeName);
		return {
			transposed: true,
			sibSpRatio,
			aspectRatio: hToW > 0 ? 1 / hToW : 1 / DEFAULT_ASPECT_RATIO,
			generationGapRatio: resolveGenerationGapRatio(constraints, 'w', hToW),
			// A transposed hierarchy declares no `composite` wrapper (see below),
			// so there is no cell-vs-item distinction to make: identical to
			// `generationGapRatio` above. `computeHierarchyAxisPitches` never
			// actually reads this field when `transposed` (see its own doc
			// comment), so the exact value here is inert either way.
			compositeGenerationGapRatio: resolveGenerationGapRatio(constraints, 'w', hToW),
			// See `OUTER_MARGIN_X_RATIO`'s doc comment: a transposed hierarchy
			// needs no outer margin at all on either axis, COM-verified.
			marginXRatio: 0,
			marginYRatio: 0,
			// A transposed hierarchy declares no `composite` wrapper (see
			// `smartart-hierarchy-composite-child.ts`'s own module doc comment) -
			// nothing to correct or offset from, and no parent-relative shape to
			// chain through either.
			compositeChainHeightRatio: undefined,
			// SESSION 25 already substituted `generationGapRatio` for the
			// transposed case (see `HierarchyOrientation.hangHeightRatio`'s own
			// SESSION 32 doc comment) - no compound-role guard needed here, no
			// transposed fixture in the corpus declares that shape.
			hangHeightRatio: resolveGenerationGapRatio(constraints, 'w', hToW),
			cardOffsetXRatio: 0,
		};
	}
	// The rendered item's own real aspect/width/offset, when this layout
	// declares a `composite` wrapper around a smaller "background"+"text"
	// pair (the classic non-transposed "Hierarchy" family's own "3D stacked
	// card" shape) - see `smartart-hierarchy-composite-child.ts`'s own module
	// doc comment for the full derivation and its live-COM cross-check
	// against `hierarchy--flat3/hier5/hier8.pptx`. `undefined` for a
	// layoutDef with no such wrapper - falls back to the existing
	// `resolveAspectRatio` reading unchanged.
	// The WRAPPING `composite` node's own top-level `h:w` (e.g. `0.667` for
	// plain "Hierarchy") - distinct from `aspectRatio` below (the RENDERED
	// item's own, smaller, `compositeChild`-corrected aspect when a wrapper
	// exists). Needed as `resolveGenerationGapRatio`'s own `compositeAspect`
	// parameter (see that module's doc comment), and, since SESSION 21, as
	// `resolveCompositeChildGeometry`'s own `wrapperAspect` for the
	// "parent-relative" child-height shape (`circle-picture-hierarchy`) -
	// computed BEFORE that call for this reason.
	const compositeAspect = resolveAspectRatio(constraints, itemShapeName);
	const compositeChild = resolveCompositeChildGeometry(
		algorithmNode,
		compositeAspect,
		mode === 'tailed',
	);
	const aspectRatio = compositeChild?.aspectRatio ?? compositeAspect;
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
		// Deliberately UNCORRECTED (no `compositeChild`/`compositeAspect` args):
		// `fitItemBox`'s own SIZING solve, the only consumer of this field, was
		// already matching cached geometry closely with the raw declared value
		// (`hierarchy--{flat3,hier5,hier8}.pptx` all <=2.44% before this field
		// existed) - measured directly THIS session that passing the
		// composite-correction here instead REGRESSES all three (7.32%/9.38%/
		// 8.26%). The correction belongs on `compositeGenerationGapRatio` below
		// (POSITIONING's own consumer), not here.
		generationGapRatio: resolveGenerationGapRatio(constraints, 'h', compositeAspect),
		// The composite-cell-relative gap `computeHierarchyAxisPitches` uses to
		// POSITION rows (see this field's own doc comment on
		// `HierarchyOrientation`) - WITH the `compositeChild`/`compositeAspect`
		// correction, since positioning centres composite CELLS, not the
		// smaller rendered item (mirrors `compositeWidthFactor`'s own
		// cell-vs-item distinction on the fan axis). Identical to the
		// uncorrected `generationGapRatio` above whenever `compositeChild` is
		// `undefined` (every `tailed` org-chart-family layout: none declares a
		// `composite` wrapper with a smaller rendered child).
		compositeGenerationGapRatio: resolveGenerationGapRatio(
			constraints,
			'h',
			aspectRatio,
			compositeChild,
			compositeAspect,
			index,
			itemShapeName,
		),
		marginXRatio: tailedMargin ? 0 : OUTER_MARGIN_X_RATIO,
		marginYRatio: tailedMargin ? 0 : OUTER_MARGIN_Y_RATIO,
		compositeWidthFactor: compositeChild?.widthFactor,
		compositeHeightFactor: compositeChild?.heightFactor,
		// SESSION 32: see `HierarchyOrientation.compositeChainHeightRatio`'s own
		// doc comment - only defined for the "parent-relative" composite-child
		// shape (`compositeChild.heightFactor` set), `undefined` for the
		// self-referential shape (plain "Hierarchy") and every layout with no
		// `composite` wrapper at all.
		compositeChainHeightRatio:
			compositeChild?.heightFactor !== undefined
				? compositeAspect * compositeChild.heightFactor
				: undefined,
		// SESSION 32: see `HierarchyOrientation.hangHeightRatio`'s own doc
		// comment - `undefined` (callers fall back to the fixed
		// `HANG_HEIGHT_RATIO`) only for the compound, multi-role text box
		// shape; `generationGapRatio` otherwise, matching COM-verified ground
		// truth for the plain "Organization Chart" family.
		hangHeightRatio: compositeDeclaresCompoundTextRole(algorithmNode)
			? undefined
			: resolveGenerationGapRatio(constraints, 'h', compositeAspect),
		cardOffsetXRatio: compositeChild?.offsetXRatio ?? 0,
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
