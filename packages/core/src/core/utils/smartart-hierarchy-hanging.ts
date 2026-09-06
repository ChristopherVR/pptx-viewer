/**
 * SmartArt DiagramML interpreter - hanging hierarchy branches (`hierBranch`
 * `hang`/`l`/`r`, and the tail of `init`).
 *
 * Renders the tree as an indented list (a depth-first "outline"), one row per
 * node, rather than a fanned-out grid.
 *
 * `hierBranch`'s "Left"/"Right"/"Both Hanging" naming suggests the indent
 * direction should differ (mirror for `l`, alternate per child for `hang`),
 * but genuine PowerPoint output measured directly refutes that for the box
 * offset itself: every sampled variant (`std`/`init`/`l`/`r`/`hang`, at both
 * the second AND third generation - see the doc comment on
 * `HIER_TAIL_OFFSET_RATIO` in `smartart-hierarchy-shared.ts`) hangs the SAME
 * direction, and multiple ordinary children of one node always share ONE
 * column rather than alternating sides. `hierBranch`'s actual visual
 * difference between these variants lies elsewhere (their effect on the
 * manager-level `hierAlign` centering, which this interpreter does not model)
 * , not in this offset's direction or in per-sibling alternation. `direction`
 * therefore only varies here for the unrelated `linDir`-only fallback (no
 * `presLayoutVars.hierBranch` at all - see `smartart-layout-interpreter-hierarchy.ts`),
 * which has no genuine-fixture measurement to contradict it.
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
export type HangDirection = 'left' | 'right';

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
 * then its ordinary children.
 *
 * ALL of `t`'s own ordinary children share ONE column at a single indented x
 * (`options.direction`, resolved once per parent, not per child): measured
 * against `smartart-orgchart-nested-hang.pptx` in the corpus, a node with two
 * ordinary children hangs them in one shared column even under `hierBranch`
 * "hang" ("Both Hanging"), the value whose name most suggests per-child
 * alternation - see the module doc comment.
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

	if (normal.length === 0) {
		return;
	}
	const childX = options.direction === 'left' ? x - options.indent : x + options.indent;
	for (const child of normal) {
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
	}
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
