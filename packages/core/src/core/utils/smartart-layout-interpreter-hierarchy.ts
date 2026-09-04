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
 * When `presLayoutVars.hierBranch` is ABSENT (a hand-authored/non-Office
 * layoutDef that never sets it), orientation falls back to the algorithm's
 * OWN `linDir` param (`dgm:alg[@type=hierChild]/dgm:param[@type=linDir]`),
 * per base ECMA-376 - `fromL`/`fromR` select a hanging tree growing away from
 * that edge, matching `hierBranch="r"`/`"l"`. `fromT` (top-down, the default)
 * needs no fallback: it already IS the standard branch's own layout.
 * `fromB` (bottom-up) and `secLinDir`/`chAlign` are not modelled - they would
 * need restructuring `placeStandardTree`'s row layout to flip vertically /
 * control cross-axis alignment, out of scope for this fallback (Office-authored
 * layouts always set `presLayoutVars`, so this only affects non-Office content).
 *
 * Pure geometry; no framework code, no DOM.
 */

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtStyle,
} from '../types';
import { buildTree, treeDepth } from './smartart-helpers';
import { placeHangingForest, placeHangingTree } from './smartart-hierarchy-hanging';
import type { HangDirection, HangingCursor } from './smartart-hierarchy-hanging';
import { baseContext, effectiveWidth } from './smartart-hierarchy-shared';
import { placeStandardTree } from './smartart-hierarchy-standard';
import type { StandardOptions } from './smartart-hierarchy-standard';
import { algorithmParam } from './smartart-layout-interpreter-model';
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

/** `linDir` values that select a hanging tree when `hierBranch` is absent. */
function isHangingLinDir(linDir: string | undefined): boolean {
	return linDir === 'fromL' || linDir === 'fromR';
}

function branchMode(
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	linDir: string | undefined,
): BranchMode {
	const branch = presLayoutVars?.hierarchyBranch;
	if (branch === 'l' || branch === 'r' || branch === 'hang') {
		return 'hanging';
	}
	if (branch === 'init') {
		return 'init';
	}
	if (branch === undefined && isHangingLinDir(linDir)) {
		return 'hanging';
	}
	return 'std';
}

function hangDirection(
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	linDir: string | undefined,
): HangDirection {
	switch (presLayoutVars?.hierarchyBranch) {
		case 'l':
			return 'left';
		case 'hang':
			return 'alternate';
		case 'r':
			return 'right';
		default:
			// Reached only via the `linDir` fallback in `branchMode` (no explicit
			// `hierBranch`), so `linDir` is `fromL`/`fromR` here: `fromR` grows the
			// tree leftward (children lead away from the right edge), `fromL`
			// grows it rightward.
			return linDir === 'fromR' ? 'left' : 'right';
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
	connectorLabels?: Map<string, string>,
	algorithmNode?: PptxSmartArtLayoutNode,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const roots = buildTree(nodes);
	const orgChart = presLayoutVars?.orgChart === true;
	// Only consulted when `presLayoutVars.hierBranch` is absent - see the module
	// doc comment and `branchMode`/`hangDirection`.
	const linDir = algorithmNode ? algorithmParam(algorithmNode, 'linDir') : undefined;
	const mode = branchMode(presLayoutVars, linDir);

	if (mode === 'hanging') {
		const boxW = Math.min(w * 0.42, 160);
		const boxH = Math.min(h * 0.16, 30);
		const indent = boxW * 0.35;
		const vGap = boxH * 0.55;
		const hc = baseContext(nodes.length, elementId, palette, style, boxW, boxH, connectorLabels);
		placeHangingForest(hc, roots, INSET + indent, INSET, {
			orgChart,
			direction: hangDirection(presLayoutVars, linDir),
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
	const hc = baseContext(nodes.length, elementId, palette, style, boxW, boxH, connectorLabels);

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
