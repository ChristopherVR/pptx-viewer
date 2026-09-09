/**
 * SmartArt DiagramML interpreter - "standard" hierarchy branch (`hierBranch`
 * `std`/`init`).
 *
 * The classic org-chart tree: a parent centred above its children, which fan
 * out evenly across the row below. Three behaviours `presLayoutVars` can turn
 * on, previously ignored entirely (see `smartart-layout-interpreter-hierarchy.ts`):
 *
 *   - `orgChart` (with `dgm:pt/@type="asst"` points present): assistant nodes
 *     render in a small row directly under their manager, connected with a
 *     short dashed stub, and do not consume a normal sibling's share of the
 *     row's width (`effectiveWidth`, `smartart-hierarchy-shared.ts`).
 *   - `chMax` / `chPref`: when a parent has more ordinary children than the
 *     resolved per-row size, they wrap into multiple rows stacked within the
 *     same generation's vertical band instead of stretching one row across
 *     the whole width.
 *   - `hierBranch="init"`: the ROOT's own children use this standard fan-out,
 *     but every deeper generation switches to a hanging column (delegated to
 *     `placeHangingTree` via `hangingPlacer`), matching how a real "Hierarchy"
 *     layout keeps its first level wide and its detail levels compact.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { TreeNode } from './smartart-helpers';
import { placeFannedRow, planFan } from './smartart-hierarchy-fan';
import { effectiveWidth, partitionChildren } from './smartart-hierarchy-orgchart-tree';
import {
	elbowConnector,
	HANG_HEIGHT_RATIO,
	HIER_TAIL_OFFSET_RATIO,
	pushNode,
} from './smartart-hierarchy-shared';
import type { HierContext } from './smartart-hierarchy-shared';
import type { StandardOptions } from './smartart-hierarchy-standard-options';
import {
	placeAssistantRow,
	placeFlatChildren as placeFlatChildrenImpl,
} from './smartart-hierarchy-standard-rows';
import { placeWrappedChildren as placeWrappedChildrenImpl } from './smartart-hierarchy-wrapped-groups';

export type { StandardOptions } from './smartart-hierarchy-standard-options';

/** Place one generation's ordinary children in a single row (no wrapping). */
function placeFlatChildren(
	hc: HierContext,
	parentId: string,
	normal: TreeNode[],
	cx: number,
	cy: number,
	xOffset: number,
	level: number,
	cellW: number,
	cellH: number,
	options: StandardOptions,
): void {
	placeFlatChildrenImpl(
		hc,
		parentId,
		normal,
		cx,
		cy,
		xOffset,
		level,
		cellW,
		cellH,
		options,
		placeAt,
	);
}

/**
 * Place one generation's ordinary children as `perRow` (`chPref`/`chMax`)
 * sized GROUPS, side by side: see `placeWrappedChildren`'s doc comment in
 * `smartart-hierarchy-wrapped-groups.ts` for the row-vs-column decision (moved
 * there, alongside `planWrappedGroups`, to keep this file under the
 * per-file LOC limit).
 */
function placeWrappedChildren(
	hc: HierContext,
	parentId: string,
	normal: TreeNode[],
	cx: number,
	cy: number,
	xOffset: number,
	spanW: number,
	level: number,
	cellW: number,
	cellH: number,
	options: StandardOptions,
): void {
	placeWrappedChildrenImpl(
		hc,
		parentId,
		normal,
		cx,
		cy,
		xOffset,
		spanW,
		level,
		cellW,
		cellH,
		options,
		placeAt,
	);
}

