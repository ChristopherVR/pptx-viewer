/**
 * SmartArt DiagramML interpreter - the declared "fanned root row, N
 * independent per-branch hanging columns" hierarchy arrangement.
 *
 * `square-accent-list--{flat3,hier5,hier8}.pptx` (all three genuine COM
 * samples) declare a FOREST, not a single tree: the layout's own top-level
 * algorithm (`hierChild`, `linDir="fromL"/"fromR"`) fans one `hierRoot`
 * instance PER TOP-LEVEL DATA NODE (`dgm:forEach axis="ch"` over the whole
 * data model's own top-level points - `buildTree`
 * (`smartart-helpers.ts`) already builds this correctly as a multi-root
 * forest for ANY data model shaped this way), and each `hierRoot` instance
 * nests its OWN `hierChild` (`linDir="fromT"`) hanging its OWN descendants
 * in a column directly below it. `resolveCornerHangPlan`'s existing
 * 3-condition gate (`hierAlign="tL"/"tR"` + a vertical nested `linDir` + a
 * genuine root-vs-descendant size split) correctly detects this SHAPE OF
 * CONSTRUCT, but the pre-existing `arrangeFullyHangingTree` renderer it
 * used to dispatch to assumes exactly ONE tree in ONE shared column - wrong
 * for a forest of `roots.length > 1` (measured regression when tried:
 * `square-accent-list--hier5.pptx` `0.3227` -> `0.7298`, see
 * `smartart-track-r-successor.md` SESSION 39's own item 1). This module is
 * the renderer for the `roots.length > 1` case specifically -
 * `smartart-hierarchy-hang-dispatch.ts` still uses `arrangeFullyHangingTree`
 * unchanged whenever `roots.length <= 1` (`hierarchy-list`'s own
 * single-tree shape, unaffected by this module).
 *
 * ## Geometry (COM-verified against all three square-accent-list samples,
 *    box `867x533` in all three) - see `smartart-hierarchy-fanned-hang-
 *    geometry.ts` for the full derivation, split out for the file-size
 *    budget:
 *
 * ```
 * rootW = box.width / (N + (N - 1) * sibSpRatio)   // measured 279 vs 279.68 computed
 * gap   = sibSpRatio * rootW                        // measured ~14 vs 14 computed
 * rootH = rootW / rootAspect                        // measured 59 vs 59.12 computed
 * descH = rootH / heightFactor                      // reliable, resolveHierarchyGenerationTemplates
 * descW = descWidthFraction * rootW                 // resolveConstraint on the descendant's own name
 * ```
 *
 * Vertical spacing: the root-to-first-descendant gap is much larger than
 * any deeper descendant-to-descendant gap (COM-verified IDENTICAL in both
 * `hier5` and `hier8`, independent of branch depth: `47px` vs `~0px`, at
 * this construct's own `533px`-tall box) - modelled as two ratios of the
 * descendant row's own height, `ROOT_CHILD_GAP_RATIO` (root-to-first-child,
 * `~0.98`) and `DESCENDANT_STACK_GAP_RATIO` (every deeper hop, `0` - rows
 * stack flush). Both are genuine-fixture-measured constants, matching this
 * arranger's own existing convention for similar spacing ratios elsewhere
 * (`HIER_TAIL_OFFSET_RATIO`, `FAN_MARGIN_RATIO`).
 *
 * Horizontal alignment within a branch: every descendant row (any
 * generation) shares ONE edge with its OWN branch's root box - COM-verified
 * `side='right'` for `chAlign="r"` (square-accent-list's own declared
 * value). `side='left'` for `chAlign="l"` is the mirrored, symmetric
 * assumption - not itself corpus-verified (only one `chAlign` value sampled
 * so far), kept as a SEPARATE mapping from `smartart-hierarchy-hanging.ts`'s
 * own `HangingOptions.columnAlign` doc comment (`chAlign="l"` -> `'right'`
 * there, for the UNRELATED single-tree `hierarchy-list` construct): the two
 * are independently COM-derived from different fixtures, and the codebase
 * has only one genuine sample of each so far.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtLayoutNodeShape,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtStyle,
} from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { TreeNode } from './smartart-helpers';
import { resolveFannedHangGeometry } from './smartart-hierarchy-fanned-hang-geometry';
import { baseContext, elbowConnector, pushNode } from './smartart-hierarchy-shared';
import type { HierContext } from './smartart-hierarchy-shared';
import { resolveHierarchyItemFontSizePx } from './smartart-layout-interpreter-hierarchy-fontfit';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';

/** Root-to-first-descendant gap, as a multiple of the descendant row's own height - see the module doc comment. */
const ROOT_CHILD_GAP_RATIO = 0.98;
/** Gap between every deeper descendant generation within one branch - see the module doc comment. */
const DESCENDANT_STACK_GAP_RATIO = 0;

