/**
 * SmartArt DiagramML interpreter - hierarchy (`hierRoot` / `hierChild`) arranger.
 *
 * Arranges the data-model node tree as an org-chart / hierarchy, consulting
 * `presLayoutVars` (`dgm:presLayoutVars`/`dgm:varLst`) for every hint:
 *
 *   - `hierBranch` (`std`/`init`/`hang`/`l`/`r`): the root's OWN direct
 *     children ALWAYS fan out via the standard branch, whatever `hierBranch`
 *     says - measured against four genuine PowerPoint org charts (one slide
 *     per `SmartArtNode.OrgChartLayout` value): the manager's direct reports
 *     stay in one fanned row for Standard, Both/Left/Right Hanging alike.
 *     `hierBranch` only changes generations PAST the first, and only for
 *     `init`/`hang`/`l`/`r` (literal `std` fans every generation, matching
 *     base ECMA-376, likely unreachable from real PowerPoint - an unset root
 *     `hierBranch` resolves to `init`, not `std`). `init`/`hang`/`l`/`r` all
 *     hang the tail the SAME direction, never alternating per sibling,
 *     despite the "Left"/"Both Hanging" naming - see `HIER_TAIL_OFFSET_RATIO`'s
 *     doc comment in `smartart-hierarchy-shared.ts`. Each hanging hop
 *     (including the first, out of the fanned generation) offsets by that
 *     measured ratio of the box width, modelling `hierAlign`/`alignOff`.
 *   - `orgChart`: when set, `dgm:pt/@type="asst"` assistant nodes render in a
 *     dedicated row/slot next to their manager instead of fanning out as an
 *     ordinary subordinate.
 *   - `chMax`/`chPref`: group ordinary children exceeding this size into that
 *     many side-by-side hanging COLUMNS instead of one fanned row (standard
 *     branch only; a hanging column has no "row" to group). See
 *     `smartart-hierarchy-standard.ts`'s `placeWrappedChildren`.
 *
 * When `presLayoutVars.hierBranch` is ABSENT (a hand-authored/non-Office
 * layoutDef that never sets it, and never sets `orgChart` either), orientation
 * falls back to the algorithm's OWN `linDir` param
 * (`dgm:alg[@type=hierChild]/dgm:param[@type=linDir]`), per base ECMA-376:
 * `fromL`/`fromR` select a FULL hanging tree (root's own children down),
 * matching `hierBranch="r"`/`"l"`'s pre-measurement behaviour, since there is
 * no org-chart-family structure here to say otherwise. `fromT` (the default)
 * needs no fallback - it already IS the standard branch's own layout.
 * `fromB`/`secLinDir`/`chAlign` are not modelled (Office-authored layouts
 * always set `presLayoutVars`, so this only affects non-Office content). See
 * `smartart-hierarchy-orientation.ts` for the SEPARATE fan/generation axis
 * transposition (`sibSp` referencing `h`, e.g. "Horizontal Hierarchy") this
 * `linDir` fallback does not cover.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type {
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
	SmartArtStyle,
} from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { buildTree, treeDepth } from './smartart-helpers';
import {
	branchMode,
	linDirHangDirection,
	resolveRowSize,
	tailDirection,
} from './smartart-hierarchy-branch-mode';
import { hierarchyLeafFoldsDescendants } from './smartart-hierarchy-fold-depth';
import { computeHangShape } from './smartart-hierarchy-hang-depth';
import { placeHangingForest } from './smartart-hierarchy-hanging';
import { effectiveWidth, flattenOrgChartGroupWrappers } from './smartart-hierarchy-orgchart-tree';
import {
	applyChildOrder,
	fitItemBox,
	resolveHierarchyOrientation,
	transposeResult,
} from './smartart-hierarchy-orientation';
import {
	computeAxisPitch,
	FAN_MARGIN_RATIO,
	GENERATION_MARGIN_RATIO,
	translateResult,
} from './smartart-hierarchy-pitch';
import {
	baseContext,
	findHierarchyItemShape,
	HANG_HEIGHT_RATIO,
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
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
	childOrder?: Map<string, number>,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const orgChart = presLayoutVars?.orgChart === true;
	// See `applyChildOrder`'s doc comment: `nodes` is in `dgm:ptLst`
	// declaration order, not necessarily true sibling order.
	const orderedNodes = applyChildOrder(nodes, childOrder);
	// See `flattenOrgChartGroupWrappers`'s doc comment: genuine org charts nest
	// ordinary reports one level under invisible, untyped, empty "group"
	// content points rather than attaching them to the manager directly.
	const roots = buildTree(flattenOrgChartGroupWrappers(orderedNodes, orgChart));
	// Only consulted when `presLayoutVars.hierBranch` is absent - see the module
	// doc comment and `branchMode`/`hangDirection`.
	const linDir = algorithmNode ? algorithmParam(algorithmNode, 'linDir') : undefined;
	const mode = branchMode(presLayoutVars, linDir);
	// The item template's real preset (e.g. `rect`) nests two levels under the
	// arranger, inside a per-node `composite` (`rootComposite` -> `rootText`
	// `alg="tx"`) - see `findHierarchyItemShape`'s doc comment.
	const itemShape = algorithmNode ? findHierarchyItemShape(algorithmNode) : undefined;

	if (mode === 'hanging') {
		const boxW = Math.min(w * 0.42, 160);
		const boxH = Math.min(h * 0.16, 30);
		const indent = boxW * 0.35;
		const vGap = boxH * 0.55;
		const hc = baseContext(
			nodes.length,
			elementId,
			palette,
			style,
			boxW,
			boxH,
			connectorLabels,
			itemShape,
		);
		placeHangingForest(hc, roots, INSET + indent, INSET, {
			orgChart,
			direction: linDirHangDirection(linDir),
			indent,
			vGap,
		});
		return finish(hc.nodes, hc.connectors, hc.ctx.shadow, w, h);
	}

	// `orientation.transposed` ("Horizontal Hierarchy" and its siblings - see
	// `smartart-hierarchy-orientation.ts`'s module doc comment) runs this
	// WHOLE std/tailed algorithm against a box with width/height swapped, then
	// maps the result back at the very end (`transposeResult`): the fan axis
	// is always "X"/`cellW`/`boxW`'s own width and the generation axis always
	// "Y" from `placeStandardTree`'s own point of view, whichever real screen
	// axis that maps to.
	const orientation = resolveHierarchyOrientation(algorithmNode, index, mode);
	const effectiveBox: BoundingBox = orientation.transposed
		? { width: h, height: w }
		: { width: w, height: h };
	const totalLeaves = roots.reduce((sum, r) => sum + effectiveWidth(r, orgChart), 0);
	const rawDepth = roots.length > 0 ? Math.max(...roots.map((r) => treeDepth(r))) : 1;
	// `tailed` mode: only the fanned generations (root's own children row,
	// plus any solo-chain-link continuation - see `computeHangShape`'s own
	// doc comment) pack via `cellH`/`generationGapRatio`; everything past that
	// hangs via `placeHangingForest`'s OWN, independent vertical mechanism
	// (`HANG_HEIGHT_RATIO`), not this pitch at all. Sizing (`fitItemBox`) and
	// positioning (`computeAxisPitch` below) both need the REAL fanned-row
	// count, not the raw data tree's full depth, or both over-reserve room
	// for generations that were never actually going to sit in a `cellH`-tall
	// row (`std` mode is unaffected: `computeHangShape` is not even called,
	// `depth`/`maxHangDepth` stay exactly as before).
	const hangShape =
		mode === 'tailed'
			? computeHangShape(roots, orgChart, resolveRowSize(presLayoutVars))
			: { fannedGenerations: rawDepth, maxHangDepth: 0 };
	const depth = hangShape.fannedGenerations;
	const { boxW, boxH } = fitItemBox(
		effectiveBox,
		totalLeaves,
		depth,
		orientation.sibSpRatio,
		orientation.aspectRatio,
		orientation.generationGapRatio,
		orientation.marginXRatio,
		orientation.marginYRatio,
		hangShape.maxHangDepth,
		mode !== 'tailed',
	);
	// `cellW`/`cellH` as a naive `dimension/count` split distributes leftover
	// space EQUALLY on both ends ("space-around"); COM-verified real
	// PowerPoint output instead has a fixed leading margin (left/top) with the
	// tree's trailing edge (rightmost sibling, deepest generation) flush
	// against the far box edge - see `smartart-hierarchy-pitch.ts`'s module
	// doc comment for the exact derivation. `pitch` plugs in as `cellW`/
	// `cellH` unchanged; `shift` corrects the leading margin afterwards via
	// `translateResult`. A TRANSPOSED hierarchy needs NO leading margin either
	// (same COM-verified finding as `fitItemBox`'s own `marginXRatio`/
	// `marginYRatio` - see `OUTER_MARGIN_X_RATIO`'s doc comment): its item
	// size already fills the box edge-to-edge with zero slack, so applying a
	// nonzero leading margin on top double-counts space that was never there,
	// pushing the whole tree away from the box's leading edge (measured
	// regression: `horizontal-hierarchy--flat3.pptx`'s root rendered 61px
	// right of the box's left edge instead of flush).
	// `tailed` mode: `computeAxisPitch`'s own "stretch pitch/gap to fill the
	// WHOLE box" model assumes `totalLeaves`/`depth` items genuinely span the
	// entire `effectiveBox` - true for `std` (every generation fans, filling
	// the box), false here (only `fannedGenerations` rows actually fan; the
	// REST of the box is reserved for the hanging tail via its OWN, separate
	// `vGap`/indent mechanism - `fitItemBox`'s own `maxHangDepth` term
	// already sized `boxW`/`boxH` around exactly how much of the box that
	// reservation consumes, see that function's doc comment). Stretching
	// `computeAxisPitch` to fill the WHOLE box using only the fanned count
	// double-reserves that same space as one giant inter-row gap
	// (COM-verified regression: `organization-chart--hier5.pptx`'s own
	// generation-1 row rendered ~200px too far down). The fix is NOT to skip
	// `computeAxisPitch` (a naive, unstretched `itemSize*(1+gapRatio)` pitch
	// reintroduces the exact "space-around" bug that function exists to
	// correct - see its own module doc comment - regressing every position
	// by exactly `gap/2`, COM-verified: ~37px on `organization-chart--hier5
	// .pptx`'s own fan row): it is to stretch `computeAxisPitch` against only
	// the FAN-share of the box (`effectiveBox` minus whatever `fitItemBox`
	// reserved for the hanging tail on that axis), so the SAME leading-margin
	// correction applies, just scoped to the smaller region the fanned rows
	// actually occupy.
	const tailedPitch = mode === 'tailed';
	const fanMargin = orientation.transposed || tailedPitch ? 0 : boxW * FAN_MARGIN_RATIO;
	const generationMargin =
		orientation.transposed || tailedPitch ? 0 : boxH * GENERATION_MARGIN_RATIO;
	const fanWidth = tailedPitch
		? effectiveBox.width - hangShape.maxHangDepth * HIER_TAIL_OFFSET_RATIO * boxW
		: effectiveBox.width;
	const fanHeight = tailedPitch
		? effectiveBox.height - hangShape.maxHangDepth * (1 + HANG_HEIGHT_RATIO) * boxH
		: effectiveBox.height;
	const xPitch = computeAxisPitch(fanWidth, fanMargin, boxW, totalLeaves);
	const yPitch = computeAxisPitch(fanHeight, generationMargin, boxH, depth);
	const cellW = xPitch.pitch;
	const cellH = yPitch.pitch;
	const hc = baseContext(
		nodes.length,
		elementId,
		palette,
		style,
		boxW,
		boxH,
		connectorLabels,
		itemShape,
	);

	const standardOptions: StandardOptions = {
		orgChart,
		perRow: resolveRowSize(presLayoutVars),
		foldDeeperGenerations: algorithmNode ? hierarchyLeafFoldsDescendants(algorithmNode) : false,
	};
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
	const result = translateResult(
		finish(hc.nodes, hc.connectors, hc.ctx.shadow, effectiveBox.width, effectiveBox.height),
		xPitch.shift,
		yPitch.shift,
	);
	return orientation.transposed ? transposeResult(result, w, h) : result;
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
