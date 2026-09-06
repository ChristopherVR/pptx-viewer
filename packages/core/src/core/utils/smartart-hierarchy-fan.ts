import type { TreeNode } from './smartart-helpers';
import { elbowConnector, HIER_TAIL_OFFSET_RATIO } from './smartart-hierarchy-shared';
import type { HierContext } from './smartart-hierarchy-shared';

/**
 * SmartArt DiagramML interpreter - "chPref-reached fan" for a hanging
 * generation (`hierBranch` `init`/`hang`/`l`/`r`, generation 2+).
 *
 * `placeHangingTree` (see its doc comment in `smartart-hierarchy-hanging.ts`)
 * stacks a node's ordinary children in one narrow indented column. Genuine
 * PowerPoint output refutes that for one specific, common shape: measured
 * against `smartart-orgchart-nested-hang.pptx` in the corpus (both slides,
 * Standard AND Both Hanging), when
 *
 *   1. the node itself is one of exactly `chPref` siblings under its OWN
 *      parent (here: Report A/Report B/Report C, three direct reports under
 *      the CEO, `chPref=3`), AND
 *   2. that node's own ordinary child count also reaches `chPref` (Report
 *      B's three children: Team 1/2/3),
 *
 * PowerPoint does not hang the children in a column under Report B at all: it
 * fans Team 1/2/3 across the SAME three x-columns Report A/Report B/Report C
 * already occupy, one generation lower (Team 1 lands under Report A's own
 * column, Team 2 under Report B's, Team 3 under Report C's), and the two
 * excess children beyond a `chPref`-sized cascade (Team 4/Team 5, added past
 * `chPref` via `SmartArtNode.AddNode()`) are not part of this row at all: the
 * `README.md` fixture note documents that PowerPoint's own layoutDef has no
 * further "hierChild group" slot template past generation 1, so `AddNode()`
 * itself relinks those calls as children of the 3rd fanned node (Team 1) in
 * the raw `dgm:pt` tree; the interpreter never needs to invent an overflow
 * placement because the data model has already done it (`Team 1 -> Team 4`,
 * `Team 1 -> Team 5` are genuine `dgm:cxn` edges, confirmed by inspecting
 * `data1.xml` directly), and the existing hanging-column recursion places
 * them correctly once Team 1 itself sits in the right column.
 *
 * This module is the pure decision half: given a candidate node's own child
 * count, the layout's resolved `chPref`/`chMax` row size, and the x-centers
 * already computed for the node's OWN sibling row (when the caller is a plain
 * fanned row - see `placeFlatChildren` in `smartart-hierarchy-standard.ts`),
 * decide whether the fan applies and, if so, which columns to reuse.
 *
 * A parent generation that is NOT exactly `chPref`-wide (a manager with 2 or
 * 4 direct reports, one of which has exactly `chPref` children of its own)
 * measures a materially different, position-dependent shape: an edge report
 * fanning its own children can extend the column grid outward by one step
 * rather than reusing its farthest sibling's column, and a report whose own
 * generation already overflowed `chPref` (a 4th sibling redirected into the
 * tree, same "no deeper slot template" mechanism as above) does not fan its
 * children at all. That variant was measured against a scratch, non-corpus
 * COM fixture (not checked in: the column-extension direction is not pinned
 * to a single rule from one sample) and is intentionally NOT modelled here;
 * see `docs/guide/limitations.md`'s "SmartArt layout" row for the honest
 * residual. `siblingCxs` being `undefined`, or not exactly `chPref` long,
 * therefore always falls back to the narrow hanging column.
 */

/** What to do with one hanging node's ordinary children once fanning applies. */
export interface FanPlan {
	/** x-center for each of the first `columns.length` children, reused verbatim from the parent generation's own row. */
	columns: number[];
	/** Count of remaining children (if any) past `columns.length` still needing the ordinary narrow-hang treatment. Genuine PowerPoint org-chart data never populates this (see the module doc comment); kept only so a hand-authored layoutDef cannot silently lose nodes. */
	overflow: number;
}

