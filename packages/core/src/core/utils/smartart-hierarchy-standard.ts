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
import {
	effectiveWidth,
	elbowConnector,
	HIER_TAIL_OFFSET_RATIO,
	partitionChildren,
	pushNode,
	stubConnector,
} from './smartart-hierarchy-shared';
import type { HierContext } from './smartart-hierarchy-shared';
import { placeWrappedChildren as placeWrappedChildrenImpl } from './smartart-hierarchy-wrapped-groups';

/** Resolved options for one standard-branch arrangement pass. */
export interface StandardOptions {
	orgChart: boolean;
	/** Resolved `chPref`/`chMax` row size; `Infinity` when unbounded. */
	perRow: number;
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
}

const ASSISTANT_GAP = 4;

/** Render a manager's assistant row directly beneath it (`orgChart` mode). */
function placeAssistantRow(
	hc: HierContext,
	parentId: string,
	cx: number,
	cy: number,
	assistants: TreeNode[],
): void {
	if (assistants.length === 0) {
		return;
	}
	const assistW = hc.boxW * 0.55;
	const assistH = hc.boxH * 0.7;
	const totalW = assistants.length * assistW + (assistants.length - 1) * ASSISTANT_GAP;
	const rowY = cy + hc.boxH / 2 + ASSISTANT_GAP;
	let x = cx - totalW / 2;
	for (const assistant of assistants) {
		pushNode(hc, assistant.node, x, rowY, assistW, assistH);
		stubConnector(hc, parentId, cx, cy + hc.boxH / 2, x + assistW / 2, rowY);
		x += assistW + ASSISTANT_GAP;
	}
}

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
	// Precomputed up front (not just incrementally in the loop below) so every
	// child in this row can be handed the FULL sibling column list: see
	// `planFan`'s doc comment on why a "chPref-reached" grandchild needs its
	// own generation's complete x-center array, not just its own position.
	const siblingCxs: number[] = [];
	{
		let offset = xOffset;
		for (const child of normal) {
			const childW = effectiveWidth(child, options.orgChart);
			siblingCxs.push((offset + childW / 2) * cellW);
			offset += childW;
		}
	}
	let childOffset = xOffset;
	for (const child of normal) {
		const childW = effectiveWidth(child, options.orgChart);
		const childCx = (childOffset + childW / 2) * cellW;
		const childCy = (level + 1) * cellH + cellH / 2;
		elbowConnector(
			hc,
			parentId,
			cx,
			cy + hc.boxH / 2,
			childCx,
			childCy - hc.boxH / 2,
			child.node.id,
		);
		placeAt(
			hc,
			child,
			childCx,
			childCy,
			childOffset,
			childW,
			level + 1,
			cellW,
			cellH,
			options,
			siblingCxs,
		);
		childOffset += childW;
	}
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
	if (options.hangingPlacer && level >= 1) {
		const plan = planFan(normal.length, options.perRow, siblingCxs);
		if (plan) {
			placeFannedRow(hc, t, normal, plan, cx, cy, level, cellW, cellH, options, placeAt);
			return;
		}
		// All of `t`'s ordinary children stack in ONE shared hanging column
		// directly under `t` (see `StandardOptions.hangingPlacer`'s doc
		// comment), not one side-by-side column per child.
		const anchorY = (level + 1) * cellH;
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
