/**
 * SmartArt DiagramML interpreter - hierarchy generation-count shape, for
 * `fitItemBox`'s own item-size solve.
 *
 * `fitItemBox` (`smartart-hierarchy-orientation.ts`) used the data tree's own
 * FULL `treeDepth` as the generation-axis "row count" for every branch mode,
 * which is correct for `std` (every generation genuinely fans, one row each)
 * but WRONG for `tailed` (only the root's own children fan; everything
 * deeper hangs in an indented column via `placeHangingForest`, a completely
 * different vertical-consumption model - `HangingOptions.vGap`, not
 * `fitItemBox`'s own `generationGapRatio`). COM-verified regression:
 * `organization-chart--hier5.pptx`/`--hier8.pptx`/`--flat3.pptx` all measure
 * a SMALLER real item box than `treeDepth`-based packing predicts, and the
 * error does NOT scale uniformly with `treeDepth` alone (see this module's
 * own derivation notes in `smartart-layout-interpreter-hierarchy.ts`'s
 * `arrangeHierarchy` doc comment).
 *
 * `computeHangShape` walks the SAME fan/hang decision `smartart-hierarchy-
 * standard.ts`'s `placeAt`/`smartart-hierarchy-fan.ts`'s `planFan` actually
 * make (mirrored here as a pure "dry run", not a shared code path, to avoid
 * a value-level import cycle with the render-context-bound `placeAt`) and
 * returns:
 *
 *   - `fannedGenerations`: how many generations genuinely fan (root's own
 *     children ALWAYS count as 2 minimum when the tree has any children at
 *     all; a "solo chain link" - a node with no real siblings of its own
 *     whose own child count matches its pre-allocated span - continues
 *     fanning one generation deeper, exactly `placeAt`'s own rule, so this
 *     can be 3+ for a fixture like `organization-chart--hier8.pptx`).
 *   - `maxHangDepth`: the deepest hanging chain (in hops) ANYWHERE in the
 *     tree, past whichever generation stops fanning - used ONLY for the
 *     WIDTH axis (`HIER_TAIL_OFFSET_RATIO`'s own per-hop horizontal indent):
 *     a hanging column only indents FURTHER when it nests deeper, never when
 *     it merely gets wider at the SAME depth.
 *   - `maxHangRows`: the tallest hanging branch's own ROW count, for the
 *     HEIGHT axis - see `countDescendants`'s own doc comment for why this is
 *     a DIFFERENT number from `maxHangDepth` (hop count) whenever a hanging
 *     node has more than one ordinary child: `placeHangingTree` stacks EVERY
 *     one of a hung node's own children in the SAME shared column, one row
 *     each (see that module's own doc comment), so a hanging node with 3
 *     sibling leaves consumes 3 rows of height at hang-DEPTH 1, not 1.
 *     `maxHangDepth` and `maxHangRows` COINCIDE for a pure chain (each
 *     hanging node has at most 1 ordinary child) - every fixture this module
 *     was originally derived against (SESSION 8-10) happened to be a pure
 *     chain, which is why the two were never distinguished until a COM
 *     sweep (SESSION 22, `smartart-track-r-successor.md`) built trees with a
 *     hanging node that has 2+ ordinary children and found the two numbers
 *     genuinely diverge: `organization-chart`-style samples with a single
 *     hanging branch of 2/3 sibling leaves measured a cached item width
 *     that `maxHangDepth`-based height reservation could not reproduce
 *     (+16.3%/-6.9% off with `maxHangDepth=1` either way, vs `maxHangDepth`-
 *     only chain samples all landing within -7% of cached), while a SECOND,
 *     INDEPENDENT sample with two hanging branches of 3 and 1 leaves each
 *     measured the EXACT SAME cached width as the single 3-leaf-branch
 *     sample - confirming the height driver is `max` over branches of each
 *     branch's OWN row count, not `maxHangDepth`'s hop count.
 *
 * Pure decision logic (no rendering); mirrors `placeAt`'s CURRENT rules
 * exactly - a future change to that fan/hang decision must update this
 * module too, or the two will silently disagree on how big to size the item.
 */

