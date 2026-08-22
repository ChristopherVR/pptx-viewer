/**
 * SmartArt DiagramML interpreter - hanging hierarchy branches (`hierBranch`
 * `hang`/`l`/`r`, and the tail of `init`).
 *
 * Renders the tree as an indented list (a depth-first "outline"), one row per
 * node, rather than a fanned-out grid. `hierBranch` selects the indent
 * direction, matching PowerPoint's own "Hanging" org-chart styles:
 *
 *   - `r` ("Right Hanging"): every generation indents further to the right.
 *   - `l` ("Left Hanging"): every generation indents further to the LEFT
 *     (mirrored), so the column grows leftward instead.
 *   - `hang` ("Both"): alternates per child index at each level, so a parent's
 *     children fan out into a left column and a right column.
 *
 * `orgChart` mode places an assistant (`dgm:pt/@type="asst"`) directly below
 * its manager at the SAME x (no further indent, a short dashed stub
 * connector), then continues the indented list with the manager's ordinary
 * children. Pure geometry; no framework code, no DOM.
 */

import type { TreeNode } from './smartart-helpers';
import {
	elbowConnector,
	partitionChildren,
	pushNode,
	stubConnector,
} from './smartart-hierarchy-shared';
import type { HierContext } from './smartart-hierarchy-shared';

/** Indent direction for one hanging-branch arrangement pass. */
export type HangDirection = 'left' | 'right' | 'alternate';

export interface HangingOptions {
	orgChart: boolean;
	direction: HangDirection;
	indent: number;
	vGap: number;
}

/** Running vertical write position, shared across an entire DFS pass. */
export interface HangingCursor {
	y: number;
}

function directionFor(options: HangingOptions, childIndex: number): 'left' | 'right' {
	if (options.direction === 'alternate') {
		return childIndex % 2 === 0 ? 'right' : 'left';
	}
	return options.direction;
}

/** Place one node's assistant row: same x as the node, no further indent. */
function placeAssistants(
	hc: HierContext,
	x: number,
	parentBottom: number,
	assistants: TreeNode[],
	options: HangingOptions,
	cursor: HangingCursor,
): void {
	for (const assistant of assistants) {
		const y = cursor.y;
		cursor.y += hc.boxH + options.vGap;
		const width = hc.boxW * 0.85;
		const height = hc.boxH * 0.85;
		pushNode(hc, assistant.node, x, y, width, height);
		stubConnector(hc, assistant.node.id, x + hc.boxH / 2, parentBottom, x + width / 2, y);
	}
}

/**
 * Place `t` at `(x, cursor.y)` and recurse into its assistants (same column)
 * then its ordinary children (indented per `options.direction`).
 */
export function placeHangingTree(
	hc: HierContext,
	t: TreeNode,
	x: number,
	options: HangingOptions,
	cursor: HangingCursor,
): void {
	const y = cursor.y;
	cursor.y += hc.boxH + options.vGap;
	pushNode(hc, t.node, x, y);

	const { assistants, normal } = partitionChildren(t, options.orgChart);
	placeAssistants(hc, x, y + hc.boxH, assistants, options, cursor);

	normal.forEach((child, i) => {
		const dir = directionFor(options, i);
		const childX = dir === 'left' ? x - options.indent : x + options.indent;
		const childY = cursor.y;
		elbowConnector(
			hc,
			t.node.id,
			x + hc.boxH / 2,
			y + hc.boxH,
			childX + hc.boxH / 2,
			childY,
			child.node.id,
		);
		placeHangingTree(hc, child, childX, options, cursor);
	});
}

/**
 * Entry point for a full `hang`/`l`/`r` branch pass over a forest, starting
 * the running cursor at `startY` (an inset from the top of the box).
 */
export function placeHangingForest(
	hc: HierContext,
	roots: TreeNode[],
	startX: number,
	startY: number,
	options: HangingOptions,
): void {
	const cursor: HangingCursor = { y: startY };
	for (const root of roots) {
		placeHangingTree(hc, root, startX, options, cursor);
	}
}
