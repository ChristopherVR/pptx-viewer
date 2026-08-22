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
import {
	effectiveWidth,
	elbowConnector,
	partitionChildren,
	pushNode,
	stubConnector,
} from './smartart-hierarchy-shared';
import type { HierContext } from './smartart-hierarchy-shared';

/** Resolved options for one standard-branch arrangement pass. */
export interface StandardOptions {
	orgChart: boolean;
	/** Resolved `chPref`/`chMax` row size; `Infinity` when unbounded. */
	perRow: number;
	/**
	 * Present only for `hierBranch="init"`: places every generation past the
	 * root's direct children as a hanging column instead of continuing the
	 * standard fan-out.
	 */
	hangingPlacer?: (hc: HierContext, subtree: TreeNode, anchorX: number, anchorY: number) => void;
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
		placeAt(hc, child, childCx, childCy, childOffset, childW, level + 1, cellW, cellH, options);
		childOffset += childW;
	}
}

/**
 * Place one generation's ordinary children across multiple rows stacked
 * within the SAME generation's vertical band, `perRow` (`chPref`/`chMax`) per
 * row. A wrapped child's own descendants still resolve onto the normal
 * per-level grid: the virtual `xOffset` handed to its own recursion is solved
 * so `(xOffset + childW / 2) * cellW` reproduces the position already used
 * here, keeping `cellW`/`cellH` uniform for every generation past this one.
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
	const perRow = options.perRow;
	const rows = Math.ceil(normal.length / perRow);
	const rowH = cellH / rows;
	const totalW = spanW * cellW;
	const leftX = xOffset * cellW;
	for (let row = 0; row < rows; row++) {
		const rowChildren = normal.slice(row * perRow, Math.min((row + 1) * perRow, normal.length));
		const slotW = totalW / rowChildren.length;
		const rowCy = (level + 1) * cellH - cellH / 2 + row * rowH + rowH / 2 + cellH / 2;
		rowChildren.forEach((child, i) => {
			const childCx = leftX + slotW * (i + 0.5);
			const childW = effectiveWidth(child, options.orgChart);
			elbowConnector(
				hc,
				parentId,
				cx,
				cy + hc.boxH / 2,
				childCx,
				rowCy - hc.boxH / 2,
				child.node.id,
			);
			const virtualOffset = childCx / cellW - childW / 2;
			placeAt(hc, child, childCx, rowCy, virtualOffset, childW, level + 1, cellW, cellH, options);
		});
	}
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
): void {
	pushNode(hc, t.node, cx - hc.boxW / 2, cy - hc.boxH / 2);
	const { assistants, normal } = partitionChildren(t, options.orgChart);
	placeAssistantRow(hc, t.node.id, cx, cy, assistants);
	if (normal.length === 0) {
		return;
	}
	if (options.hangingPlacer && level >= 1) {
		// Space each child the same way `placeFlatChildren` would (by its
		// subtree's own effective width), but hand it to the hanging placer
		// instead of continuing the standard fan-out, so siblings' hanging
		// columns don't collide.
		let childOffset = xOffset;
		for (const child of normal) {
			const childW = effectiveWidth(child, options.orgChart);
			const anchorCx = (childOffset + childW / 2) * cellW;
			const anchorY = (level + 1) * cellH;
			elbowConnector(hc, t.node.id, cx, cy + hc.boxH / 2, anchorCx, anchorY, child.node.id);
			options.hangingPlacer(hc, child, anchorCx - hc.boxW / 2, anchorY);
			childOffset += childW;
		}
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
