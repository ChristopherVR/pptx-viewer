/**
 * SmartArt DiagramML interpreter - hierarchy (`hierRoot` / `hierChild`) arranger.
 *
 * Arranges the data-model node tree as an org-chart / hierarchy, consulting
 * `presLayoutVars` (`dgm:presLayoutVars`/`dgm:varLst`) for every hint it
 * carries:
 *
 *   - `hierBranch` (`std`/`init`/`hang`/`l`/`r`): each value now produces a
 *     genuinely distinct arrangement - see `smartart-hierarchy-standard.ts`
 *     (`std`/`init`) and `smartart-hierarchy-hanging.ts` (`hang`/`l`/`r`, and
 *     `init`'s tail past the root's own children).
 *   - `orgChart`: when set, `dgm:pt/@type="asst"` assistant nodes render in a
 *     dedicated row/slot next to their manager instead of fanning out as an
 *     ordinary subordinate.
 *   - `chMax`/`chPref`: bound and hint how many ordinary children share one
 *     row before wrapping to the next (standard branch only; a hanging column
 *     has no "row" to wrap).
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { PptxSmartArtNode, PptxSmartArtPresLayoutVars, SmartArtStyle } from '../types';
import { buildTree, treeDepth } from './smartart-helpers';
import { placeHangingForest, placeHangingTree } from './smartart-hierarchy-hanging';
import type { HangDirection, HangingCursor } from './smartart-hierarchy-hanging';
import { baseContext, effectiveWidth } from './smartart-hierarchy-shared';
import { placeStandardTree } from './smartart-hierarchy-standard';
import type { StandardOptions } from './smartart-hierarchy-standard';
import type {
	BoundingBox,
	RenderedConnector,
	RenderedNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

const INSET = 6;
/** Hanging direction used for `init`'s post-root-level generations. */
const INIT_TAIL_DIRECTION: HangDirection = 'right';

type BranchMode = 'std' | 'init' | 'hanging';

function branchMode(presLayoutVars: PptxSmartArtPresLayoutVars | undefined): BranchMode {
	const branch = presLayoutVars?.hierarchyBranch;
	if (branch === 'l' || branch === 'r' || branch === 'hang') {
		return 'hanging';
	}
	if (branch === 'init') {
		return 'init';
	}
	return 'std';
}

function hangDirection(presLayoutVars: PptxSmartArtPresLayoutVars | undefined): HangDirection {
	switch (presLayoutVars?.hierarchyBranch) {
		case 'l':
			return 'left';
		case 'hang':
			return 'alternate';
		default:
			return 'right';
	}
}

/** Resolve `chPref`/`chMax` into one per-row size (`Infinity` = unbounded). */
function resolveRowSize(presLayoutVars: PptxSmartArtPresLayoutVars | undefined): number {
	const pref = presLayoutVars?.childPreferred;
	if (typeof pref === 'number' && pref > 0) {
		return pref;
	}
	const max = presLayoutVars?.childMax;
	if (typeof max === 'number' && max > 0) {
		return max;
	}
	return Number.POSITIVE_INFINITY;
}

/** Execute the hierarchy algorithm over the data-model node tree. */
export function arrangeHierarchy(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const roots = buildTree(nodes);
	const orgChart = presLayoutVars?.orgChart === true;
	const mode = branchMode(presLayoutVars);

	if (mode === 'hanging') {
		const boxW = Math.min(w * 0.42, 160);
		const boxH = Math.min(h * 0.16, 30);
		const indent = boxW * 0.35;
		const vGap = boxH * 0.55;
		const hc = baseContext(nodes.length, elementId, palette, style, boxW, boxH);
		placeHangingForest(hc, roots, INSET + indent, INSET, {
			orgChart,
			direction: hangDirection(presLayoutVars),
			indent,
			vGap,
		});
		return finish(hc.nodes, hc.connectors, hc.ctx.shadow, w, h);
	}

	const totalLeaves = roots.reduce((sum, r) => sum + effectiveWidth(r, orgChart), 0);
	const depth = roots.length > 0 ? Math.max(...roots.map((r) => treeDepth(r))) : 1;
	const cellW = w / Math.max(1, totalLeaves);
	const cellH = h / Math.max(1, depth);
	const boxW = Math.min(cellW * 0.8, 150);
	const boxH = Math.min(cellH * 0.4, 40);
	const hc = baseContext(nodes.length, elementId, palette, style, boxW, boxH);

	const standardOptions: StandardOptions = { orgChart, perRow: resolveRowSize(presLayoutVars) };
	if (mode === 'init') {
		const indent = boxW * 0.35;
		const vGap = boxH * 0.55;
		standardOptions.hangingPlacer = (childHc, subtree, anchorX, anchorY) => {
			const cursor: HangingCursor = { y: anchorY };
			placeHangingTree(
				childHc,
				subtree,
				anchorX,
				{
					orgChart,
					direction: INIT_TAIL_DIRECTION,
					indent,
					vGap,
				},
				cursor,
			);
		};
	}

	let offset = 0;
	for (const root of roots) {
		placeStandardTree(hc, root, offset, 0, cellW, cellH, standardOptions);
		offset += effectiveWidth(root, orgChart);
	}
	return finish(hc.nodes, hc.connectors, hc.ctx.shadow, w, h);
}

function finish(
	nodes: RenderedNode[],
	connectors: RenderedConnector[],
	shadowFilter: string | undefined,
	w: number,
	h: number,
): SmartArtLayoutResult {
	return { nodes, connectors, shadowFilter, viewBox: `0 0 ${w} ${h}`, family: 'hierarchy' };
}
