/**
 * SmartArt DiagramML interpreter - hierarchy item-box sizing.
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * `fitItemBox` itself, kept alongside `HIER_TAIL_OFFSET_RATIO` (its own
 * `maxHangDepth` WIDTH term) and `HANG_HEIGHT_RATIO` (its own `maxHangRows`
 * HEIGHT term). Pure geometry; no framework code, no DOM.
 */

import { HANG_HEIGHT_RATIO, HIER_TAIL_OFFSET_RATIO } from './smartart-hierarchy-shared';
import type { BoundingBox } from './smartart-layout-types';

/**
 * WIDTH-axis extra reservation, active ONLY when `HierarchyHangShape
 * .allChildrenHang` is true (every one of the root's own direct children
 * hangs, none a leaf, none continuing to fan) - see that field's own doc
 * comment in `smartart-hierarchy-hang-depth.ts` for the structural
 * definition and why partial-hang shapes (2 of 3 branches, etc.) do not
 * need it. COM-verified (SESSION 23) against `half-circle-organization-
 * chart--hier5.pptx` (the SAME `organization-chart--hier5.pptx` tree shape,
 * n=2, BOTH children hang 1 leaf each - the first fixture where the item's
 * OWN aspect correction flips this axis to WIDTH-bound, exposing `widthFit`'s
 * own residual directly instead of it staying masked by the height-bound
 * clamp): reproduces the cached `278px` item width from `867px` box width
 * within 0.3% (`867/(2+1*0.21+1*0.25+0.6587)=277.9`) - a MEASURED constant
 * (matching this module's own existing `HIER_TAIL_OFFSET_RATIO`/
 * `HANG_HEIGHT_RATIO` precedent, neither of which traces to a declared XML
 * fact either), NOT yet verified to scale correctly for `n>=3` (no clean COM
 * sample exists where every one of 3+ branches hangs with none a leaf) -
 * see `smartart-track-r-successor.md` SESSION 23 for the derivation and
 * this open question.
 */
export const ALL_CHILDREN_HANG_EXTRA_RATIO = 0.6587;

