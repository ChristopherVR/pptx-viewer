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
import type { TreeNode } from './smartart-helpers';
import { computeHierarchyAxisPitches } from './smartart-hierarchy-axis-pitch';
import { branchMode, resolveRowSize, tailDirection } from './smartart-hierarchy-branch-mode';
import { resolveCascadePlan } from './smartart-hierarchy-cascade';
import { buildFanAwareWidthMap, resolveSpanWidth } from './smartart-hierarchy-fan-aware-width';
import { hierarchyLeafFoldsDescendants } from './smartart-hierarchy-fold-depth';
import { computeHangShape } from './smartart-hierarchy-hang-depth';
import { arrangeFullyHangingTree, placeHangingForest } from './smartart-hierarchy-hanging';
import { flattenOrgChartGroupWrappers } from './smartart-hierarchy-orgchart-tree';
import {
	applyChildOrder,
	fitItemBox,
	resolveHierarchyOrientation,
	transposeResult,
} from './smartart-hierarchy-orientation';
import { translateResult } from './smartart-hierarchy-pitch';
import {
	baseContext,
	findHierarchyItemName,
	findHierarchyItemShape,
	HIER_TAIL_OFFSET_RATIO,
} from './smartart-hierarchy-shared';
import { placeStandardTree } from './smartart-hierarchy-standard';
import type { StandardOptions } from './smartart-hierarchy-standard';
import { resolveHierarchyItemFontSizePx } from './smartart-layout-interpreter-hierarchy-fontfit';
import { algorithmParam } from './smartart-layout-interpreter-model';
import type {
	BoundingBox,
	RenderedConnector,
	RenderedNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

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
	fontName?: string,
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
		return arrangeFullyHangingTree(
			nodes,
			box,
			palette,
			style,
			elementId,
			roots,
			itemShape,
			connectorLabels,
			algorithmNode,
			index,
			fontName,
			linDir,
			orgChart,
		);
	}

	// `orientation.transposed` ("Horizontal Hierarchy" and its siblings - see
	// `smartart-hierarchy-orientation.ts`'s module doc comment) runs this
	// WHOLE std/tailed algorithm against a box with width/height swapped, then
	// maps the result back at the very end (`transposeResult`): the fan axis
	// is always "X"/`cellW`/`boxW`'s own width and the generation axis always
	// "Y" from `placeStandardTree`'s own point of view, whichever real screen
	// axis that maps to.
	const orientation = resolveHierarchyOrientation(
		algorithmNode,
		index,
		mode,
		findHierarchyItemName(algorithmNode),
	);
	const effectiveBox: BoundingBox = orientation.transposed
		? { width: h, height: w }
		: { width: w, height: h };
	const rawDepth = roots.length > 0 ? Math.max(...roots.map((r) => treeDepth(r))) : 1;
	const rowSize = resolveRowSize(presLayoutVars);
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
			? computeHangShape(roots, orgChart, rowSize)
			: { fannedGenerations: rawDepth, maxHangDepth: 0, maxHangRows: 0, allChildrenHang: false };
	const depth = hangShape.fannedGenerations;
	// `tailed` mode's own hang/fan decision (`fanAwareWidthMap`, see
	// `buildFanAwareWidthMap`'s doc comment in `smartart-hierarchy-hang-
	// depth.ts`): a branch that HANGS collapses its entire subtree to exactly
	// ONE column, unlike plain `effectiveWidth`'s structural leaf-count sum
	// (which over-allocates a hanging branch's own row-share whenever it has
	// more than one descendant leaf - `placeHangingTree` stacks every one of
	// a hung node's children in a SINGLE shared column, never side by side).
	// `std` mode has no hang concept and keeps `spanOfRoot` at plain
	// `effectiveWidth` (the map is `undefined`, `resolveSpanWidth` falls
	// back). Threaded into BOTH sizing (`totalLeaves` below, `fitItemBox`'s
	// own `columns` param) and positioning (`standardOptions.resolveSpan`
	// below, consumed by `placeStandardTree`/`placeFlatChildren`) from this
	// ONE map, so the two can never disagree on a branch's own column count.
	const fanAwareWidthMap =
		mode === 'tailed' ? buildFanAwareWidthMap(roots, orgChart, rowSize) : undefined;
	const spanOfRoot = (r: TreeNode): number => resolveSpanWidth(fanAwareWidthMap, r, orgChart);
	const totalLeaves = roots.reduce((sum, r) => sum + spanOfRoot(r), 0);
	// `fitItemBox`'s own `clampToNaturalAspect` (default `true`, left unset):
	// `false` for `tailed` mode REGRESSES the whole org-chart family (full
	// baseline, measured) - stays aspect-clamped. `half-circle`/`name-and-
	// title`'s own paired aspect+position problem is still open - see
	// `smartart-track-r-successor.md` (SESSION 18-23) for the full history.
	// `hangHeightRatio`: see `fitItemBox`'s own doc comment (SESSION 25).
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
		undefined,
		hangShape.maxHangRows,
		hangShape.allChildrenHang,
		orientation.transposed ? orientation.generationGapRatio : undefined,
	);
	// See `smartart-hierarchy-cascade.ts`'s own module doc comment for the
	// declared construct this resolves (`half-circle-organization-chart`'s
	// own composite-relative generation gap + `alignOff` nudge).
	const cascadePlan = resolveCascadePlan(mode, orientation, depth, hangShape, boxW);
	// See `computeHierarchyAxisPitches`'s own doc comment (`smartart-
	// hierarchy-axis-pitch.ts`) for why the fan and generation axes use
	// genuinely different pitch models, and its own history for the SESSION
	// 9/10 corrections.
	const tailedPitch = mode === 'tailed';
	const { xPitch, yPitch } = computeHierarchyAxisPitches(
		effectiveBox,
		orientation,
		boxW,
		boxH,
		totalLeaves,
		cascadePlan.pitchDepth,
		cascadePlan.pitchHangShape,
		tailedPitch,
	);
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
		resolveHierarchyItemFontSizePx(nodes, algorithmNode, index, boxW, boxH, fontName),
	);

	const standardOptions: StandardOptions = {
		orgChart,
		perRow: rowSize,
		foldDeeperGenerations: algorithmNode ? hierarchyLeafFoldsDescendants(algorithmNode) : false,
		resolveSpan: fanAwareWidthMap
			? (t) => resolveSpanWidth(fanAwareWidthMap, t, orgChart)
			: undefined,
		hangHeightRatio: orientation.transposed ? orientation.generationGapRatio : undefined,
		cascadeOffsetX: cascadePlan.cascadeOffsetX,
	};
	// SESSION 28: the cascade construct (`smartart-hierarchy-cascade.ts`)
	// reuses the SAME fanned-row placement for every generation, so `placeAt`
	// must fall through its own default `placeFlatChildren`/
	// `placeWrappedChildren` branch at every level instead of routing the row
	// past the fan through `hangingPlacer`'s independent (and, for this
	// construct, wrong) `HANG_HEIGHT_RATIO` gap.
	if (mode === 'tailed' && !cascadePlan.active) {
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
		offset += spanOfRoot(root);
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
