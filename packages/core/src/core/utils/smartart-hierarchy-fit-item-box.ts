/**
 * SmartArt DiagramML interpreter - hierarchy item-box sizing.
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * `fitItemBox` itself, kept alongside `HANG_HEIGHT_RATIO`/
 * `HIER_TAIL_OFFSET_RATIO`, the two ratios its own `maxHangDepth` term
 * consumes. Pure geometry; no framework code, no DOM.
 */

import { HANG_HEIGHT_RATIO, HIER_TAIL_OFFSET_RATIO } from './smartart-hierarchy-shared';
import type { BoundingBox } from './smartart-layout-types';

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
 * hierarchy's hanging portion consumes EXTRA room on both axes that a plain
 * `columns`/`levels` count never captures (`HIER_TAIL_OFFSET_RATIO`'s own
 * per-hop horizontal indent, `HANG_HEIGHT_RATIO`'s own per-hop vertical
 * gap - the SAME two constants `placeAt`/`placeHangingTree` actually use to
 * POSITION the hanging tail, reused here so the item is SIZED consistently
 * with where it will actually be placed). COM-verified against
 * `organization-chart--flat3.pptx` (`maxHangDepth=0`, unaffected) /
 * `--hier5.pptx` (`maxHangDepth=1`) / `--hier8.pptx` (`maxHangDepth=1`,
 * `levels` itself already larger via `computeHangShape`'s own fan-boundary
 * detection): reproduces the cached item box within ~1% on both axes for all
 * three, without needing a margin (`marginXRatio`/`marginYRatio` are `0` for
 * `tailed` mode - see `resolveHierarchyOrientation`'s own doc comment).
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
): { boxW: number; boxH: number } {
	const n = Math.max(1, columns);
	const usableW = box.width - 2 * box.width * marginXRatio;
	const widthFit =
		usableW / (n + Math.max(0, n - 1) * sibSpRatio + maxHangDepth * HIER_TAIL_OFFSET_RATIO);
	const generations = Math.max(1, levels);
	const usableH = box.height - 2 * box.height * marginYRatio;
	const heightFit =
		usableH /
		(generations +
			maxHangDepth +
			Math.max(0, generations - 1) * generationGapRatio +
			maxHangDepth * HANG_HEIGHT_RATIO);
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
	const boxH = clampToNaturalAspect ? Math.min(naturalHeight, heightFit) : heightFit;
	return { boxW: Math.max(1, widthFit), boxH: Math.max(1, boxH) };
}
