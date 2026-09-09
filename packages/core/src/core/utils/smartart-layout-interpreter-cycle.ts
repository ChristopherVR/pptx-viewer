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
 * 11/SESSION 8 - read this before trusting any older doc comment or
 * successor-file note that cites an "anisotropic fill-to-box" model or a
 * `w=347 h=232`-shaped figure for `basic-cycle--flat3.pptx`: those were
 * measured against a NOW-FIXED cached-reader bug that silently rescaled
 * `dsp:drawing` geometry to the frame, and do not match anything real
 * PowerPoint COM produces)
 *
 * Live COM (three independent measurement methods: `SmartArt.AllNodes`
 * shape geometry, "Convert to Shapes" + `GroupItems` walk, and a
 * pixel-bounding-box scan of an exported PNG cross-checked against the
 * slide's own aspect ratio - see `smartart-decompose.test.ts`'s "matches
 * live PowerPoint COM geometry" describe block) proved PowerPoint does NOT
 * independently stretch cached SmartArt content to fill its frame: a cached
 * shape's real geometry is `graphicFrame.origin + dsp:sp`'s own `a:xfrm`
 * offset, size UNCHANGED - i.e. content is sized directly from the
 * DiagramML constraint graph (ECMA-376 21.4.7), and when the result is
 * smaller than the frame on an axis, it is CENTRED there (measured on both
 * `basic-cycle--flat3.pptx`, hub-less, and `basic-radial--hier5.pptx`,
 * hub+ring: both show symmetric leading/trailing margins on every axis with
 * slack, to within rounding - never a one-sided "flush" margin, never an
 * independent per-axis stretch).
 *
 * MS's own "Cycle Algorithm" reference (Office 2007 SDK docs) declares the
 * relevant constraints and their SCHEMA defaults: `w`/`h` (node bounding box,
 * default 100), `diam` (ring diameter, default 0 = unset), `sibSp` ("minimum
 * distance between sibling shapes", default 0). Nothing in that reference (or
 * in any real gallery layoutDef examined) exposes the actual numeric packing
 * formula, so the RING RADIUS (`R0`) piece was reverse-engineered against the
 * cached `dsp:sp` geometry of genuine PowerPoint output (this part is
 * UNCHANGED by the round-11 correction - only the FINAL box-fit step was
 * wrong):
 *
 *   1. In a "natural" unit space where the node's own width is 1: place `n`
 *      points on a circle of radius `R0`, equally spaced by `spanAng/n` (full
 *      circle) or `/(n-1)` (arc), starting at `stAng` (same angle convention
 *      as the pre-existing `pointAngle`).
 *   2. `R0` is solved so the chord between any two ADJACENT points (the
 *      constant angular step above) equals `(1 + minGap) * 1`, i.e. the
 *      node's own width plus the required minimum gap: `2*R0*sin(step/2) = 1
 *      + minGap`.
 *   3. Compute the natural bounding box of all `n` unit-width (height = the
 *      item node's own declared `h:w` fact) node footprints centred at those
 *      points.
 *   4. Scale that bounding box by a SINGLE isotropic factor (`Math.min` of
 *      the two per-axis "fill" candidates - a "contain" fit, not a
 *      "cover"/stretch fit) and CENTRE the slack this leaves on whichever
 *      axis has it (`smartart-layout-interpreter-cycle-ring.ts`'s own module
 *      doc comment has the numeric derivation). Final node width = final
 *      node height / (item h:w fact) - i.e. a `heightOverWidth===1` item is
 *      ALWAYS a true circle/square, regardless of the box's own aspect.
 *
 * Verified against the full 227-fixture gallery corpus after landing this
 * correction: `basic-cycle`/`multidirectional-cycle`/`continuous-cycle`/
 * `basic-radial--hier5`/`radial-cycle--flat3` now all PASS (<=1%
 * `maxDeltaFraction`) - a real, general fix, not a per-fixture tune. See
 * `smartart-track-r-successor.md`'s own SESSION 8 for the full per-fixture
 * numbers and named residuals (`nondirectional-cycle`/`block-cycle`'s own
 * `spNode`-filler interaction, `diverging-radial`/`radial-list`/
 * `tabbed-arc`'s smaller residuals, and several fixtures with an unrelated
 * `shapeType` preset mismatch layered on top of the geometry).
 *
 * `ctrShpMap="fNode"` hub sizing reuses the SAME `R0`/scale computation
 * (`computeCycleRingLayout`'s `hubCenter`/`naturalHubRadius`): the hub is
 * centred at the ring's own natural centre (mapped through the same
 * isotropic scale as every ring node) and sized to the largest ellipse that
 * fits the remaining space between that centre and the nearest ring node,
 * which `smartart-layout-interpreter-hub.ts`'s `buildHubRenderedNode`
 * consumes.
 *
 * The ring's numeric fixed-point solve lives in `smartart-layout-
 * interpreter-cycle-ring.ts` and constraint reading (`sibSp`, item `h:w`, the
 * choose-branch-flattening workaround) in `smartart-layout-interpreter-cycle-
 * constraints.ts`; both re-exported here for existing callers. Pure
 * geometry; no framework code.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import {
	resolveCycleConstraintNode,
	resolveCycleRingParams,
} from './smartart-layout-interpreter-cycle-constraints';
import { computeCycleRingLayout } from './smartart-layout-interpreter-cycle-ring';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { algorithmParam, numericParam } from './smartart-layout-interpreter-model';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';
import { findCompositeItemShape } from './smartart-layout-shape-preset';
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
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	const { minGapRatio, heightOverWidth, absoluteGapPx, hubRatio, hubGapRatio, absoluteHubGapPx } =
		resolveCycleRingParams(plan.node, index);
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
	);

	const full = Math.abs(spanDeg) >= 360;
	const connectorCount = n > 0 ? (full ? n : Math.max(0, n - 1)) : 0;
	const ringCentre = ring.hubCenter;
	const connectors: RenderedConnector[] = Array.from({ length: connectorCount }, (_, i) => {
		const from = ring.centers[i];
		const to = ring.centers[(i + 1) % n];
		const midX = (from.x + to.x) / 2;
		const midY = (from.y + to.y) / 2;
		const pullRadius = Math.max(ring.nodeWidth, ring.nodeHeight) / 2;
		const pull =
			1 + (pullRadius * 0.15) / Math.max(1, Math.hypot(midX - ringCentre.x, midY - ringCentre.y));
		const controlX = ringCentre.x + (midX - ringCentre.x) * pull;
		const controlY = ringCentre.y + (midY - ringCentre.y) * pull;
		return {
			key: `${elementId}-cycle-conn-${i}`,
			d: `M${from.x},${from.y} Q${controlX},${controlY} ${to.x},${to.y}`,
		};
	});

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
	const renderedNodes: RenderedNode[] = ringNodes.map((node, i) => {
		const { x, y } = ring.centers[i];
		return presetBoxNode({
			key: `${elementId}-cycle-${node.id}-${i}`,
			x: x - ring.nodeWidth / 2,
			y: y - ring.nodeHeight / 2,
			width: ring.nodeWidth,
			height: ring.nodeHeight,
			node,
			index: i,
			total: n,
			palette,
			style,
			ctx,
			shape: itemShape,
			fallbackKind: 'circle',
			preserveEllipseAspect: true,
		});
	});
	if (hubNode) {
		const hubW = Math.max(1, ring.hubHalfWidth * 2);
		const hubH = Math.max(1, ring.hubHalfHeight * 2);
		renderedNodes.push(
			presetBoxNode({
				key: `${elementId}-cycle-hub-${hubNode.id}`,
				x: ring.hubCenter.x - hubW / 2,
				y: ring.hubCenter.y - hubH / 2,
				width: hubW,
				height: hubH,
				node: hubNode,
				index: 0,
				total: nodes.length,
				palette,
				style,
				ctx,
				shape: itemShape,
				fallbackKind: 'circle',
				preserveEllipseAspect: true,
			}),
		);
	}

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'cycle',
	};
}
