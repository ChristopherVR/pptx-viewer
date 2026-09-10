/**
 * SmartArt DiagramML interpreter - top-level point selection + hub
 * detection for `runArrangement`.
 *
 * Split out of `smartart-layout-interpreter.ts` (the repo's per-file line
 * budget): resolves which data-model points `dispatchArrangement` actually
 * arranges, including the "hub + satellites" nested-forEach expansion (a
 * container point whose OWN children a NESTED forEach arranges - see
 * `smartart-layout-interpreter-hub.ts`). Pure TypeScript - no framework
 * code, no DOM.
 */

import type { PptxSmartArtConnection, PptxSmartArtNode } from '../types';
import { applyChildOrder } from './smartart-hierarchy-child-order';
import { buildChildOrder } from './smartart-layout-interpreter-connector-order';
import { selectArrangedNodes } from './smartart-layout-interpreter-flow';
import { detectHubExpansion } from './smartart-layout-interpreter-hub';
import type { HubExpansion } from './smartart-layout-interpreter-hub';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { smartArtChildrenOf, topLevelSmartArtNodes } from './smartart-node-tree-axis';

export interface ArrangedSelection {
	childrenOf: Map<string, PptxSmartArtNode[]>;
	hub: HubExpansion | undefined;
	arranged: PptxSmartArtNode[];
}

/**
 * Resolve the points `dispatchArrangement` arranges, and the hub expansion
 * (if any) so the caller can build the hub's own rendered node separately.
 *
 * A top-level `composite` arranger (`gear`, `balance`) maps its NAMED slots
 * onto the top-level points directly via each slot's OWN `presOf` (see
 * `arrangeComposite`'s module doc comment); it typically declares several
 * SEPARATE single-point `forEach`s (one per slot, e.g. `gear2`'s own
 * `st="2" cnt="1"`), which `selectArrangedNodes`'s single "driving iterator"
 * model was never built to combine, so it is bypassed here in favour of the
 * plain top-level point list every slot's ordinal position already indexes
 * into. Known gap: a composite with SEVEN independent single-point
 * `forEach`s, one per named "ring" slot (`target-list`'s concentric rings)
 * still needs a real multi-forEach walk - see the Track S/R handoff notes
 * for the exact diagnosis.
 *
 * ROUND 42: hub detection is skipped entirely for a `composite` plan - its
 * children are named SLOTS, not ring satellites, and `detectHubExpansion`'s
 * raw-XML shape check can wrongly match the composite's own root (`Name0`)
 * as a hub+satellite ring.
 *
 * `hub.satellites` (`smartArtChildrenOf`, built from flat `parentId`
 * pointers) is in `dgm:ptLst` declaration order, which is NOT necessarily
 * true ring order - the SAME class of bug `buildChildOrder`/
 * `applyChildOrder` already fixes for `arrangeHierarchy` (see their doc
 * comments), reused verbatim here: every satellite shares the SAME parent
 * (the hub), so `applyChildOrder`'s same-parent-only scoping is trivially
 * satisfied and this is a plain, safe sort by `dgm:cxn`'s own `srcOrd`.
 * COM-verified regression against `basic-radial--hier5.pptx`/
 * `diverging-radial--hier5.pptx`: without this, satellites landed at the
 * wrong ring position (rotated relative to the cached drawing) even though
 * their SIZE already matched after `resolveHubToNodeRatio`.
 */
export function selectArrangedPoints(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	flat: PptxSmartArtNode[],
	connections: PptxSmartArtConnection[] | undefined,
): ArrangedSelection {
	const roots = topLevelSmartArtNodes(nodes);
	const childrenOf = smartArtChildrenOf(nodes, connections);
	const preArranged =
		plan.kind === 'composite'
			? roots.length > 0
				? roots
				: flat
			: selectArrangedNodes(plan.node, flat, roots);
	const hub =
		plan.kind === 'composite' ? undefined : detectHubExpansion(plan.node, preArranged, childrenOf);
	const arranged = hub
		? applyChildOrder(hub.satellites, buildChildOrder(connections))
		: preArranged;
	return { childrenOf, hub, arranged };
}
