/**
 * SmartArt DiagramML interpreter - fan-aware column-span for `tailed` mode.
 *
 * Split out of `smartart-hierarchy-hang-depth.ts` (the file-size budget):
 * `buildFanAwareWidthMap`/`resolveSpanWidth`, sharing that module's own
 * `fanContinues` predicate so the two walks (depth/hang-shape there, width
 * here) can never silently disagree on which nodes hang.
 *
 * `effectiveWidth` (`smartart-hierarchy-orgchart-tree.ts`) is a plain
 * structural leaf-count sum with NO fan/hang awareness - it was being used,
 * unconditionally, for a hanging branch's own row-share too. But a branch
 * that HANGS collapses its entire subtree into exactly ONE shared column
 * (`placeHangingTree`'s own doc comment: "ALL of t's own ordinary children
 * share ONE column"), so its correct width contribution is always 1, not
 * its leaf count. `buildFanAwareWidthMap` computes the CORRECT span per
 * node, threaded through `StandardOptions.resolveSpan` (`smartart-
 * hierarchy-standard-options.ts`) into BOTH `fitItemBox`'s own
 * `totalLeaves` (sizing) AND the actual row positioning
 * (`placeStandardTree`/`placeFlatChildren`) - previously ALSO over-
 * allocating a hanging child's row-share, a real positioning bug, not just
 * a sizing one.
 *
 * Pure decision logic (no rendering); mirrors `placeAt`'s CURRENT rules
 * exactly, via the shared `fanContinues` predicate.
 */

import type { TreeNode } from './smartart-helpers';
import { fanContinues } from './smartart-hierarchy-hang-depth';
import { effectiveWidth, partitionChildren } from './smartart-hierarchy-orgchart-tree';

function widthWalk(
	t: TreeNode,
	level: number,
	perRow: number,
	orgChart: boolean,
	siblingCount: number | undefined,
	map: Map<TreeNode, number>,
): number {
	const { normal } = partitionChildren(t, orgChart);
	let width: number;
	if (normal.length === 0) {
		width = 1;
	} else if (level === 0) {
		width = 0;
		for (const child of normal) {
			width += widthWalk(child, level + 1, perRow, orgChart, normal.length, map);
		}
	} else if (fanContinues(t, perRow, orgChart, siblingCount, normal.length)) {
		width = 0;
		for (const child of normal) {
			width += widthWalk(child, level + 1, perRow, orgChart, undefined, map);
		}
	} else {
		// Hangs: `placeHangingTree` stacks EVERY one of `t`'s own descendants in
		// ONE shared vertical column (see that module's own doc comment on
		// `placeHangingTree`) - `t`'s entire subtree, however many leaves or how
		// deep, consumes exactly the SAME single column width as a plain leaf,
		// unlike `effectiveWidth`'s structural leaf-count sum (which assumes
		// every generation might fan and over-allocates a hanging branch's own
		// row-share whenever it has more than one descendant leaf).
		width = 1;
	}
	map.set(t, width);
	return width;
}

/**
 * Fan-aware column-span lookup for `tailed` mode's own hang/fan decision:
 * unlike `effectiveWidth` (`smartart-hierarchy-orgchart-tree.ts`, a
 * structural leaf-count sum with no hang awareness), a node whose own
 * children HANG (not fan) collapses its entire subtree into exactly ONE
 * column - see `widthWalk`'s own doc comment. Returns a lookup keyed by
 * `TreeNode` identity (the SAME tree instances `placeStandardTree`/
 * `placeFlatChildren` walk), covering every node reachable from `roots`.
 * `std` mode has no hang concept at all (`hangingPlacer` unset) and must
 * keep using plain `effectiveWidth` directly - only a `tailed`-mode caller
 * should build and thread this map through (see `resolveSpanWidth` and
 * `StandardOptions.resolveSpan`, `smartart-hierarchy-standard-options.ts`).
 */
export function buildFanAwareWidthMap(
	roots: readonly TreeNode[],
	orgChart: boolean,
	perRow: number,
): Map<TreeNode, number> {
	const map = new Map<TreeNode, number>();
	for (const root of roots) {
		widthWalk(root, 0, perRow, orgChart, undefined, map);
	}
	return map;
}

/**
 * Resolve `t`'s own column span, consulting `map` (when present - `tailed`
 * mode) and falling back to plain `effectiveWidth` otherwise (`std` mode, or
 * a node `map` never reached - should not happen for any node actually
 * walked by `placeStandardTree`, but a safe fallback rather than a throw).
 */
export function resolveSpanWidth(
	map: Map<TreeNode, number> | undefined,
	t: TreeNode,
	orgChart: boolean,
): number {
	const fromMap = map?.get(t);
	return fromMap ?? effectiveWidth(t, orgChart);
}