/**
 * Decide whether a hanging node's `childCount` ordinary children should fan
 * across its own parent generation's grid instead of forming a narrow
 * hanging column.
 *
 * @param siblingCxs - x-centers of the node's OWN generation (itself and its
 *   siblings), in left-to-right order, as already placed by
 *   `placeFlatChildren`. `undefined` when the caller cannot supply this (the
 *   node's generation was placed by `placeWrappedChildren`, or is the tree
 *   root), which always disables the fan.
 */
export function planFan(
	childCount: number,
	perRow: number,
	siblingCxs: number[] | undefined,
): FanPlan | undefined {
	if (
		!siblingCxs ||
		siblingCxs.length === 0 ||
		!Number.isFinite(perRow) ||
		siblingCxs.length !== perRow ||
		childCount < perRow
	) {
		return undefined;
	}
	return { columns: siblingCxs, overflow: childCount - siblingCxs.length };
}

/** The `hangingPlacer` slot every fan-eligible options object carries. */
export interface HangingPlacerOptions {
	hangingPlacer?: (hc: HierContext, subtrees: TreeNode[], anchorX: number, anchorY: number) => void;
}

/**
 * Shape of `smartart-hierarchy-standard.ts`'s own `placeAt`, injected rather
 * than imported: `placeAt`'s options type (`StandardOptions`) is declared in
 * that file, and this module is imported BY it, so taking a callback avoids a
 * value-level import cycle between the two.
 */
export type PlaceAtFn<TOptions> = (
	hc: HierContext,
	t: TreeNode,
	cx: number,
	cy: number,
	xOffset: number,
	spanW: number,
	level: number,
	cellW: number,
	cellH: number,
	options: TOptions,
) => void;

/**
 * Fan `t`'s first `plan.columns.length` ordinary children across `t`'s OWN
 * parent-generation columns, one generation below `t`; each fanned child
 * recurses through `placeAtFn` itself (called WITHOUT sibling columns of its
 * own: a fan does not cascade a second level deep without its own
 * genuine-fixture measurement - see the module doc comment), so a fanned
 * child's own descendants still resolve via the ordinary narrow-hang path.
 * Any children past `plan.columns` (never populated by genuine PowerPoint
 * org-chart data - see `planFan`'s doc comment) fall back to the ordinary
 * hanging column, anchored under the first fanned column so nothing is
 * silently dropped.
 */
export function placeFannedRow<TOptions extends HangingPlacerOptions>(
	hc: HierContext,
	t: TreeNode,
	normal: TreeNode[],
	plan: FanPlan,
	cx: number,
	cy: number,
	level: number,
	cellW: number,
	cellH: number,
	options: TOptions,
	placeAtFn: PlaceAtFn<TOptions>,
): void {
	const fanCy = (level + 1) * cellH + cellH / 2;
	const fanned = normal.slice(0, plan.columns.length);
	for (let i = 0; i < fanned.length; i++) {
		const child = fanned[i];
		const childCx = plan.columns[i];
		elbowConnector(
			hc,
			t.node.id,
			cx,
			cy + hc.boxH / 2,
			childCx,
			fanCy - hc.boxH / 2,
			child.node.id,
		);
		placeAtFn(hc, child, childCx, fanCy, 0, 1, level + 1, cellW, cellH, options);
	}
	if (plan.overflow <= 0 || !options.hangingPlacer) {
		return;
	}
	const remainder = normal.slice(plan.columns.length);
	const columnOffset = hc.boxW * HIER_TAIL_OFFSET_RATIO;
	const anchorX = plan.columns[0] - hc.boxW / 2 + columnOffset;
	const anchorY = (level + 2) * cellH;
	for (const child of remainder) {
		elbowConnector(
			hc,
			t.node.id,
			cx,
			cy + hc.boxH / 2,
			anchorX + hc.boxH / 2,
			anchorY,
			child.node.id,
		);
	}
	options.hangingPlacer(hc, remainder, anchorX, anchorY);
}
