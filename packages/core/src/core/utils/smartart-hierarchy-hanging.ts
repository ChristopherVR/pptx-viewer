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

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtLayoutNodeShape,
	PptxSmartArtNode,
	SmartArtStyle,
} from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { TreeNode } from './smartart-helpers';
import { linDirHangDirection } from './smartart-hierarchy-branch-mode';
import { hierarchyLeafFoldsDescendants } from './smartart-hierarchy-fold-depth';
import { fitHangingBox } from './smartart-hierarchy-hanging-box';
import { countHangingRows } from './smartart-hierarchy-hanging-fold';
import { partitionChildren } from './smartart-hierarchy-orgchart-tree';
import { baseContext, elbowConnector, pushNode, stubConnector } from './smartart-hierarchy-shared';
import type { HierContext } from './smartart-hierarchy-shared';
import { resolveHierarchyItemFontSizePx } from './smartart-layout-interpreter-hierarchy-fontfit';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';

/** Indent direction for one hanging-branch arrangement pass. */
export type HangDirection = 'left' | 'right';

export interface HangingOptions {
	orgChart: boolean;
	direction: HangDirection;
	indent: number;
	vGap: number;
	/**
	 * See `smartart-hierarchy-hanging-fold.ts`'s own module doc comment: stops
	 * `placeHangingTree` recursing past a node's own direct children when set.
	 * `undefined`/`false` for every existing caller (the `tailed` family's own
	 * hanging tail via `smartart-hierarchy-tailed-placer.ts`'s
	 * `configureTailedHangingPlacer` never sets this) - behaviour-preserving
	 * there.
	 */
	foldDeeperGenerations?: boolean;
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
 *
 * `size` (optional): an explicit box size for THIS call only, used by
 * `placeHangingForest`'s own top-level (forest-root) call when the layout
 * declares a distinctly-sized root template (`smartart-hierarchy-generation-
 * templates.ts` / `smartart-hierarchy-hanging-box.ts`) - `undefined` for
 * every recursive descendant call, which keeps using `hc.boxW`/`hc.boxH` as
 * before.
 *
 * `level` (default `0`, the forest root): mirrors `smartart-hierarchy-
 * standard.ts`'s `placeAt` - once `options.foldDeeperGenerations` is set,
 * a node reached at `level >= 1` still gets its own row, but its ordinary
 * children do not; `smartart-interpreter-drawing-bridge.ts`'s own
 * `collectFoldedDescendants` folds them into this node's text instead, the
 * SAME mechanism the `std`/`tailed` branches already rely on. See
 * `smartart-hierarchy-hanging-fold.ts` for the matching row-COUNT function
 * `fitHangingBox`'s caller uses to size these rows before this function
 * places them.
 */
export function placeHangingTree(
	hc: HierContext,
	t: TreeNode,
	x: number,
	options: HangingOptions,
	cursor: HangingCursor,
	size?: { w: number; h: number },
	level = 0,
): void {
	const y = cursor.y;
	const boxW = size?.w ?? hc.boxW;
	const boxH = size?.h ?? hc.boxH;
	cursor.y += boxH + options.vGap;
	pushNode(hc, t.node, x, y, boxW, boxH);

	const { assistants, normal } = partitionChildren(t, options.orgChart);
	placeAssistants(hc, x, y + boxH, assistants, options, cursor);

	if (normal.length === 0) {
		return;
	}
	if (options.foldDeeperGenerations && level >= 1) {
		return;
	}
	const childX = options.direction === 'left' ? x - options.indent : x + options.indent;
	for (const child of normal) {
		const childY = cursor.y;
		elbowConnector(
			hc,
			t.node.id,
			x + boxH / 2,
			y + boxH,
			childX + hc.boxH / 2,
			childY,
			child.node.id,
		);
		placeHangingTree(hc, child, childX, options, cursor, undefined, level + 1);
	}
}

/**
 * Entry point for a full `hang`/`l`/`r` branch pass over a forest, starting
 * the running cursor at `startY` (an inset from the top of the box).
 *
 * `rootSize` (optional): passed through to EVERY top-level root's own
 * `placeHangingTree` call (not to any recursive child call) - see that
 * function's own doc comment.
 */
export function placeHangingForest(
	hc: HierContext,
	roots: TreeNode[],
	startX: number,
	startY: number,
	options: HangingOptions,
	rootSize?: { w: number; h: number },
): void {
	const cursor: HangingCursor = { y: startY };
	for (const root of roots) {
		placeHangingTree(hc, root, startX, options, cursor, rootSize);
	}
}

const HANGING_MODE_INSET = 6;

/**
 * Full entry point for the `linDir`-only fallback `mode === 'hanging'`
 * branch (no `presLayoutVars.hierBranch` at all, the WHOLE tree hangs - see
 * `smartart-layout-interpreter-hierarchy.ts`'s own module doc comment). Split
 * out of that module (the file-size budget): the box-sizing/context/result
 * wiring around `placeHangingForest`, unchanged, just relocated.
 */
export function arrangeFullyHangingTree(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	roots: TreeNode[],
	itemShape: PptxSmartArtLayoutNodeShape | undefined,
	connectorLabels: Map<string, string> | undefined,
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
	fontName: string | undefined,
	linDir: string | undefined,
	orgChart: boolean,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	// See `smartart-hierarchy-fold-depth.ts`'s own module doc comment: a
	// layoutDef with no per-generation item template past the root's direct
	// children folds every deeper descendant into its nearest rendered
	// ancestor's text, the SAME signal the `std`/`tailed` branches already
	// consult (`smartart-layout-interpreter-hierarchy.ts`'s own
	// `standardOptions.foldDeeperGenerations`).
	const foldDeeperGenerations = algorithmNode
		? hierarchyLeafFoldsDescendants(algorithmNode)
		: false;
	// See `smartart-hierarchy-hanging-box.ts`'s own doc comment: `boxW`/`boxH`
	// (the descendant row's own size) and `vGap` (the declared row gap) are
	// fit to `box` from the layout's own declared constraints where possible,
	// falling back to the pre-existing ad-hoc ratios otherwise. `rows`: the
	// ACTUAL rendered row count (`countHangingRows`, see its own doc comment)
	// - one per data node only when nothing folds; with `foldDeeperGenerations`
	// set, a folded descendant contributes no row of its own.
	const rows = countHangingRows(roots, orgChart, foldDeeperGenerations);
	const fit = fitHangingBox(algorithmNode, index, w, h, rows);
	const { boxW, boxH, vGap } = fit;
	const indent = boxW * 0.35;
	const hc = baseContext(
		nodes.length,
		elementId,
		palette,
		style,
		boxW,
		boxH,
		connectorLabels,
		itemShape,
		resolveHierarchyItemFontSizePx(nodes, algorithmNode, index, boxW, boxH, fontName),
	);
	const rootSize =
		fit.rootBoxW !== undefined && fit.rootBoxH !== undefined
			? { w: fit.rootBoxW, h: fit.rootBoxH }
			: undefined;
	placeHangingForest(
		hc,
		roots,
		HANGING_MODE_INSET + indent,
		HANGING_MODE_INSET,
		{
			orgChart,
			direction: linDirHangDirection(linDir),
			indent,
			vGap,
			foldDeeperGenerations,
		},
		rootSize,
	);
	return {
		nodes: hc.nodes,
		connectors: hc.connectors,
		shadowFilter: hc.ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'hierarchy',
	};
}