import { treeDepth } from './smartart-helpers';
import type { TreeNode } from './smartart-helpers';
import { effectiveWidth, partitionChildren } from './smartart-hierarchy-orgchart-tree';

/** Generation-count shape used by `fitItemBox`'s generation-axis solve. */
export interface HierarchyHangShape {
	/** Count of genuinely fanned generations (>= 2 whenever the tree has any children; 1 for a single lone root). */
	fannedGenerations: number;
	/** Deepest hanging chain (in hops past the fan boundary), 0 when nothing hangs - WIDTH axis only, see the module doc comment. */
	maxHangDepth: number;
	/** Tallest hanging branch's own row count, 0 when nothing hangs - HEIGHT axis only, see the module doc comment. */
	maxHangRows: number;
	/**
	 * True when EVERY one of the root's own direct children hangs (has its
	 * own ordinary descendants AND does not continue fanning) - a plain leaf
	 * child (no descendants at all) or a fan-continuing child (e.g. a solo
	 * chain link) both make this `false`. SESSION 23 COM finding: the WIDTH
	 * axis needs an ADDITIONAL reservation, past `maxHangDepth`'s own
	 * per-hop indent, specifically in this all-hang case - measured directly
	 * against `half-circle-organization-chart--hier5.pptx` (the SAME
	 * underlying `organization-chart--hier5.pptx` data shape, n=2, BOTH
	 * children hang exactly 1 leaf each - the first fixture where this axis
	 * is actually WIDTH-bound, exposing `widthFit`'s own residual for the
	 * first time; every other measured hang shape, including partial hangs
	 * with 2 of 3 or 2 of 4 branches hanging, needed NO such extra - see
	 * `ALL_CHILDREN_HANG_EXTRA_RATIO`'s own doc comment in `smartart-
	 * hierarchy-fit-item-box.ts`). NOT yet verified for `n>=3` (no clean COM
	 * sample exists where every one of 3+ branches hangs with none a leaf) -
	 * flagging this for a successor rather than silently extrapolating.
	 */
	allChildrenHang: boolean;
	/**
	 * Count of leaf columns (out of `totalLeaves`) whose path passes through a
	 * hang - one per `walk` call that returns via the HANG branch, summed (not
	 * maxed) across the forest. SESSION 34 (`organization-chart--hier8.pptx`,
	 * 8/8 matched but a uniform ~4% item under-size): `fitItemBox`'s WIDTH-axis
	 * `maxHangDepth * HIER_TAIL_OFFSET_RATIO` reservation was calibrated
	 * against `organization-chart--hier5.pptx` (`n=2`, BOTH columns hang - see
	 * `allChildrenHang`) and applied unscoped to every `tailed` fixture;
	 * `hier8.pptx` has `n=5` columns but only ONE passes through a hang, so the
	 * SAME absolute reservation over-shrinks all 5 items, not just that one.
	 * `fitItemBox` scales the reservation by `hangingColumns / columns`:
	 * `hier5.pptx` (`hangingColumns === columns === 2`) is unchanged (fraction
	 * `1`); `hier8.pptx` (`1/5`) lands within 0.6% of cached.
	 */
	hangingColumns: number;
}

/**
 * Total row count `t`'s own hanging subtree consumes (excluding `t` itself,
 * already placed in the fanned row): `placeHangingTree`'s own DFS visits
 * (and advances the shared vertical cursor for) every ordinary descendant of
 * `t`, not just the deepest chain - see the module doc comment on
 * `maxHangRows`.
 */
function countDescendants(t: TreeNode, orgChart: boolean): number {
	const { normal } = partitionChildren(t, orgChart);
	let count = normal.length;
	for (const child of normal) {
		count += countDescendants(child, orgChart);
	}
	return count;
}