/** Recursively place one branch's own descendant chain in its fixed column. */
function placeDescendantColumn(
	hc: HierContext,
	node: TreeNode,
	edgeX: number,
	side: 'left' | 'right',
	y: number,
	descW: number,
	descH: number,
	stackGapPx: number,
	parentId: string,
	parentCenterX: number,
	parentBottom: number,
): number {
	const x = side === 'right' ? edgeX - descW : edgeX;
	pushNode(hc, node.node, x, y, descW, descH);
	elbowConnector(hc, parentId, parentCenterX, parentBottom, x + descW / 2, y, node.node.id);
	let nextY = y + descH + stackGapPx;
	for (const child of node.children) {
		nextY = placeDescendantColumn(
			hc,
			child,
			edgeX,
			side,
			nextY,
			descW,
			descH,
			stackGapPx,
			node.node.id,
			x + descW / 2,
			y + descH,
		);
	}
	return nextY;
}

/**
 * Full entry point for the fanned-root-row/per-branch-hanging-columns
 * construct - see the module doc comment. `undefined` when the geometry
 * does not resolve (the caller falls back to `arrangeFullyHangingTree`).
 */
export function arrangeFannedHangingForest(
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
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	orgChart: boolean,
): SmartArtLayoutResult | undefined {
	// Assistant partitioning (`dgm:pt/@type="asst"`) is not modelled for this
	// construct yet (no corpus fixture combines it with a fanned-root-row
	// forest) - fall back to `arrangeFullyHangingTree`'s own pre-existing
	// (imperfect, but non-empty) org-chart handling rather than silently
	// dropping assistants from this renderer.
	if (orgChart) {
		return undefined;
	}
	const geometry = resolveFannedHangGeometry(
		algorithmNode,
		index,
		nodes.length,
		presLayoutVars,
		roots.length,
		box,
	);
	if (!geometry) {
		return undefined;
	}
	const { rootW, rootH, descW, descH, gap, side, reversed } = geometry;
	const hc = baseContext(
		nodes.length,
		elementId,
		palette,
		style,
		descW,
		descH,
		connectorLabels,
		itemShape,
		resolveHierarchyItemFontSizePx(nodes, algorithmNode, index, descW, descH, fontName),
	);
	const rootChildGap = ROOT_CHILD_GAP_RATIO * descH;
	const branchCount = roots.length;
	roots.forEach((root, i) => {
		const columnIndex = reversed ? branchCount - 1 - i : i;
		const branchX = columnIndex * (rootW + gap);
		pushNode(hc, root.node, branchX, 0, rootW, rootH);
		const edgeX = side === 'right' ? branchX + rootW : branchX;
		let y = rootH + rootChildGap;
		for (const child of root.children) {
			y = placeDescendantColumn(
				hc,
				child,
				edgeX,
				side,
				y,
				descW,
				descH,
				DESCENDANT_STACK_GAP_RATIO * descH,
				root.node.id,
				branchX + rootW / 2,
				rootH,
			);
		}
	});
	return {
		nodes: hc.nodes,
		connectors: hc.connectors,
		shadowFilter: hc.ctx.shadow,
		viewBox: `0 0 ${box.width} ${box.height}`,
		family: 'hierarchy',
	};
}