/**
 * Fit one item box's width/height for the `std`/`tailed` branch modes: the
 * box width is whatever fits `columns` siblings (the diagram's total
 * leaf-column count, `effectiveWidth` summed over every root - see its doc
 * comment in `smartart-hierarchy-shared.ts`) side by side with a
 * `sibSpRatio` gap between each pair, inset from the box edges by
 * `marginXRatio`; the box height is the SMALLER of that width's natural
 * `aspectRatio` and whatever fits `levels` stacked generations (the tree's
 * own depth) with a `generationGapRatio` gap between each, inset by
 * `marginYRatio`. Every ratio comes from `resolveHierarchyOrientation`
 * (`smartart-hierarchy-orientation.ts`), which reads them from the layout's
 * own declared constraints where possible (`marginXRatio`/`marginYRatio` are
 * the one exception - see `OUTER_MARGIN_X_RATIO`'s doc comment for why they
 * are 0 for a transposed hierarchy and a fixed measured constant otherwise)
 * - matching every genuine sample measured: a shallow, narrow tree
 * ("hierarchy--hier8.pptx") renders at its natural aspect (width-bound), a
 * tall tailed hang ("hierarchy--hier5.pptx") renders visibly SQUASHED below
 * that aspect (height-bound), and a 1-generation fan
 * ("hierarchy--flat3.pptx") falls between the two. Callers pass a `box` and
 * `columns`/`levels` already in the correct (possibly transposed)
 * orientation; this function itself has no orientation logic.
 *
 * `maxHangDepth` (default `0`, every existing `std`-mode caller unaffected):
 * the deepest hanging-tail chain past `levels`' own fanned generations (see
 * `smartart-hierarchy-hang-depth.ts`'s `computeHangShape`) - a `tailed`
 * hierarchy's hanging portion consumes EXTRA room on the WIDTH axis a plain
 * `columns` count never captures (`HIER_TAIL_OFFSET_RATIO`'s own per-hop
 * horizontal indent, the SAME constant `placeAt` uses to POSITION the
 * hanging tail, reused here so the item is SIZED consistently with where it
 * will actually be placed). COM-verified against `organization-chart--
 * flat3.pptx` (`maxHangDepth=0`, unaffected) / `--hier5.pptx`/`--hier8.pptx`
 * (`maxHangDepth=1`, `levels` itself already larger via `computeHangShape`'s
 * own fan-boundary detection): reproduces the cached item box within ~1% on
 * both axes for all three, without needing a margin (`marginXRatio`/
 * `marginYRatio` are `0` for `tailed` mode - see `resolveHierarchyOrientation`'s
 * own doc comment).
 *
 * `maxHangRows` (default `maxHangDepth`, so a caller that only ever measured
 * `maxHangDepth` - a pure hanging chain, at most 1 ordinary child per hung
 * node - is unaffected): the SEPARATE HEIGHT-axis term, the tallest hanging
 * branch's own row count (`HierarchyHangShape.maxHangRows`'s doc comment in
 * `smartart-hierarchy-hang-depth.ts` has the full derivation and the COM
 * sweep that found it diverges from `maxHangDepth` whenever a hung node has
 * more than one ordinary child - `placeHangingTree` stacks every one of
 * THOSE in the SAME shared column, one row each, not one row per hop).
 *
 * `hangHeightRatio` (default `HANG_HEIGHT_RATIO`, every existing caller
 * unaffected): the per-hang-row HEIGHT-axis gap constant `maxHangRows`
 * multiplies. SESSION 25 (`smartart-track-r-successor.md`): a `tailed`
 * hierarchy whose hang ALSO grows along the fan-becomes-generation
 * transposed axis (`orientation.transposed`, e.g. "Horizontal Organization
 * Chart" - see `resolveHierarchyOrientation`'s own `tailedTransposed`
 * signal) needs `orientation.generationGapRatio` here instead of the fixed
 * `0.55`: COM-verified against `horizontal-organization-chart--hier5.pptx`
 * (`n=2`, both children hang 1 leaf each - the SAME tree shape as plain
 * `organization-chart--hier5.pptx`, which stays correct with the DEFAULT
 * `HANG_HEIGHT_RATIO`, confirming this is a transposed-only correction, not
 * a universal one): the un-substituted denominator (`2+1+0.2+1*0.55=3.75`)
 * under-sizes the item box by the SAME ~10% on BOTH axes (`boxW`/`boxH`
 * share one aspect ratio here); substituting `generationGapRatio=0.2` gives
 * `2+1+0.2+1*0.2=3.4`, matching the cached item box within 0.4%.
 */
