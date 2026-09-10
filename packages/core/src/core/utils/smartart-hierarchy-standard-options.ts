/**
 * SmartArt DiagramML interpreter - "standard" hierarchy branch options type.
 *
 * Split out of `smartart-hierarchy-standard.ts` (the file-size budget) so
 * `smartart-hierarchy-standard-rows.ts` can reference it without an import
 * cycle back into that module.
 */

import type { TreeNode } from './smartart-helpers';
import { effectiveWidth } from './smartart-hierarchy-orgchart-tree';
import type { HierContext } from './smartart-hierarchy-shared';

/** Resolved options for one standard-branch arrangement pass. */
export interface StandardOptions {
	orgChart: boolean;
	/** Resolved `chPref`/`chMax` row size; `Infinity` when unbounded. */
	perRow: number;
	/**
	 * Fan-aware column-span override (`tailed` mode only - see
	 * `buildFanAwareWidthMap`'s doc comment in `smartart-hierarchy-fan-aware-width.ts`):
	 * when present, every span/offset computation in this module and
	 * `smartart-hierarchy-standard-rows.ts` consults THIS instead of plain
	 * `effectiveWidth` (via `spanOf` below) - a node that is about to HANG (not
	 * fan) collapses its entire subtree to exactly one column regardless of its
	 * own descendant count, matching `placeHangingTree`'s own single
	 * shared-column behaviour. `std` mode (no `hangingPlacer`) never sets this
	 * and keeps using plain `effectiveWidth` everywhere, unaffected.
	 */
	resolveSpan?: (t: TreeNode) => number;
	/**
	 * Present for `hierBranch` `init`/`hang`/`l`/`r`: places every generation
	 * past the root's direct children as a hanging column instead of
	 * continuing the standard fan-out. Takes the FULL sibling list (not one
	 * subtree at a time): genuine PowerPoint output stacks a node's several
	 * ordinary children in ONE shared column at a single x, not one
	 * side-by-side column per child - see `smartart-orgchart-hierbranch.pptx`
	 * in the corpus, where a manager's own two-report tail (each report having
	 * further children of its own) still lands both reports at the same x.
	 * That shared column itself starts offset from `t` by
	 * `HIER_TAIL_OFFSET_RATIO` (the `hierAlign`/`alignOff` root-box alignment;
	 * see its doc comment), not flush with `t`'s own left edge.
	 */
	hangingPlacer?: (hc: HierContext, subtrees: TreeNode[], anchorX: number, anchorY: number) => void;
	/**
	 * True when the layout definition's own per-item template folds every
	 * descendant beyond the root's direct children into that SAME box's text
	 * (`hierarchyLeafFoldsDescendants`, `smartart-hierarchy-fold-depth.ts`) -
	 * `hierarchy-list--hier5.pptx`'s shape, where only ONE generation past the
	 * root gets its own box and anything deeper folds in via the pre-existing
	 * `collectFoldedDescendants` bridge mechanism (see that module's doc
	 * comment). `placeAt` stops recursing into a node's own children once
	 * `level >= 1` when this is set - the common "Hierarchy"/"Organization
	 * Chart" family (recursive `hierRoot`/`hierChild` nesting, one generation
	 * per data depth) leaves this `false` and is unaffected.
	 */
	foldDeeperGenerations?: boolean;
}

/** `t`'s own column span, honouring `options.resolveSpan` when set (see its doc comment). */
export function spanOf(t: TreeNode, options: StandardOptions): number {
	return options.resolveSpan ? options.resolveSpan(t) : effectiveWidth(t, options.orgChart);
}
