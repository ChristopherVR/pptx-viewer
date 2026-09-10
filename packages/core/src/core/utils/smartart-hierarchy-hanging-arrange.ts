/**
 * SmartArt DiagramML interpreter - `mode === 'hanging'` entry point.
 *
 * Split out of `smartart-hierarchy-hanging.ts` (the file-size budget): the
 * box-sizing/context/result wiring around `placeHangingForest`
 * (`smartart-hierarchy-hanging.ts`'s own row-placement recursion), for the
 * `linDir`-only fallback branch (no `presLayoutVars.hierBranch` at all - see
 * `smartart-layout-interpreter-hierarchy.ts`'s own module doc comment).
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
import { placeHangingForest } from './smartart-hierarchy-hanging';
import { fitHangingBox } from './smartart-hierarchy-hanging-box';
import { countHangingRows } from './smartart-hierarchy-hanging-fold';
import { baseContext } from './smartart-hierarchy-shared';
import { resolveHierarchyItemFontSizePx } from './smartart-layout-interpreter-hierarchy-fontfit';
import type { BoundingBox, SmartArtLayoutResult } from './smartart-layout-types';

const HANGING_MODE_INSET = 6;

/**
 * Full entry point for the `linDir`-only fallback `mode === 'hanging'`
 * branch - the WHOLE tree hangs, one row per node, in a single column.
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
	/**
	 * See `HangingOptions.columnAlign`'s own doc comment
	 * (`smartart-hierarchy-hanging.ts`) - `undefined` for every fixture but
	 * the declared corner-anchored construct (`arrangeHierarchy`'s own
	 * `resolveCornerHangSide`), which never engages for anything else.
	 */
	cornerSide?: 'left' | 'right',
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
	// The corner-anchored column is centred horizontally in the box (COM-
	// verified: `hierarchy-list--hier5.pptx`'s own root box centre sits at
	// the diagram's own centre, `433.35` of `866.67`), `columnWidth` px wide
	// (the root's OWN width - it is always the widest row for this
	// construct, per `resolveHierarchyGenerationTemplates`'s own
	// `widthFactor > 1` contract) - see `HangingOptions.columnAlign`'s doc
	// comment (`smartart-hierarchy-hanging.ts`) for the edge-sharing
	// placement itself.
	const columnWidth = rootSize?.w ?? boxW;
	const columnAlign =
		cornerSide !== undefined
			? {
					edgeX: cornerSide === 'right' ? w / 2 + columnWidth / 2 : w / 2 - columnWidth / 2,
					side: cornerSide,
				}
			: undefined;
	placeHangingForest(
		hc,
		roots,
		HANGING_MODE_INSET + indent,
		columnAlign ? 0 : HANGING_MODE_INSET,
		{
			orgChart,
			direction: linDirHangDirection(linDir),
			indent,
			vGap,
			foldDeeperGenerations,
			columnAlign,
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
