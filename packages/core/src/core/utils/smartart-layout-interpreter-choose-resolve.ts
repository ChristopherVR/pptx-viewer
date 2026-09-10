/**
 * SmartArt DiagramML interpreter - non-hierarchy `dgm:choose` branch
 * classification for `discoverArrangement`.
 *
 * Split out of `smartart-layout-interpreter-model.ts` (the repo's per-file
 * line budget): given a `dgm:choose`-bearing `node` whose winning branch's
 * algorithm has already been resolved (`chooseAlgorithm`, NOT a `hierRoot`/
 * `hierChild` - that case stays in `discoverArrangement` itself, since it
 * compares nodes by reference against the original tree), decides whether
 * that branch should win `chosen`, or is disqualified - a slot's own tiny
 * internal arrangement, a pos-guarded per-position template, a tunnelled
 * result, or an already-resolved composite's own named alternative slot.
 * Pure TypeScript - no framework code, no DOM.
 */

import type {
	PptxSmartArtLayoutAlgorithm,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import type { ArrangementPlan } from './smartart-layout-interpreter-arrangement-kind';
import {
	PRIMARY_ALG,
	STRUCTURAL_ARRANGEMENT_KINDS,
} from './smartart-layout-interpreter-arrangement-kind';
import { tunnelsPastOwnCompositeSlot } from './smartart-layout-interpreter-choose-depth';
import { isMappedSlotAlternative } from './smartart-layout-interpreter-composite-alternative';
import {
	isContinuationForEach,
	isTransitionOnlyChild,
	mapsSlots,
} from './smartart-layout-interpreter-composite-detect';
import { hasHierarchyDescendant } from './smartart-layout-interpreter-hierarchy-descendant';
import { hasPositionGuard } from './smartart-layout-interpreter-position-family';
import type { WhenContext } from './smartart-layout-interpreter-when';

export interface ChooseResolution {
	chosen: ArrangementPlan | undefined;
	/** `true` when `node` should be added to `blockedSubtreeRoots` (a tunnelled result). */
	blockSubtree: boolean;
}

/**
 * Classify a `dgm:choose`-resolved non-hierarchy branch - see this module's
 * own doc comment for the precedence this implements (mirrors
 * `discoverArrangement`'s own precedence list, items 2-3).
 */
export function resolveNonHierarchyChoose(
	node: PptxSmartArtLayoutNode,
	resolvedAlg: PptxSmartArtLayoutAlgorithm | undefined,
	nodeCount: number,
	whenContext: WhenContext & { nodes?: PptxSmartArtNode[] },
	itemTemplates: ReadonlySet<PptxSmartArtLayoutNode>,
	compositeSlot: PptxSmartArtLayoutNode | undefined,
): ChooseResolution {
	const type = resolvedAlg?.type;
	const withResolvedAlg = resolvedAlg ? { ...node, algorithm: resolvedAlg } : node;
	const kind = type ? PRIMARY_ALG[type] : undefined;
	const rawArranger = node.children?.find(
		(child) =>
			child.algorithm?.type === type &&
			!isTransitionOnlyChild(child) &&
			!isContinuationForEach(child),
	);
	// A pos-guarded child describes ONE position's own hand-duplicated branch,
	// never a shared template for every point - disqualified here like a
	// transition-only/continuation-only child already is; see
	// `smartart-layout-interpreter-position-family.ts`'s own doc comment
	// (`hasPositionGuard`) for the corpus-measured derivation.
	const arranger = rawArranger && !hasPositionGuard(rawArranger) ? rawArranger : withResolvedAlg;
	// A STRUCTURAL choose result found by tunnelling 2+ `dgm:layoutNode` levels
	// into one of `node`'s OWN child slots (only when `node` ALSO independently
	// qualifies as its own genuine top-level composite) describes that slot's
	// small internal item arrangement, not a competing whole-diagram algorithm
	// - corpus-measured, monotonic threshold; see `smartart-layout-interpreter-
	// choose-depth.ts`'s own doc comment.
	const tunnelledPastOwnSlot = tunnelsPastOwnCompositeSlot(
		node,
		nodeCount,
		whenContext,
		itemTemplates,
	);
	// A shallow `lin`/`cycle`/etc wrapper around a REAL nested `hierChild`/
	// `hierRoot` must not claim `chosen` - it would permanently block the
	// later, higher-precedence `hierarchy` discovery via the caller's own
	// `!hierarchy && !chosen` guard. See `hasHierarchyDescendant`'s own doc
	// comment (SESSION 24).
	const wrapsHierarchy =
		kind !== undefined &&
		STRUCTURAL_ARRANGEMENT_KINDS.has(kind) &&
		hasHierarchyDescendant(node, nodeCount, whenContext);
	// ROUND 42: `node` reached through one of `compositeSlot`'s OWN named
	// slots describes that slot's own internal arrangement, not a competing
	// algorithm - see `isMappedSlotAlternative`'s own doc comment.
	const isSlotAlternative = isMappedSlotAlternative(compositeSlot, node);
	if (
		kind &&
		STRUCTURAL_ARRANGEMENT_KINDS.has(kind) &&
		!tunnelledPastOwnSlot &&
		!wrapsHierarchy &&
		!isSlotAlternative
	) {
		return { chosen: { kind, node: arranger }, blockSubtree: tunnelledPastOwnSlot };
	}
	if (
		kind === 'composite' &&
		!itemTemplates.has(arranger) &&
		mapsSlots(arranger) &&
		!isSlotAlternative
	) {
		// A count/direction-decidable `dgm:choose` picking `composite` for one
		// branch (a fixed grid, `cycleMatrixDiagram`'s small-N layout) and
		// something else for another must win with the SAME priority as a
		// chosen STRUCTURAL kind - otherwise the blind alg walk below
		// (`compositeSlot`) can commit to whichever alternative's `dgm:alg`
		// happens to appear FIRST in the raw XML, ignoring the choose's actual
		// data-driven decision (a regression `target-list`/`captioned-
		// pictures`/`vertical-accent-list` measured once `mapsSlots` started
		// recognising arranger-declared slot constraints).
		return { chosen: { kind, node: arranger }, blockSubtree: tunnelledPastOwnSlot };
	}
	return { chosen: undefined, blockSubtree: tunnelledPastOwnSlot };
}
