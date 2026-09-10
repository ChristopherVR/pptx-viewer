/**
 * SmartArt DiagramML interpreter - `ctrShpMap="fNode"` hub detection for the
 * `cycle` arranger.
 *
 * Split out of `smartart-layout-interpreter-cycle.ts` to keep that file
 * under the repo's per-file line budget. Pure geometry/decision logic; no
 * framework code.
 */

import type { PptxSmartArtNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import type { HubToNodeRatio } from './smartart-layout-interpreter-cycle-hub-ratio';
import { resolveViaUserSizeNodeWidthPx } from './smartart-layout-interpreter-cycle-hub-ratio-usersize';
import type { HubRingGeometry } from './smartart-layout-interpreter-cycle-ring';
import { algorithmParam } from './smartart-layout-interpreter-model';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import type { BoundingBox } from './smartart-layout-types';

/** Everything `arrangeCycle` needs about whether/how this ring has a `ctrShpMap="fNode"` hub. */
export interface HubExpansion {
	hasHub: boolean;
	hubNode: PptxSmartArtNode | undefined;
	ringNodes: PptxSmartArtNode[];
	/** Centre-to-satellite sizing/gap, when a hub is present and `sp` resolves. */
	hubGeometry: HubRingGeometry | undefined;
	/** The known absolute node width for a nested `n===1` hub+satellite ring (round 46). */
	knownNodeWidthPx: number | undefined;
}

/**
 * `ctrShpMap="fNode"` pulls the first data point into a hub at the ring's own
 * natural centre; every other value (including absent) puts every point on
 * the ring. Real gallery hub layouts (`radial-cycle`, `basic-radial`,
 * `diverging-radial`, `converging-radial`, `radial-venn`, ...) are already
 * stripped of their hub point upstream (`hubAlreadyStripped`) - essential,
 * not a fallback nicety: `ctrShpMap` stays `'fNode'` on `plan.node.algorithm`
 * regardless, so without this flag `arrangeCycle` would re-detect a SECOND,
 * PHANTOM hub from the first satellite in its own already-hub-free `nodes`.
 *
 * `!hubRatio`: `radial-list--hier5.pptx`'s own shape - THREE top-level "node"
 * points, plus a SEPARATE, always-present `centerShape` (a decorative image)
 * - the composite's own direct `w ... refForName="centerShape"` cross-
 * reference (`hubRatio`) is the SAME signal that "this composite already
 * structurally names its own hub", so the `ctrShpMap` fallback below must
 * NOT ALSO peel `nodes[0]` (COM-verified: doing so collapsed a real
 * 3-satellite ring to a degenerate 2).
 *
 * `hubRatio.viaUserSize` (round 46): unlike a direct cross-reference, a
 * `userS`-ancestor-chain resolution carries no "already structurally named"
 * meaning, so it must NOT suppress the peel either -
 * `radial-cluster--hier5.pptx`'s nested `cycle_3` (hub "Four", satellite
 * "Five", both independently sized off the SAME diagram-wide fact) resolves
 * `hubRatio` this way yet still needs the peel to render its hub separately.
 *
 * `hubGeometry`: a hub+ring composite's own centre-to-satellite `r0` is
 * governed by `hubGapRatio` (the `sp` space between the hub's edge and each
 * satellite's), independent of `hubAlreadyStripped` - the satellites still
 * ring AROUND the hub even when it was already pulled out and rendered
 * separately. A `viaUserSize` hub's own `factor` is the diagram-wide
 * item:hub ratio BOTH independently anchor to, not their size relative to
 * EACH OTHER, so they are the SAME absolute size (`factor: 1`).
 *
 * `knownNodeWidthPx`: a genuinely NESTED single-satellite ring (`n===1`, a
 * `viaUserSize` hub) has no independent box-fit to derive its node width
 * from - resolve the SAME absolute pixel size `resolveUserSizeItemBoxPx`
 * already gives a flat repeater's `userS` item, so both the hub and
 * satellite honour the real diagram-wide fact instead of stretching to fill
 * the box.
 */
export function resolveHubExpansion(
	nodes: PptxSmartArtNode[],
	plan: ArrangementPlan,
	hubAlreadyStripped: boolean,
	hubRatio: HubToNodeRatio | undefined,
	hubGapRatio: number | undefined,
	absoluteHubGapPx: number | undefined,
	index: ConstraintIndex,
	box: BoundingBox,
	sizeBox: BoundingBox | undefined,
): HubExpansion {
	const hasHub =
		!hubAlreadyStripped &&
		(!hubRatio || hubRatio.viaUserSize === true) &&
		algorithmParam(plan.node, 'ctrShpMap') === 'fNode' &&
		nodes.length > 0;
	const hubNode = hasHub ? nodes[0] : undefined;
	const ringNodes = hasHub ? nodes.slice(1) : nodes;
	const hubGeometry =
		hubRatio && (hubGapRatio !== undefined || absoluteHubGapPx !== undefined)
			? { factor: hubRatio.viaUserSize ? 1 : hubRatio.factor, gapRatio: hubGapRatio ?? 0 }
			: undefined;
	const knownNodeWidthPx =
		ringNodes.length === 1 && hubRatio?.viaUserSize
			? resolveViaUserSizeNodeWidthPx(hubRatio, index, box, sizeBox ?? box)
			: undefined;
	return { hasHub, hubNode, ringNodes, hubGeometry, knownNodeWidthPx };
}