/**
 * `t`'s own fan/hang outcome, mirroring `placeAt`'s `level >= 1` branch:
 * `chPrefFanEligible` (a finite `chPref`/`chMax` row `t` itself fills) OR
 * `t` being a "solo chain link" (no real siblings of its own) whose
 * pre-allocated span exactly matches its own child count. Shared by `walk`
 * (below, depth/hang-shape) and `buildFanAwareWidthMap` (width) so the two
 * walks can never silently disagree on which nodes hang - see this module's
 * own doc comment on why they are two separate passes over the same tree in
 * the first place (avoiding a value-level import cycle with `placeAt`).
 * `siblingCount` is `undefined` when `placeAt` would call `t` with no
 * `siblingCxs` of its own (the tree root's immediate call, OR any child
 * reached through `placeFannedRow`'s own fan-continuation - see that
 * function's own call site, which never threads `siblingCxs` through) -
 * `placeAt`'s own `isSoloChainLink` treats that identically to a literal
 * 1-long array, so both collapse to the same "eligible" case here.
 */
export function fanContinues(
	t: TreeNode,
	perRow: number,
	orgChart: boolean,
	siblingCount: number | undefined,
	normalCount: number,
): boolean {
	const chPrefFanEligible =
		Number.isFinite(perRow) && siblingCount === perRow && normalCount >= perRow;
	const isSoloChainLink = siblingCount === undefined || siblingCount === 1;
	const spanW = effectiveWidth(t, orgChart);
	return chPrefFanEligible || (isSoloChainLink && normalCount > 1 && spanW === normalCount);
}

interface WalkResult {
	deepestFanLevel: number;
	maxHangDepth: number;
	maxHangRows: number;
	/** See `HierarchyHangShape.hangingColumns`'s own doc comment: summed, not maxed. */
	hangingColumns: number;
}

function walk(
	t: TreeNode,
	level: number,
	perRow: number,
	orgChart: boolean,
	siblingCount: number | undefined,
): WalkResult {
	const { normal } = partitionChildren(t, orgChart);
	if (normal.length === 0) {
		return { deepestFanLevel: level, maxHangDepth: 0, maxHangRows: 0, hangingColumns: 0 };
	}
	if (level === 0) {
		// `placeAt`'s own `level >= 1` gate excludes the root: its own children
		// always fan as one row, real `siblingCxs` set to the row's own length.
		let deepestFan = level;
		let maxHang = 0;
		let maxRows = 0;
		let hangingColumns = 0;
		for (const child of normal) {
			const r = walk(child, level + 1, perRow, orgChart, normal.length);
			deepestFan = Math.max(deepestFan, r.deepestFanLevel);
			maxHang = Math.max(maxHang, r.maxHangDepth);
			maxRows = Math.max(maxRows, r.maxHangRows);
			hangingColumns += r.hangingColumns;
		}
		return {
			deepestFanLevel: deepestFan,
			maxHangDepth: maxHang,
			maxHangRows: maxRows,
			hangingColumns,
		};
	}
	// `planFan`'s own "chPref-reached fan" (finite `perRow`, `t` one of exactly
	// `perRow` siblings, `t`'s own child count >= `perRow`) is intentionally
	// NOT modelled precisely here (none of the fixtures this module was
	// derived against reach it - org-chart-family `chPref` resolves to
	// `Infinity`, see `resolveRowSize`'s own doc comment) - approximated as
	// "continues fanning" when it would structurally qualify, so a future
	// fixture that DOES reach it degrades to a slight over-estimate of fanned
	// generations rather than silently mis-measuring.
	if (fanContinues(t, perRow, orgChart, siblingCount, normal.length)) {
		let deepestFan = level + 1;
		let maxHang = 0;
		let maxRows = 0;
		let hangingColumns = 0;
		for (const child of normal) {
			// `placeFannedRow` never threads `siblingCxs` through to a fanned
			// child's own recursive `placeAt` call - see this function's own doc
			// comment - so every fan-continued child's OWN children are
			// evaluated as `siblingCount = undefined` here too.
			const r = walk(child, level + 1, perRow, orgChart, undefined);
			deepestFan = Math.max(deepestFan, r.deepestFanLevel);
			maxHang = Math.max(maxHang, r.maxHangDepth);
			maxRows = Math.max(maxRows, r.maxHangRows);
			hangingColumns += r.hangingColumns;
		}
		return {
			deepestFanLevel: deepestFan,
			maxHangDepth: maxHang,
			maxHangRows: maxRows,
			hangingColumns,
		};
	}
	// Hangs: `placeHangingTree` is a pure DFS recursion with no fan re-entry
	// (see its own doc comment), so every node below `t` (t included) forms
	// ONE hanging chain; `treeDepth(t) - 1` is the hop count from `t` itself
	// down to its own deepest descendant (WIDTH axis). `countDescendants(t)`
	// is the SEPARATE row count that same subtree consumes vertically
	// (HEIGHT axis) - see `HierarchyHangShape.maxHangRows`'s doc comment for
	// why these two numbers are not the same whenever `t` has more than one
	// ordinary child. `t` itself is exactly ONE hanging column (its whole
	// subtree collapses into one shared column - see `HierarchyHangShape
	// .hangingColumns`'s own doc comment), never summed further: nothing below
	// a hang re-enters the fan/hang decision.
	return {
		deepestFanLevel: level,
		maxHangDepth: treeDepth(t) - 1,
		maxHangRows: countDescendants(t, orgChart),
		hangingColumns: 1,
	};
}

