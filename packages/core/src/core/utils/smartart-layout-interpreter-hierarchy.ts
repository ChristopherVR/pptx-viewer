/**
 * SmartArt DiagramML interpreter - hierarchy (`hierRoot` / `hierChild`) arranger.
 *
 * Arranges the data-model node tree as an org-chart / hierarchy, consulting
 * `presLayoutVars` (`dgm:presLayoutVars`/`dgm:varLst`) for every hint it
 * carries:
 *
 *   - `hierBranch` (`std`/`init`/`hang`/`l`/`r`): the root's OWN direct
 *     children ALWAYS fan out via the standard branch, whatever `hierBranch`
 *     says - measured against four genuine PowerPoint org charts
 *     (`smartart-orgchart-hierbranch.pptx` in the corpus, one slide per
 *     `SmartArtNode.OrgChartLayout` value): the manager's direct reports stay
 *     in one fanned row for Standard, Both Hanging, Left Hanging AND Right
 *     Hanging alike. What `hierBranch` actually changes is everything past
 *     that first generation, and only for `init`/`hang`/`l`/`r`: literal `std`
 *     installs no tail at all (every generation fans), matching base
 *     ECMA-376; this is likely never reachable from real PowerPoint output
 *     (see `smartart-pres-layout-vars.ts`'s module doc comment: an unset root
 *     `hierBranch` resolves to `init`, not `std`), but hand-built layoutDefs
 *     can still request it explicitly. `init`/`hang`/`l`/`r` all hang the tail
 *     the SAME direction and never alternate per sibling: despite the
 *     "Left"/"Both Hanging" naming, genuine PowerPoint output measured across
 *     all four variants (plus a third-generation case in
 *     `smartart-orgchart-nested-hang.pptx`) shows an identical offset every
 *     time - see `HIER_TAIL_OFFSET_RATIO`'s doc comment in
 *     `smartart-hierarchy-shared.ts` and `placeHangingTree`'s doc comment in
 *     `smartart-hierarchy-hanging.ts`. Each hanging hop (including the FIRST
 *     one out of the fanned generation) offsets by that measured ratio of the
 *     box width, modelling the layoutDef's own `hierAlign`/`alignOff`
 *     root-box alignment (previously unmodelled: the first hop rendered flush
 *     with its parent, a visible divergence from PowerPoint).
 *   - `orgChart`: when set, `dgm:pt/@type="asst"` assistant nodes render in a
 *     dedicated row/slot next to their manager instead of fanning out as an
 *     ordinary subordinate.
 *   - `chMax`/`chPref`: group ordinary children exceeding this size into that
 *     many side-by-side hanging COLUMNS instead of one fanned row (standard
 *     branch only; a hanging column has no "row" to group). See
 *     `smartart-hierarchy-standard.ts`'s `placeWrappedChildren`.
 *
 * When `presLayoutVars.hierBranch` is ABSENT (a hand-authored/non-Office
 * layoutDef that never sets it, and never sets `orgChart` either - see below),
 * orientation falls back to the algorithm's OWN `linDir` param
 * (`dgm:alg[@type=hierChild]/dgm:param[@type=linDir]`), per base ECMA-376 -
 * `fromL`/`fromR` select a FULL hanging tree (from the root's own children
 * down), matching `hierBranch="r"`/`"l"`'s pre-measurement behaviour, because
 * there is no org-chart-family structure here to say otherwise. `fromT`
 * (top-down, the default) needs no fallback: it already IS the standard
 * branch's own layout. `fromB` (bottom-up) and `secLinDir`/`chAlign` are not
 * modelled - they would need restructuring `placeStandardTree`'s row layout to
 * flip vertically / control cross-axis alignment, out of scope for this
 * fallback (Office-authored layouts always set `presLayoutVars`, so this only
 * affects non-Office content).
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
import { placeHangingForest } from './smartart-hierarchy-hanging';
import type { HangDirection } from './smartart-hierarchy-hanging';
import {
	baseContext,
	effectiveWidth,
	flattenOrgChartGroupWrappers,
	HIER_TAIL_OFFSET_RATIO,
} from './smartart-hierarchy-shared';
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

/**
 * `std`: literal ECMA-376 standard branch, no hanging tail anywhere (every
 *        generation fans). Reachable only from an explicit hand-built
 *        `hierarchyBranch: 'std'` - see the module doc comment.
 * `tailed`: the root's own children fan out (same as `std`), but every
 *        deeper generation hangs. Selected by `init`/`hang`/`l`/`r`.
 * `hanging`: the WHOLE tree hangs, including the root's own children. Only
 *        reached via the `linDir` fallback (no `presLayoutVars.hierBranch` at
 *        all) - see the module doc comment.
 */
type BranchMode = 'std' | 'tailed' | 'hanging';

/** `linDir` values that select a hanging tree when `hierBranch` is absent. */
function isHangingLinDir(linDir: string | undefined): boolean {
	return linDir === 'fromL' || linDir === 'fromR';
}

function branchMode(
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	linDir: string | undefined,
): BranchMode {
	const branch = presLayoutVars?.hierarchyBranch;
	if (branch === 'l' || branch === 'r' || branch === 'hang' || branch === 'init') {
		return 'tailed';
	}
	if (branch === undefined && isHangingLinDir(linDir)) {
		return 'hanging';
	}
	return 'std';
}

/**
 * Tail direction for `tailed` mode (the root's own children are unaffected).
 *
 * `l`/`hang`/`r`/`init` all measure identically as 'right' against genuine
 * PowerPoint output - see the module doc comment and `HIER_TAIL_OFFSET_RATIO`
 * in `smartart-hierarchy-shared.ts`. Kept as a function (rather than a bare
 * constant) so a future genuine-fixture measurement that DOES find a real
 * per-branch difference has a single place to encode it.
 */
function tailDirection(_presLayoutVars: PptxSmartArtPresLayoutVars | undefined): HangDirection {
	return 'right';
}

/**
 * Direction for `hanging` mode, reached ONLY via the `linDir` fallback (no
 * `presLayoutVars.hierBranch` at all): `fromR` grows the tree leftward
 * (children lead away from the right edge), `fromL` grows it rightward.
 */
function linDirHangDirection(linDir: string | undefined): HangDirection {
	return linDir === 'fromR' ? 'left' : 'right';
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
	const orgChart = presLayoutVars?.orgChart === true;
	// See `flattenOrgChartGroupWrappers`'s doc comment: genuine org charts nest
	// ordinary reports one level under invisible, untyped, empty "group"
	// content points rather than attaching them to the manager directly.
	const roots = buildTree(flattenOrgChartGroupWrappers(nodes, orgChart));
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
			direction: linDirHangDirection(linDir),
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
	if (mode === 'tailed') {
		// Measured ratio (`HIER_TAIL_OFFSET_RATIO`), not the unrelated 0.35 used
		// by the `linDir`-only `hanging` mode above: this is the org-chart-family
		// `hierAlign`/`alignOff` root-box offset, and genuine PowerPoint output
		// pins it at exactly 0.25x the box width - see the constant's doc comment.
		const indent = boxW * HIER_TAIL_OFFSET_RATIO;
		const vGap = boxH * 0.55;
		const direction = tailDirection(presLayoutVars);
		standardOptions.hangingPlacer = (childHc, subtrees, anchorX, anchorY) => {
			placeHangingForest(childHc, subtrees, anchorX, anchorY, {
				orgChart,
				direction,
				indent,
				vGap,
			});
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
