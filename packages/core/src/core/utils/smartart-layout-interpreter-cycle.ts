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
 * "Convert to Shapes" + `GroupItems`, and a pixel-bounding-box PNG scan - see
 * `smartart-decompose.test.ts`'s "matches live PowerPoint COM geometry")
 * proved PowerPoint does NOT independently stretch cached content to fill its
 * frame: a cached shape's real geometry is `graphicFrame.origin + dsp:sp`'s
 * own `a:xfrm` offset, size UNCHANGED, sized directly from the DiagramML
 * constraint graph (ECMA-376 21.4.7); when smaller than the frame on an
 * axis, it is CENTRED there (verified on `basic-cycle--flat3.pptx`, hub-less,
 * and `basic-radial--hier5.pptx`, hub+ring - symmetric margins, never
 * one-sided).
 *
 * MS's "Cycle Algorithm" reference (Office 2007 SDK) gives only schema
 * defaults (`w`/`h`=100, `diam`=0, `sibSp`=0), not the packing formula, so the
 * RING RADIUS (`R0`) was reverse-engineered against real cached `dsp:sp`
 * geometry (only the FINAL box-fit step was wrong):
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
 * Verified against the full gallery: `basic-cycle`/`multidirectional-cycle`/
 * `continuous-cycle`/`basic-radial--hier5`/`radial-cycle--flat3` all PASS
 * (<=1% `maxDeltaFraction`) - a general fix.
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
import { resolveHubExpansion } from './smartart-layout-interpreter-cycle-hub-detect';
import { computeCycleRingLayout } from './smartart-layout-interpreter-cycle-ring';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { numericParam } from './smartart-layout-interpreter-model';
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
	declaringRoleChain?: readonly string[],
	sizeBox?: BoundingBox,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	// `satelliteCount` (`resolveHubToNodeRatio`'s own count-gated `dgm:rule`
	// override): only trustworthy when the hub was ALREADY pulled out of
	// `nodes` upstream (`hubAlreadyStripped`) - the common case for every
	// hub+ring family, where `nodes.length` already IS the satellite count.
	// When NOT already stripped, the `ctrShpMap="fNode"` fallback below may
	// still peel off `nodes[0]` as a hub, so `undefined` is safer than a guess.
	const {
		minGapRatio,
		heightOverWidth,
		absoluteGapPx,
		hubRatio,
		hubGapRatio,
		absoluteHubGapPx,
		sibTransBulgeRatio,
	} = resolveCycleRingParams(
		plan.node,
		index,
		hubAlreadyStripped ? nodes.length : undefined,
		declaringRoleChain,
	);
	// See `resolveHubExpansion`'s own doc comment for the full `ctrShpMap`/
	// `hubRatio`/`viaUserSize` derivation (round 46: routed through a shared
	// helper to keep this file under the repo's per-file line budget).
	const { hubNode, ringNodes, hubGeometry, knownNodeWidthPx } = resolveHubExpansion(
		nodes,
		plan,
		hubAlreadyStripped,
		hubRatio,
		hubGapRatio,
		absoluteHubGapPx,
		index,
		box,
		sizeBox,
	);
	const n = ringNodes.length;
	const startDeg = numericParam(plan.node, 'stAng', 0);
	const spanDeg = numericParam(plan.node, 'spanAng', 360);
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
		knownNodeWidthPx,
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