/** Render `t` at an explicit `(cx, cy)`, then its assistants and children. */
function placeAt(
	hc: HierContext,
	t: TreeNode,
	cx: number,
	cy: number,
	xOffset: number,
	spanW: number,
	level: number,
	cellW: number,
	cellH: number,
	options: StandardOptions,
	siblingCxs?: number[],
): void {
	pushNode(hc, t.node, cx - hc.boxW / 2, cy - hc.boxH / 2);
	const { assistants, normal } = partitionChildren(t, options.orgChart);
	placeAssistantRow(hc, t.node.id, cx, cy, assistants);
	if (normal.length === 0) {
		return;
	}
	// Layout definitions with no per-generation item template past the root's
	// direct children (`foldDeeperGenerations`, see its own doc comment) never
	// place a box for anything past `level 1` - the bridge's own
	// `collectFoldedDescendants` folds every unrendered descendant into `t`'s
	// text instead, matching PowerPoint's cached drawing exactly.
	if (options.foldDeeperGenerations && level >= 1) {
		return;
	}
	if (options.hangingPlacer && level >= 1) {
		const plan = planFan(normal.length, options.perRow, siblingCxs);
		if (plan) {
			placeFannedRow(hc, t, normal, plan, cx, cy, level, cellW, cellH, options, placeAt);
			return;
		}
		// `t` is a SOLO CHAIN LINK (no real siblings of its own - `siblingCxs`
		// is absent, or a length-1 array, i.e. `t` was the only entry in
		// whatever row placed it) whose OWN pre-computed fan-axis allocation
		// (`spanW`, from `effectiveWidth` - a STRUCTURAL sum of leaf-columns
		// computed before any fan/hang decision is made, treating every
		// generation as if it might fan) exactly matches its ordinary child
		// count: every child is itself effectiveWidth 1 (a leaf, or a chain of
		// single children), so the outer fan-axis pitch (`cellW`) already
		// reserved exactly enough room, UNSHARED with any sibling, for `t`'s
		// children to fan evenly across `t`'s own span the SAME way a plain
		// `std` row would. COM-verified against `organization-chart--hier8.pptx`:
		// "Branch A Child" (a lone link in a single-child chain, `spanW` equal
		// to the whole diagram's 5 leaf columns since nothing else shares the
		// fan axis) fans its 5 real children in ONE row spanning the box,
		// rather than hanging them in a narrow column.
		//
		// The "solo chain link" requirement (not just "`spanW` happens to
		// equal `normal.length`") is essential: `smartart-orgchart-
		// hierbranch.pptx`'s "Report One" (one of THREE siblings sharing the
		// Manager's row, so it has real `siblingCxs`) also has `spanW===
		// normal.length` (2 children, both leaves, `spanW=2`) but genuine
		// PowerPoint output still HANGS those 2 children with the measured
		// `HIER_TAIL_OFFSET_RATIO` indent - regressed 8 genuine-fixture
		// assertions when this fired for a shared-row node too. Sharing a row
		// with siblings (even one `planFan` already declined, e.g. too few
		// children to reach `perRow`) is a different, already-measured shape
		// from a node that never had a row to share in the first place.
		// `normal.length > 1` additionally excludes the ordinary single-child
		// hanging chain itself (`spanW===normal.length===1` for ANY lone
		// child, solo or not), which must keep hanging with its own indent,
		// not become a centred fan-of-one.
		const isSoloChainLink = !siblingCxs || siblingCxs.length === 1;
		if (isSoloChainLink && normal.length > 1 && spanW === normal.length) {
			placeFlatChildren(hc, t.node.id, normal, cx, cy, xOffset, level, cellW, cellH, options);
			return;
		}
		// All of `t`'s ordinary children stack in ONE shared hanging column
		// directly under `t` (see `StandardOptions.hangingPlacer`'s doc
		// comment), not one side-by-side column per child.
		//
		// The gap between `t`'s OWN bottom edge and the hanging tail's first
		// box is `HANG_HEIGHT_RATIO * hc.boxH`, NOT `(level + 1) * cellH`'s old
		// naive "next generation row" position: `cellH` (the FANNED row-to-row
		// pitch, `generationGapRatio`-derived) and the hang transition are
		// DIFFERENT physical gaps (see `fitItemBox`'s own doc comment on
		// `smartart-hierarchy-orientation.ts` - `HANG_HEIGHT_RATIO` is the
		// SAME ratio that function's own `maxHangDepth` term already reserves
		// room for). Using `cellH` here left ZERO gap between the last fanned
		// row and the hanging tail's first box (COM-verified regression:
		// `organization-chart--hier5.pptx`'s own first hanging box rendered
		// flush against its parent's bottom edge, 7.69% short of the cached
		// position).
		const anchorY = cy + hc.boxH / 2 + HANG_HEIGHT_RATIO * hc.boxH;
		const columnOffset = hc.boxW * HIER_TAIL_OFFSET_RATIO;
		for (const child of normal) {
			elbowConnector(
				hc,
				t.node.id,
				cx,
				cy + hc.boxH / 2,
				cx + columnOffset,
				anchorY,
				child.node.id,
			);
		}
		options.hangingPlacer(hc, normal, cx - hc.boxW / 2 + columnOffset, anchorY);
		return;
	}
	if (Number.isFinite(options.perRow) && normal.length > options.perRow) {
		placeWrappedChildren(
			hc,
			t.node.id,
			normal,
			cx,
			cy,
			xOffset,
			spanW,
			level,
			cellW,
			cellH,
			options,
		);
	} else {
		placeFlatChildren(hc, t.node.id, normal, cx, cy, xOffset, level, cellW, cellH, options);
	}
}

/**
 * Place a whole standard-branch tree rooted at `t`, whose own slot spans
 * `[xOffset, xOffset + effectiveWidth(t))` cells at `level`.
 */
export function placeStandardTree(
	hc: HierContext,
	t: TreeNode,
	xOffset: number,
	level: number,
	cellW: number,
	cellH: number,
	options: StandardOptions,
): void {
	const spanW = effectiveWidth(t, options.orgChart);
	const cx = (xOffset + spanW / 2) * cellW;
	const cy = level * cellH + cellH / 2;
	placeAt(hc, t, cx, cy, xOffset, spanW, level, cellW, cellH, options);
}
