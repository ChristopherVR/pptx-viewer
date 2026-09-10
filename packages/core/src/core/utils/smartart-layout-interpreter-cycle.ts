/**
 * SmartArt DiagramML interpreter - cycle (`cycle`) arranger.
 *
 * Places the data-model points evenly around a centre, honouring the `stAng`
 * (start angle) and `spanAng` (sweep) algorithm parameters, and draws light
 * arc connectors between consecutive points. When `ctrShpMap`
 * (`dgm:param[@type=ctrShpMap]`) is `fNode`, the FIRST data point is pulled
 * off the ring and placed at the box centre instead - PowerPoint's "Radial
 * Cycle" family layouts use this for a hub node the ring nodes surround.
 *
 * ## Node sizing (live-PowerPoint-COM-verified derivation, corrected round
 * 11/SESSION 8 - ignore any older note citing an "anisotropic fill-to-box"
 * model: measured against a NOW-FIXED cached-reader bug, does not match real
 * PowerPoint COM output.)
 *
 * Live COM (three independent methods: `SmartArt.AllNodes` shape geometry,
 * "Convert to Shapes" + `GroupItems`, and a pixel-bounding-box PNG scan -
 * see `smartart-decompose.test.ts`'s "matches live PowerPoint COM geometry")
 * proved PowerPoint does NOT independently stretch cached content to fill
 * its frame: a cached shape's real geometry is `graphicFrame.origin +
 * dsp:sp`'s own `a:xfrm` offset, size UNCHANGED, sized directly from the
 * DiagramML constraint graph (ECMA-376 21.4.7); when smaller than the frame
 * on an axis, it is CENTRED there (verified on `basic-cycle--flat3.pptx`,
 * hub-less, and `basic-radial--hier5.pptx`, hub+ring - symmetric margins,
 * never one-sided).
 *
 * MS's "Cycle Algorithm" reference (Office 2007 SDK) gives only schema
 * defaults (`w`/`h`=100, `diam`=0, `sibSp`=0), not the packing formula, so
 * the RING RADIUS (`R0`) was reverse-engineered against real cached `dsp:sp`
 * geometry (unchanged by round 11 - only the FINAL box-fit step was wrong):
 *
 *   1. In a unit space where the node's own width is 1: place `n` points on
 *      a circle of radius `R0`, spaced by `spanAng/n` (full) or `/(n-1)`
 *      (arc), starting at `stAng`.
 *   2. `R0` solves the adjacent-point chord to `(1 + minGap) * 1`:
 *      `2*R0*sin(step/2) = 1 + minGap`.
 *   3. Compute the natural bounding box of all `n` unit-width (height = the
 *      item's own `h:w` fact) footprints centred at those points.
 *   4. Scale that box by a SINGLE isotropic factor (`Math.min` of the two
 *      per-axis "fill" candidates, a "contain" not "cover" fit) and CENTRE
 *      the slack (`smartart-layout-interpreter-cycle-ring.ts` has the
 *      numeric derivation). Final width = final height / (item h:w fact) -
 *      `heightOverWidth===1` is ALWAYS a true circle/square.
 *
 * Verified against the full 227-fixture gallery: `basic-cycle`/
 * `multidirectional-cycle`/`continuous-cycle`/`basic-radial--hier5`/
 * `radial-cycle--flat3` all PASS (<=1% `maxDeltaFraction`) - a general fix.
 * See `smartart-track-r-successor.md` SESSION 8 for named residuals.
 *
 * `ctrShpMap="fNode"` hub sizing reuses the SAME `R0`/scale computation
 * (`computeCycleRingLayout`'s `hubCenter`/`naturalHubRadius`): centred at
 * the ring's natural centre, sized to the largest ellipse fitting the space
 * to the nearest ring node - `smartart-layout-interpreter-hub.ts`'s
 * `buildHubRenderedNode` consumes it.
 *
 * The ring's fixed-point solve lives in `smartart-layout-interpreter-cycle-
 * ring.ts`, constraint reading in `smartart-layout-interpreter-cycle-
 * constraints.ts`; both re-exported here. Pure geometry; no framework code.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { buildCycleHubBox, buildCycleRingBoxes } from './smartart-layout-interpreter-cycle-boxes';
import { buildCycleRingConnectors } from './smartart-layout-interpreter-cycle-connectors';
import {
	resolveCycleConstraintNode,
	resolveCycleRingParams,
} from './smartart-layout-interpreter-cycle-constraints';
import {
	applyCycleRingExtensions,
	hasMaxDepthGuard,
} from './smartart-layout-interpreter-cycle-extension';
import { resolveCycleFontFit } from './smartart-layout-interpreter-cycle-fontfit';
import { computeCycleRingLayout } from './smartart-layout-interpreter-cycle-ring';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { algorithmParam, numericParam } from './smartart-layout-interpreter-model';
import { styleContext } from './smartart-layout-interpreter-render';
import { findCompositeItemShape, roundRectCornerInsetPx } from './smartart-layout-shape-preset';
import type {
	BoundingBox,
	RenderedConnector,
	RenderedNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

export type { CycleRingLayout } from './smartart-layout-interpreter-cycle-ring';
export { computeCycleRingLayout } from './smartart-layout-interpreter-cycle-ring';
export {
	resolveCycleConstraintNode,
	resolveCycleRingParams,
} from './smartart-layout-interpreter-cycle-constraints';

/** Execute the `cycle` algorithm: points on a ring around the box centre. */
export function arrangeCycle(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
	hubAlreadyStripped = false,
	childrenOf?: Map<string, PptxSmartArtNode[]>,
	fontName?: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	// `satelliteCount` (SESSION 17, `resolveHubToNodeRatio`'s own count-gated
	// `dgm:rule` override): only trustworthy when the hub was ALREADY pulled
	// out of `nodes` upstream (`hubAlreadyStripped`) - the common case for
	// every hub+ring family (`basic-radial`/`diverging-radial`/`converging-
	// radial`), where `nodes.length` already IS the satellite count. When NOT
	// already stripped, the `ctrShpMap="fNode"` fallback below may still peel
	// off `nodes[0]` as a hub, so `undefined` (no override) is safer than a guess.
	const {
		minGapRatio,
		heightOverWidth,
		absoluteGapPx,
		hubRatio,
		hubGapRatio,
		absoluteHubGapPx,
		sibTransBulgeRatio,
	} = resolveCycleRingParams(plan.node, index, hubAlreadyStripped ? nodes.length : undefined);
	// `ctrShpMap="fNode"` pulls the first data point into a hub at the ring's
	// own natural centre; every other value (including absent, the common
	// case) puts every point on the ring, matching the pre-existing
	// behaviour. Real gallery hub layouts (`radial-cycle`, `basic-radial`,
	// `diverging-radial`, `converging-radial`, `radial-venn`, ...) ARE already
	// stripped of their hub point upstream by `smartart-layout-interpreter.ts`'s
	// `runArrangement` (`detectHubExpansion` + `buildHubRenderedNode`, called
	// once per diagram, BEFORE this function ever runs) - `hubAlreadyStripped`
	// (set by that caller) is essential, not a fallback nicety: `ctrShpMap`
	// stays `'fNode'` on `plan.node.algorithm` regardless of whether the hub
	// was already pulled out, so without this flag `arrangeCycle` re-detects a
	// SECOND, PHANTOM hub from the first SATELLITE in its own already-hub-free
	// `nodes` array, corrupting every hub-bearing fixture (COM-verified
	// regression: `radial-cycle--flat3.pptx`'s 2 satellites rendered as a
	// bogus box-sized "hub" + a degenerate leftover ring node). Defaults
	// `false` so a caller that hands the hub point straight through unstripped
	// (a unit test, or a pattern `detectHubExpansion` does not recognise)
	// keeps the old internal-detection behaviour.
	//
	// `!hubRatio`: `radial-list--hier5.pptx`'s own shape - THREE top-level
	// "node" data points (no separate top-level hub point at all), plus a
	// SEPARATE, always-present `centerShape` layoutNode (gated by its own
	// `dgm:choose`, rendering a decorative image, invisible to text-based
	// comparison) - the composite's own `w for=ch forName=node ... refForName
	// ="centerShape"` constraint (`resolveHubToNodeRatio`, surfaced here as
	// `hubRatio`) is the SAME declarative signal `resolveRingItemNode` already
	// uses to recognise "this composite structurally names its own hub".
	// `detectHubExpansion` never strips anything for this shape (it requires
	// EXACTLY ONE top-level point, radial-list has three), so
	// `hubAlreadyStripped` stays `false` and this function's OWN
	// `ctrShpMap="fNode"` fallback fired instead - wrongly, since `centerShape`
	// already fully accounts for the hub concept: PowerPoint's own cached
	// drawing renders all 3 "node" points as EQUAL-SIZED satellites with no
	// distinguishable 4th hub shape. Firing the fallback anyway silently
	// dropped a real satellite to a degenerate 2-node ring (COM-verified
	// regression, `radial-list--hier5.pptx`: `n` collapsed 3 -> 2, and the
	// `cnt=3` choose branch's own `stAng`/`spanAng` - calibrated for exactly 3
	// ring points - produced a collinear degenerate pair on the SMALLER `n=2`,
	// tripping the ring math's own defensive isotropic fallback). Never fires
	// when `hubAlreadyStripped` is already `true` (the common case,
	// `basic-radial`/`diverging-radial`/`converging-radial` ALSO resolve
	// `hubRatio` but are already correctly stripped upstream, so this clause
	// is a no-op for them - verified via the full gallery sweep).
	const hasHub =
		!hubAlreadyStripped &&
		!hubRatio &&
		algorithmParam(plan.node, 'ctrShpMap') === 'fNode' &&
		nodes.length > 0;
	const hubNode = hasHub ? nodes[0] : undefined;
	const ringNodes = hasHub ? nodes.slice(1) : nodes;
	const n = ringNodes.length;
	const startDeg = numericParam(plan.node, 'stAng', 0);
	const spanDeg = numericParam(plan.node, 'spanAng', 360);
	// A hub+ring composite's own centre-to-satellite `r0` is governed by
	// `hubGapRatio` (the `sp` space between the hub's edge and each
	// satellite's), not the adjacent-satellite chord `sibSp` solves for a
	// plain ring - see `computeCycleRingLayout`'s own doc comment. Applies
	// whenever this composite structurally HAS a hub (`hubRatio` resolved),
	// independent of `hubAlreadyStripped`: the satellites still ring AROUND
	// the hub even when it was already pulled out and rendered separately.
	// `hubGapRatio === undefined` but `absoluteHubGapPx` present (an ABSOLUTE
	// `sp val`, e.g. `radial-list--hier5.pptx`'s own `sp val="20"`, which
	// `resolveHubGapRatio` cannot express as a ratio at all): still build a
	// `hubGeometry` (starting `gapRatio` guess `0`) so `computeCycleRingLayout`'s
	// own fixed-point iteration refines it from the absolute pixel value - see
	// that function's own `absoluteHubGapPx` doc comment.
	const hubGeometry =
		hubRatio && (hubGapRatio !== undefined || absoluteHubGapPx !== undefined)
			? { factor: hubRatio.factor, gapRatio: hubGapRatio ?? 0 }
			: undefined;
	const ring = computeCycleRingLayout(
		n,
		startDeg,
		spanDeg,
		minGapRatio,
		heightOverWidth,
		box,
		absoluteGapPx,
		hubGeometry,
		absoluteHubGapPx,
		sibTransBulgeRatio,
	);

	const full = Math.abs(spanDeg) >= 360;
	const connectorCount = n > 0 ? (full ? n : Math.max(0, n - 1)) : 0;
	// Same per-slot angular width `computeCycleRingLayout` itself solves the
	// ring with (`ringLayoutForGapFactor`'s own `step`) - reused as the
	// default fan span for a ring point's own recursive extension (see
	// `smartart-layout-interpreter-cycle-extension.ts`), so a multi-child
	// fan cannot spill into a neighbouring branch's own angular slot.
	const ringStepDeg = n > 0 ? (full ? spanDeg / n : spanDeg / Math.max(1, n - 1)) : 0;
	const ringCentre = ring.hubCenter;
	const connectors: RenderedConnector[] = buildCycleRingConnectors(
		ring,
		n,
		connectorCount,
		ringCentre,
		elementId,
	);

	// `findCompositeItemShape`, not `itemNode(...)?.shape`: the cycle
	// arranger's own first child is not always the shape-bearing item
	// template - measured against "Text Cycle": its `cycle` root's children
	// are `dummy` (a shapeless `alg="sp"` decorative placeholder, FIRST in
	// document order), `node` (`alg="tx"`, the real `dgm:shape type="rect"`),
	// then `sibTrans` - so `itemNode(...)` (a plain `.children?.[0]`) picks
	// `dummy`, which carries no preset at all, and the bridge falls back to
	// the generic `fallbackKind: 'circle'` default (`ellipse`) instead of the
	// cached `rect`. `findCompositeItemShape` searches every child (and their
	// descendants) for the first genuinely declared preset instead of
	// assuming the item template is always the first one.
	const itemShape = findCompositeItemShape(resolveCycleConstraintNode(plan.node));
	// Font size for every ring item, plus the hub's own INDEPENDENT size when
	// one is present (round 18/36): see `smartart-layout-interpreter-cycle-
	// fontfit.ts`'s module doc comment.
	const cornerInset = roundRectCornerInsetPx(itemShape, ring.nodeWidth, ring.nodeHeight);
	const fontFit = resolveCycleFontFit(
		plan,
		index,
		ringNodes,
		hubNode,
		ring.nodeWidth,
		ring.nodeHeight,
		Math.max(1, ring.hubHalfWidth * 2),
		Math.max(1, ring.hubHalfHeight * 2),
		cornerInset,
		childrenOf,
		fontName,
	);
	const boxInputs = {
		palette,
		style,
		ctx,
		shape: itemShape,
		elementId,
		fontSizeOverride: fontFit.fontSizeOverride,
		descendantFontSize: fontFit.descendantSizePx,
	};
	const renderedNodes: RenderedNode[] = buildCycleRingBoxes(ringNodes, ring, boxInputs);
	if (hubNode) {
		renderedNodes.push(buildCycleHubBox(hubNode, ring, nodes.length, boxInputs, fontFit));
	}

	// A ring point whose OWN data node has children (`radial-cluster`'s
	// construct) is not a leaf - see `smartart-layout-interpreter-cycle-
	// extension.ts`'s module doc comment for the COM-verified derivation.
	// Gated on TWO conditions, BOTH proven necessary (neither alone is
	// sufficient - see that module's own `hasMaxDepthGuard` doc comment for
	// the full derivation, including the `radial-cycle--hier5.pptx`
	// regression this second condition fixes): `hubAlreadyStripped` (this is
	// a genuinely hub-shaped diagram, not a plain ring whose data merely
	// happens to nest deeper) AND `hasMaxDepthGuard` (THIS SPECIFIC
	// layoutDef's own author branches on tree depth at all - the one
	// structural, non-per-layout-name signal separating `radial-cluster`
	// from every other hub-bearing cycle fixture in the corpus).
	if (childrenOf && hubAlreadyStripped && hasMaxDepthGuard(plan.node)) {
		const extension = applyCycleRingExtensions(ringNodes, ring, {
			...boxInputs,
			ringCentre,
			minGapRatio,
			absoluteGapPx,
			ringStepDeg,
			childrenOf,
		});
		renderedNodes.push(...extension.nodes);
		connectors.push(...extension.connectors);
	}

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'cycle',
	};
}