export function fitItemBox(
	box: BoundingBox,
	columns: number,
	levels: number,
	sibSpRatio: number,
	aspectRatio: number,
	generationGapRatio: number,
	marginXRatio: number,
	marginYRatio: number,
	maxHangDepth = 0,
	clampToNaturalAspect = true,
	maxHangRows = maxHangDepth,
	allChildrenHang = false,
	hangHeightRatio = HANG_HEIGHT_RATIO,
	compositeChainHeightRatio?: number,
): { boxW: number; boxH: number } {
	const n = Math.max(1, columns);
	const usableW = box.width - 2 * box.width * marginXRatio;
	const allHangExtra = allChildrenHang ? ALL_CHILDREN_HANG_EXTRA_RATIO : 0;
	const widthFit =
		usableW /
		(n + Math.max(0, n - 1) * sibSpRatio + maxHangDepth * HIER_TAIL_OFFSET_RATIO + allHangExtra);
	const generations = Math.max(1, levels);
	const usableH = box.height - 2 * box.height * marginYRatio;
	const heightFit =
		usableH /
		(generations +
			maxHangRows +
			Math.max(0, generations - 1) * generationGapRatio +
			maxHangRows * hangHeightRatio);
	// `clampToNaturalAspect` (default `true`, every existing `std`-mode caller
	// unaffected): "Hierarchy" itself always wants the SMALLER of its own
	// declared `h:w` natural aspect and whatever the generation axis actually
	// fits (see this function's own doc comment) - but "Organization Chart"
	// does NOT: COM-verified against `organization-chart--flat3.pptx`
	// (natural aspect 196px vs cached 220px - the LARGER `heightFit`, not the
	// smaller natural value, is what cached ground truth uses) and
	// `--hier8.pptx` (natural 71px vs cached 101px, `heightFit` 99px - again
	// the larger `heightFit` wins). `tailed`-mode callers pass `false` so the
	// generation-axis room (already correctly hang-aware via `maxHangDepth`)
	// determines the item's height directly, un-clamped by the declared
	// aspect ratio.
	const naturalHeight = widthFit * aspectRatio;
	// SESSION 32: for the "parent-relative" composite-child shape
	// (`compositeChainHeightRatio` defined - see `resolveHierarchyOrientation`'s
	// own `HierarchyOrientation.compositeChainHeightRatio` doc comment, e.g.
	// `circle-picture-hierarchy--hier5.pptx`), `widthFit` IS the WRAPPING
	// `composite` cell's own width (`compositeW`, un-shrunk - the layout's own
	// top-level `w for=des forName=composite refType=w` declares composite's
	// width equal to the free `w` variable `widthFit` solves for, fact 1),
	// unlike `aspectRatio` (the RENDERED child's own, already-shrunk aspect) -
	// so `naturalHeight = widthFit * aspectRatio` does NOT give the rendered
	// item's true height for this shape (COM-verified: the raw declared
	// `heightFit` denominator - generic `generations`/`generationGapRatio`
	// packing, calibrated only against the SELF-referential composite shape's
	// own cached row spacing - produces the SAME box height for three
	// structurally different fixtures sharing a box/depth/margin, i.e. is
	// structurally incapable of reflecting this shape's own composite chain at
	// all). `compositeChainHeightRatio * widthFit` IS the correct chain
	// (`compositeH = compositeW * compositeAspect`, `renderedItem.h =
	// compositeH * compositeHeightFactor`), verified within 0.9% of
	// `circle-picture-hierarchy--hier5.pptx`'s own cached item height (vs the
	// un-corrected `heightFit` clamp's 9.5%) - bypasses BOTH the `heightFit`
	// clamp and the `naturalHeight`/`aspectRatio` route entirely, since neither
	// is a principled model for this shape.
	const boxH =
		compositeChainHeightRatio !== undefined
			? widthFit * compositeChainHeightRatio
			: clampToNaturalAspect
				? Math.min(naturalHeight, heightFit)
				: heightFit;
	// `clampToNaturalAspect` callers (`std` mode) keep the item's OWN declared
	// `aspectRatio` invariant no matter which axis actually bound `boxH`: when
	// the WIDTH axis bound it (`boxH===naturalHeight`), `boxH/aspectRatio`
	// already equals `widthFit` exactly, so this is a no-op; when the HEIGHT
	// axis bound it instead (`boxH===heightFit < naturalHeight`, real PowerPoint
	// output round 11/SESSION 8 found this is the COMMON case for a
	// multi-generation tree - see `smartart-layout-interpreter-hierarchy.ts`'s
	// module doc comment), `boxW` must SHRINK along with `boxH` to keep the
	// same aspect, not stay at the wider `widthFit` - the round-11 reader
	// correction exposed this as a REAL bug (COM-verified against
	// `hierarchy--hier5.pptx`: the old unconditional `widthFit` produced a
	// 372x131 box, aspect 0.352, silently violating its own declared 0.667
	// aspect; `boxW=boxH/aspectRatio` instead keeps every `std`-mode box at
	// its own declared aspect always, matching what a real DiagramML renderer
	// does). `tailed` callers (`clampToNaturalAspect=false`) are UNCHANGED:
	// org-chart-family items are not aspect-locked at all (see this
	// function's own doc comment on `clampToNaturalAspect`), so `boxW` stays
	// `widthFit` there regardless of which axis bound `boxH`.
	const boxW = clampToNaturalAspect ? boxH / aspectRatio : widthFit;
	return { boxW: Math.max(1, boxW), boxH: Math.max(1, boxH) };
}
