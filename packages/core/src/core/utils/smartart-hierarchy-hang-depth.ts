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
 *     tree, past whichever generation stops fanning - `placeHangingTree`
 *     never re-enters a fan decision once a node hangs (pure DFS recursion,
 *     see that module's own doc comment), so every node below the hang
 *     boundary contributes to ONE chain measured by ordinary `treeDepth`.
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
	/** Deepest hanging chain (in hops past the fan boundary), 0 when nothing hangs. */
	maxHangDepth: number;
}

/**
 * `t`'s own fan/hang outcome, mirroring `placeAt`'s `level >= 1` branch.
 * `siblingCount` is `undefined` when `placeAt` would call `t` with no
 * `siblingCxs` of its own (the tree root's immediate call, OR any child
 * reached through `placeFannedRow`'s own fan-continuation - see that
 * function's own call site, which never threads `siblingCxs` through) -
 * `placeAt`'s own `isSoloChainLink` treats that identically to a literal
 * 1-long array, so both collapse to the same "eligible" case here.
 */
function walk(
	t: TreeNode,
	level: number,
	perRow: number,
	orgChart: boolean,
	siblingCount: number | undefined,
): { deepestFanLevel: number; maxHangDepth: number } {
	const { normal } = partitionChildren(t, orgChart);
	if (normal.length === 0) {
		return { deepestFanLevel: level, maxHangDepth: 0 };
	}
	if (level === 0) {
		// `placeAt`'s own `level >= 1` gate excludes the root: its own children
		// always fan as one row, real `siblingCxs` set to the row's own length.
		let deepestFan = level;
		let maxHang = 0;
		for (const child of normal) {
			const r = walk(child, level + 1, perRow, orgChart, normal.length);
			deepestFan = Math.max(deepestFan, r.deepestFanLevel);
			maxHang = Math.max(maxHang, r.maxHangDepth);
		}
		return { deepestFanLevel: deepestFan, maxHangDepth: maxHang };
	}
	// `planFan`'s own "chPref-reached fan" (finite `perRow`, `t` one of exactly
	// `perRow` siblings, `t`'s own child count >= `perRow`) is intentionally
	// NOT modelled precisely here (none of the fixtures this module was
	// derived against reach it - org-chart-family `chPref` resolves to
	// `Infinity`, see `resolveRowSize`'s own doc comment) - approximated as
	// "continues fanning" when it would structurally qualify, so a future
	// fixture that DOES reach it degrades to a slight over-estimate of fanned
	// generations rather than silently mis-measuring.
	const chPrefFanEligible =
		Number.isFinite(perRow) && siblingCount === perRow && normal.length >= perRow;
	const isSoloChainLink = siblingCount === undefined || siblingCount === 1;
	const spanW = effectiveWidth(t, orgChart);
	const continuesFanning =
		chPrefFanEligible || (isSoloChainLink && normal.length > 1 && spanW === normal.length);
	if (continuesFanning) {
		let deepestFan = level + 1;
		let maxHang = 0;
		for (const child of normal) {
			// `placeFannedRow` never threads `siblingCxs` through to a fanned
			// child's own recursive `placeAt` call - see this function's own doc
			// comment - so every fan-continued child's OWN children are
			// evaluated as `siblingCount = undefined` here too.
			const r = walk(child, level + 1, perRow, orgChart, undefined);
			deepestFan = Math.max(deepestFan, r.deepestFanLevel);
			maxHang = Math.max(maxHang, r.maxHangDepth);
		}
		return { deepestFanLevel: deepestFan, maxHangDepth: maxHang };
	}
	// Hangs: `placeHangingTree` is a pure DFS recursion with no fan re-entry
	// (see its own doc comment), so every node below `t` (t included) forms
	// ONE hanging chain; `treeDepth(t) - 1` is the hop count from `t` itself
	// down to its own deepest descendant.
	return { deepestFanLevel: level, maxHangDepth: treeDepth(t) - 1 };
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
	for (const root of roots) {
		const r = walk(root, 0, perRow, orgChart, undefined);
		fannedGenerations = Math.max(fannedGenerations, r.deepestFanLevel + 1);
		maxHangDepth = Math.max(maxHangDepth, r.maxHangDepth);
	}
	return { fannedGenerations, maxHangDepth };
}
