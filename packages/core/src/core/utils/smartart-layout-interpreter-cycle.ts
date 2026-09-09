/**
 * SmartArt DiagramML interpreter - cycle (`cycle`) arranger.
 *
 * Places the data-model points evenly around a centre, honouring the `stAng`
 * (start angle) and `spanAng` (sweep) algorithm parameters, and draws light
 * arc connectors between consecutive points. When `ctrShpMap`
 * (`dgm:param[@type=ctrShpMap]`) is `fNode`, the FIRST data point is pulled off
 * the ring and placed at the box centre instead - PowerPoint's "Radial Cycle"
 * family layouts use this for a hub node the ring nodes surround.
 *
 * ## Node sizing (COM-verified derivation, not a per-layout guess)
 *
 * MS's own "Cycle Algorithm" reference (Office 2007 SDK docs) declares the
 * relevant constraints and their SCHEMA defaults: `w`/`h` (node bounding box,
 * default 100), `diam` (ring diameter, default 0 = unset), `sibSp` ("minimum
 * distance between sibling shapes", default 0). Nothing in that reference (or
 * in any real gallery layoutDef examined) exposes the actual numeric packing
 * formula, so it was reverse-engineered against the cached `dsp:sp` geometry
 * of genuine PowerPoint output, then cross-checked against a SECOND,
 * independently-different layout to rule out overfitting one sample:
 *
 *   - `basic-cycle--flat3.pptx` ("cycle2", declares `sibSp` `fact="0.5"`, no
 *     `h` fact on its item node -> default aspect 1): cached w=347 h=232
 *     (box 867x533). Reproduced EXACTLY (w=346.8, h=231.8) by:
 *     1. In a "natural" unit space where the node's own width is 1: place
 *        `n` points on a circle of radius `R0`, equally spaced by `spanAng/n`
 *        (full circle) or `/(n-1)` (arc), starting at `stAng` (same angle
 *        convention as the pre-existing `pointAngle`).
 *     2. `R0` is solved so the chord between any two ADJACENT points (the
 *        constant angular step above) equals `(1 + minGap) * 1`, i.e. the
 *        node's own width plus the required minimum gap: `2*R0*sin(step/2)
 *        = 1 + minGap`.
 *     3. Compute the natural bounding box of all `n` unit-width (height =
 *        the item node's own declared `h:w` fact) node footprints centred at
 *        those points.
 *     4. Scale that bounding box independently on X and Y to exactly fill
 *        the diagram box (an ANISOTROPIC scale - this is what turns
 *        circular nodes into the wide ellipses real "Basic Cycle" renders:
 *        the natural arrangement's own aspect essentially never matches the
 *        diagram frame's aspect). Final node width = scaleX, final node
 *        height = (item h:w fact) * scaleY.
 *   - `multidirectional-cycle--hier5.pptx` (`sibSp` `fact="0.65"`, item `h`
 *     fact `0.5`): reproduced EXACTLY (w=327.2 vs cached 327, h=138.15 vs
 *     cached 138) by the SAME procedure with its own declared `sibSp`/`h`,
 *     confirming the derivation generalises rather than being fit to one
 *     sample.
 *   - `nondirectional-cycle`/`block-cycle` (`sibSp` `fact="0.15"`, a smaller
 *     value than either sample above) reproduce the SAME w=347 as
 *     `basic-cycle` despite a much smaller declared `sibSp`. Per MS's own
 *     wording ("sibSp: MINIMUM distance") this is consistent: `sibSp` is a
 *     floor the algorithm may exceed, never a target it hits exactly. These
 *     two layouts additionally declare a `spNode` (a small filler shape
 *     sitting directly on the connecting line between siblings, unlike a
 *     curved `sibTrans` arc which can bow into existing space without
 *     needing extra room) whose own width is declared relative to `sibSp`;
 *     accounting for it lands within ~2% here (see `smartart-layout-
 *     interpreter-cycle-constraints.ts`'s `DEFAULT_MIN_GAP_RATIO` doc
 *     comment) but not the exact match the two simpler layouts get - the
 *     precise interaction between a `spNode`-shaped filler and the minimum
 *     gap was not fully pinned down and is flagged as a known residual in
 *     the round-3 report rather than papered over with a per-layout number.
 *
 * `ctrShpMap="fNode"` hub sizing reuses the SAME `R0`/scale computation
 * (`computeCycleRingLayout`'s `hubCenter`/`naturalHubRadius`): the hub is
 * centred at the ring's own natural centre (mapped through the same
 * anisotropic scale as every ring node) and sized to the largest ellipse
 * that fits the remaining space between that centre and the nearest ring
 * node, which `smartart-layout-interpreter-hub.ts`'s `buildHubRenderedNode`
 * consumes instead of its previous fixed `0.3x` placeholder (see that
 * module's own doc comment for the one-line wiring change). This is a much
 * closer approximation for the common 3+ satellite case; it is a known,
 * reported weaker approximation for a 2-satellite ring (`radial-cycle`'s
 * `flat3` dataset), where the "natural" pre-scale footprint is a degenerate
 * straight line and the anisotropic scale has no informative aspect to work
 * from on one axis (see `smartart-layout-interpreter-cycle-ring.ts`'s doc
 * comment).
 *
 * The ring's numeric fixed-point solve lives in `smartart-layout-
 * interpreter-cycle-ring.ts` and constraint reading (`sibSp`, item `h:w`,
 * the choose-branch-flattening workaround) in `smartart-layout-interpreter-
 * cycle-constraints.ts`; both re-exported here for existing callers.
 *
 * Pure geometry; no framework code.
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
	const { minGapRatio, heightOverWidth, absoluteGapPx, hubRatio, hubGapRatio } =
		resolveCycleRingParams(plan.node, index);
	// `ctrShpMap="fNode"` pulls the first data point into a hub at the ring's
	// own natural centre; every other value (including absent, the common
	// case) puts every point on the ring, matching the pre-existing
	// behaviour. Real gallery hub layouts (`radial-cycle`, `basic-radial`,
	// `diverging-radial`, `converging-radial`, `radial-venn`, ...) ARE
	// already stripped of their hub point upstream by
	// `smartart-layout-interpreter.ts`'s `runArrangement` (`detectHubExpansion`
	// + `buildHubRenderedNode`, called once per diagram, BEFORE this function
	// ever runs) - `hubAlreadyStripped` (set by that caller) is essential,
	// not a fallback nicety: `ctrShpMap` stays `'fNode'` on `plan.node.algorithm`
	// regardless of whether the hub was already pulled out, so without this
	// flag `arrangeCycle` re-detects a SECOND, PHANTOM hub from the first
	// SATELLITE in its own already-hub-free `nodes` array, corrupting every
	// hub-bearing fixture (COM-verified regression: `radial-cycle--flat3.pptx`'s
	// 2 satellites rendered as a bogus box-sized "hub" + a single degenerate
	// leftover ring node instead of a real 2-node ring). Defaults `false` so a
	// caller that hands the hub point straight through unstripped (a unit
	// test, or a hub pattern `detectHubExpansion` does not recognise) keeps
	// the old internal-detection behaviour.
	//
	// `!hubRatio`: `radial-list--hier5.pptx`'s own shape - THREE top-level
	// "node" data points (no separate top-level hub point at all), plus a
	// SEPARATE, always-present `centerShape` layoutNode (gated by its own
	// `dgm:choose`, rendering a decorative image, invisible to text-based
	// comparison) - the composite's own `w for=ch forName=node ... refForName
	// ="centerShape"` constraint (`resolveHubToNodeRatio`, surfaced here as
	// `hubRatio`) is the SAME declarative signal `resolveRingItemNode` already
	// uses to recognise "this composite structurally names its own hub".
	// `detectHubExpansion` (`smartart-layout-interpreter-hub.ts`) never
	// strips anything for this shape (it requires EXACTLY ONE top-level
	// point, radial-list has three), so `hubAlreadyStripped` stays `false`
	// and this function's OWN `ctrShpMap="fNode"` fallback fired instead -
	// wrongly, since `centerShape` already fully accounts for the hub
	// concept: PowerPoint's own cached drawing renders all 3 "node" points as
	// EQUAL-SIZED satellites with no distinguishable 4th hub shape at all.
	// Firing the fallback anyway silently dropped a real satellite to a
	// degenerate 2-node ring (COM-verified regression, `radial-list--hier5
	// .pptx`: `n` collapsed 3 -> 2, and the `cnt=3` choose branch's own
	// `stAng`/`spanAng` - calibrated for exactly 3 ring points - produced a
	// collinear (both points sharing the same x) degenerate pair on the
	// SMALLER `n=2`, tripping the ring math's own defensive isotropic
	// fallback). Never fires when `hubAlreadyStripped` is already `true`
	// (the common case, `basic-radial`/`diverging-radial`/`converging-radial`
	// ALSO resolve `hubRatio` but are already correctly stripped upstream, so
	// this clause is a no-op for them - verified via the full gallery sweep).
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
	const hubGeometry =
		hubRatio && hubGapRatio !== undefined
			? { factor: hubRatio.factor, gapRatio: hubGapRatio }
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
