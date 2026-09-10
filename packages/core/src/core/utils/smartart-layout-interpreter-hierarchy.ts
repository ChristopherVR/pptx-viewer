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
import { computeHierarchyAxisPitches } from './smartart-hierarchy-axis-pitch';
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
import { translateResult } from './smartart-hierarchy-pitch';
import {
	baseContext,
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
			resolveHierarchyItemFontSizePx(nodes, algorithmNode, index, boxW, boxH, fontName),
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
	// `fitItemBox`'s own `clampToNaturalAspect` parameter (default `true`,
	// left unset here) was added by a concurrent change to that file but is
	// NOT wired to `false` for `tailed` mode here: measured directly (full
	// gallery baseline, this session) that doing so REGRESSES the whole
	// org-chart family rather than improving it -
	// `organization-chart--{flat3,hier5,hier8}.pptx` moved from their
	// existing `maxDeltaFraction` (5.6%/10.6%/13.5% observed with
	// `clampToNaturalAspect=false`, all WORSE). Left at the default (`true`,
	// i.e. `boxH`/`boxW` stay aspect-clamped). NOTE for whoever revisits
	// `half-circle`/`name-and-title-organization-chart`'s own item-size
	// residual (SESSION 18/19): `widthFit` itself is NOT provably wrong for
	// `organization-chart--hier5.pptx` (352px) - that fixture is
	// HEIGHT-bound (`boxH=heightFit`, `boxW=heightFit/aspectRatio`, `widthFit`
	// never actually used), so its own good 1.27% match says nothing about
	// `widthFit`'s correctness. `half-circle`'s smaller, more-correct aspect
	// (0.32 vs the wrapper's 0.5 - see `smartart-hierarchy-composite-
	// child.ts`) flips the SAME box to WIDTH-bound instead, exposing whatever
	// `widthFit` actually is - which is why fixing the aspect ALONE regressed
	// SESSION 18's own attempt.
	//
	// SESSION 20: 5 precise `widthFit` samples now exist (2 built via live
	// COM specifically for this, `smartart-track-r-successor.md` has the
	// full derivation) - `organization-chart--flat3.pptx` (n=2, no hang,
	// extra~0), `--hier5.pptx` (n=2, BOTH branches hang 1 leaf each,
	// extra~0.909), `--hier8.pptx` (n=5, ONE branch hangs 1 leaf,
	// extra~0.018), a COM sample (n=3, ONE branch hangs 1 leaf, extra~0.007),
	// and a COM sample (n=3, ONE branch hangs 2 leaves side by side,
	// extra~0.851) - `extra` being how much `widthFit`'s own denominator
	// must grow past `n + (n-1)*sibSpRatio` to reproduce the cached item
	// width. A minority branch hanging exactly 1 leaf needs ~0 extra
	// (`hier8`, the n=3/1-leaf sample); a branch hanging 2+ leaves, OR every
	// fanned branch hanging at once, needs a LARGE extra of the SAME rough
	// magnitude (~0.85-0.91) - two seemingly different triggers landing on
	// similar magnitudes, not yet unified into one closed-form rule with
	// only 5 samples. NOT landed this session - needs a proper automated
	// COM sweep (vary branch count and hang-count independently) before
	// trying another formula, not another one-off guess.
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
	);
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
		depth,
		hangShape,
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