/**
 * True when EVERY one of `root`'s own direct children hangs - see
 * `HierarchyHangShape.allChildrenHang`'s own doc comment. A child "hangs"
 * when it has its own ordinary descendants (`childNormal.length > 0`) AND
 * its own `walk` never continued fanning past its own level (the SAME
 * `deepestFanLevel === childLevel` signal a hanging leaf and a genuinely
 * hanging branch share - `childNormal.length > 0` is what tells them apart).
 */
function allChildrenHangForRoot(root: TreeNode, orgChart: boolean, perRow: number): boolean {
	const { normal } = partitionChildren(root, orgChart);
	if (normal.length === 0) {
		return false;
	}
	const childLevel = 1;
	return normal.every((child) => {
		const childNormalCount = partitionChildren(child, orgChart).normal.length;
		if (childNormalCount === 0) {
			return false;
		}
		const r = walk(child, childLevel, perRow, orgChart, normal.length);
		return r.deepestFanLevel === childLevel;
	});
}

/**
 * Compute the fanned-generation count and deepest hang depth for a `tailed`
 * (or `std`) hierarchy forest - see the module doc comment. For `std` mode
 * (every generation fans, `hangingPlacer` never engaged), pass `perRow` and
 * treat every node as if `level >= 1`'s hang branch never applies: callers
 * should only invoke this for `tailed` mode; `std` mode keeps using the full
 * `treeDepth` directly (this function is a no-op improvement there, see
 * `arrangeHierarchy`'s own call site).
 */
export function computeHangShape(
	roots: readonly TreeNode[],
	orgChart: boolean,
	perRow: number,
): HierarchyHangShape {
	let fannedGenerations = 1;
	let maxHangDepth = 0;
	let maxHangRows = 0;
	let allChildrenHang = false;
	let hangingColumns = 0;
	for (const root of roots) {
		const r = walk(root, 0, perRow, orgChart, undefined);
		fannedGenerations = Math.max(fannedGenerations, r.deepestFanLevel + 1);
		maxHangDepth = Math.max(maxHangDepth, r.maxHangDepth);
		maxHangRows = Math.max(maxHangRows, r.maxHangRows);
		allChildrenHang ||= allChildrenHangForRoot(root, orgChart, perRow);
		hangingColumns += r.hangingColumns;
	}
	return { fannedGenerations, maxHangDepth, maxHangRows, allChildrenHang, hangingColumns };
}
