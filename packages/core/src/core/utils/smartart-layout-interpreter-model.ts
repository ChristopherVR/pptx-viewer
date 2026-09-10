/**
 * SmartArt DiagramML interpreter - shared model helpers.
 *
 * These back the *real* (partial) layout interpreter that walks a parsed
 * `dgm:layoutDef` (`PptxSmartArtLayoutDefinition`) and produces per-node
 * geometry for the common `dgm:alg` families, instead of the legacy
 * name-based family switch. Pure TypeScript - no framework code, no DOM.
 *
 * Scope / honesty: the typed layout model flattens `dgm:forEach` / `dgm:choose`
 * wrappers when collecting nested `layoutNode`s (see
 * `smartart-layout-definition.ts`), so this interpreter does NOT run the full
 * recursive control-flow / constraint-reference solver. Instead it reads the
 * primary `dgm:alg` type to pick an arrangement family (lin / cycle /
 * hierRoot|hierChild / pyra / snake), reads the arranger's direction params
 * (`linDir`, `stAng`, `spanAng`), applies the scalar `dgm:constr` factors
 * (sp / sibSp / begPad / endPad and w/h aspect), and arranges the *actual
 * data-model nodes* accordingly. When the definition contains no recognised
 * arrangement algorithm the interpreter declines (`undefined`) and the caller
 * keeps the legacy approximation. This module only exposes the discovery +
 * constraint helpers.
 */

import type {
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtPresLayoutVars,
} from '../types';
import {
	isMeaningfulAux,
	PRIMARY_ALG,
	STRUCTURAL_ARRANGEMENT_KINDS,
} from './smartart-layout-interpreter-arrangement-kind';
import type { ArrangementPlan } from './smartart-layout-interpreter-arrangement-kind';
import { tunnelsPastOwnCompositeSlot } from './smartart-layout-interpreter-choose-depth';
import {
	hasStructuralDescendant,
	isContinuationForEach,
	isLayoutNodeOrDescendantOf,
	isTransitionOnlyChild,
	itemTemplateNodes,
	mapsSlots,
} from './smartart-layout-interpreter-composite-detect';
import { chooseAlgorithm } from './smartart-layout-interpreter-flow';
import { hasHierarchyDescendant } from './smartart-layout-interpreter-hierarchy-descendant';
import { hasPositionGuard } from './smartart-layout-interpreter-position-family';
import { treeMaxDepth, walkWithTreeLocation } from './smartart-layout-interpreter-tree-location';

export {
	clampByRules,
	findConstraint,
	ratioConstraint,
} from './smartart-layout-interpreter-constraints';
export {
	detectPositionFamily,
	hasPositionGuard,
} from './smartart-layout-interpreter-position-family';
export {
	isMeaningfulAux,
	PRIMARY_ALG,
	STRUCTURAL_ARRANGEMENT_KINDS,
} from './smartart-layout-interpreter-arrangement-kind';
export type {
	ArrangementKind,
	ArrangementPlan,
} from './smartart-layout-interpreter-arrangement-kind';

/**
 * Determine which arrangement algorithm drives the diagram.
 *
 * Precedence (highest first):
 *   1. hierarchy - any `hierRoot`/`hierChild` (org-chart / tree) always wins.
 *   2. choose - a `dgm:choose` decidable from `nodeCount` selects its branch's
 *      structural algorithm instead of the blind first-found one (never a
 *      pos-guarded child - see `smartart-layout-interpreter-position-
 *      family.ts`). Undecidable chooses fall through, EXCEPT: (a) when the
 *      node also independently qualifies as its own genuine composite (see
 *      (3)) AND the result was found by tunnelling 2+ `dgm:layoutNode` levels
 *      into one of its own child slots - `tunnelsPastOwnCompositeSlot`
 *      (`smartart-layout-interpreter-choose-depth.ts`, corpus-measured,
 *      monotonic) - the node's own composite identity wins instead; (b) when
 *      the resolved branch's own subtree contains a REAL `hierChild`/
 *      `hierRoot` construct - `hasHierarchyDescendant` (`smartart-layout-
 *      interpreter-hierarchy-descendant.ts`, SESSION 24) - a shallow packing
 *      wrapper (e.g. a labelled-hierarchy's own `hierFlow`) must not claim
 *      the diagram away from the REAL nested hierarchy, found LATER in the
 *      same walk but with no chance to compete once `chosen` is already set.
 *   3. composite - a `composite` whose child slots carry positioning
 *      constraints (maps data points into fixed slots). A passive composite
 *      wrapper is skipped so its inner arrangement wins.
 *   4. structural - the first `lin`/`cycle`/`pyra`/`snake` in document order.
 *   5. conn/sp/tx - only when they are the dominant/only algorithm (no
 *      structural or slot-mapping composite present) and carry
 *      constraints/children.
 *
 * `nodeCount` (the flat data-point count) is optional; when omitted the choose
 * step is skipped and the blind first-alg behaviour is preserved. Returns
 * `undefined` when nothing is recognised, so the caller keeps the legacy
 * family approximation.
 *
 * `presLayoutVars`, when supplied, lets a `func="var"` `dgm:if` decide its
 * branch (see `smartart-layout-interpreter-flow.ts`'s `WhenContext`). Every
 * `dgm:choose` visited is also given its declaring node's sibling position
 * (1-based), sibling count, depth, and the tree's max depth, so `"pos"`/
 * `"revPos"`/`"posEven"`/`"posOdd"`/`"depth"`/`"maxDepth"` are decidable here
 * too, not just `"cnt"`/`"var"`.
 *
 * `flatNodes`, when supplied, additionally lets a `func="cnt"` `dgm:if` whose
 * `@axis` needs real compound navigation decide too (ECMA-376 21.4.7.5 - see
 * `smartart-layout-interpreter-when.ts`'s `resolveAxisCount` doc comment).
 * Omitted keeps every such `cnt` on the coarser `nodeCount`-only comparison.
 */
export function discoverArrangement(
	definition: PptxSmartArtLayoutDefinition,
	nodeCount?: number,
	presLayoutVars?: PptxSmartArtPresLayoutVars,
	flatNodes?: PptxSmartArtNode[],
): ArrangementPlan | undefined {
	let hierarchy: PptxSmartArtLayoutNode | undefined;
	let chosen: ArrangementPlan | undefined;
	let compositeSlot: PptxSmartArtLayoutNode | undefined;
	let structural: ArrangementPlan | undefined;
	let aux: ArrangementPlan | undefined;
	const maxDepth = treeMaxDepth(definition.rootNode);
	const itemTemplates = new Set<PptxSmartArtLayoutNode>();
	itemTemplateNodes(definition.rootNode, itemTemplates);
	// Whole subtrees a BLOCKED tunnelled choose result (`tunnelledPastOwnSlot`
	// below) was already found in - a SIBLING alternative slot must not
	// independently re-assert the same wrong pick later; see `smartart-
	// layout-interpreter-choose-depth.ts`'s own doc comment.
	const blockedSubtreeRoots: PptxSmartArtLayoutNode[] = [];
	walkWithTreeLocation(definition.rootNode, (node, location) => {
		if (
			!hierarchy &&
			!chosen &&
			nodeCount !== undefined &&
			node.choose &&
			node.choose.length > 0 &&
			!isContinuationForEach(node) &&
			!blockedSubtreeRoots.some((root) => isLayoutNodeOrDescendantOf(root, node))
		) {
			const whenContext = {
				presLayoutVars,
				position: location.position,
				total: location.total,
				depth: location.depth,
				maxDepth,
				nodes: flatNodes,
			};
			// `chooseAlgorithm` keeps the winning branch's `dgm:param`s (see its doc comment).
			const resolvedAlg = chooseAlgorithm(node, nodeCount, whenContext);
			const type = resolvedAlg?.type;
			// A genuine org-chart layoutDef wraps its OWN root `hierChild`/
			// `hierRoot` algorithm in a `dgm:choose` - checked here too. Keeps the
			// ORIGINAL `node` fallback (not the param-carrying `withResolvedAlg`
			// below): hierarchy's own params resolve via `presLayoutVars`, and
			// hierarchy code elsewhere compares nodes by REFERENCE against the
			// original tree, which a `{...node}` copy would defeat.
			if (type === 'hierRoot' || type === 'hierChild') {
				hierarchy = node.children?.find((child) => child.algorithm?.type === type) ?? node;
			} else {
				const withResolvedAlg = resolvedAlg ? { ...node, algorithm: resolvedAlg } : node;
				const kind = type ? PRIMARY_ALG[type] : undefined;
				const rawArranger = node.children?.find(
					(child) =>
						child.algorithm?.type === type &&
						!isTransitionOnlyChild(child) &&
						!isContinuationForEach(child),
				);
				// A pos-guarded child describes ONE position's own hand-duplicated
				// branch, never a shared template for every point - disqualified
				// here like a transition-only/continuation-only child already is;
				// see `smartart-layout-interpreter-position-family.ts`'s own doc
				// comment (`hasPositionGuard`) for the corpus-measured derivation.
				const arranger =
					rawArranger && !hasPositionGuard(rawArranger) ? rawArranger : withResolvedAlg;
				// A STRUCTURAL choose result found by tunnelling 2+ `dgm:layoutNode`
				// levels into one of `node`'s OWN child slots (only when `node`
				// ALSO independently qualifies as its own genuine top-level
				// composite) describes that slot's small internal item arrangement,
				// not a competing whole-diagram algorithm - corpus-measured,
				// monotonic threshold; see `smartart-layout-interpreter-choose-
				// depth.ts`'s own doc comment.
				const tunnelledPastOwnSlot = tunnelsPastOwnCompositeSlot(
					node,
					nodeCount,
					whenContext,
					itemTemplates,
				);
				if (tunnelledPastOwnSlot) {
					blockedSubtreeRoots.push(node);
				}
				// A shallow `lin`/`cycle`/etc wrapper around a REAL nested
				// `hierChild`/`hierRoot` must not claim `chosen` - it would
				// permanently block the later, higher-precedence `hierarchy`
				// discovery via this walk's own `!hierarchy && !chosen` guard. See
				// `hasHierarchyDescendant`'s own doc comment (SESSION 24).
				const wrapsHierarchy =
					kind !== undefined &&
					STRUCTURAL_ARRANGEMENT_KINDS.has(kind) &&
					hasHierarchyDescendant(node, nodeCount, whenContext) &&
					false; // TEMP: disabled for A/B baseline comparison, SESSION 24
				if (
					kind &&
					STRUCTURAL_ARRANGEMENT_KINDS.has(kind) &&
					!tunnelledPastOwnSlot &&
					!wrapsHierarchy
				) {
					chosen = { kind, node: arranger };
				} else if (kind === 'composite' && !itemTemplates.has(arranger) && mapsSlots(arranger)) {
					// A count/direction-decidable `dgm:choose` picking `composite`
					// for one branch (a fixed grid, `cycleMatrixDiagram`'s small-N
					// layout) and something else for another must win with the SAME
					// priority as a chosen STRUCTURAL kind - otherwise the blind
					// alg walk below (`compositeSlot`) can commit to whichever
					// alternative's `dgm:alg` happens to appear FIRST in the raw
					// XML, ignoring the choose's actual data-driven decision (a
					// regression `target-list`/`captioned-pictures`/`vertical-
					// accent-list` measured once `mapsSlots` started recognising
					// arranger-declared slot constraints).
					chosen = { kind, node: arranger };
				}
			}
		}
		const type = node.algorithm?.type;
		if (!type) {
			return;
		}
		if (type === 'hierRoot' || type === 'hierChild') {
			hierarchy ??= node;
			return;
		}
		const kind = PRIMARY_ALG[type];
		if (!kind) {
			return;
		}
		if (kind === 'composite') {
			if (
				!compositeSlot &&
				!itemTemplates.has(node) &&
				!hasStructuralDescendant(node) &&
				mapsSlots(node)
			) {
				compositeSlot = node;
			}
			return;
		}
		if (STRUCTURAL_ARRANGEMENT_KINDS.has(kind)) {
			if (!isContinuationForEach(node)) {
				structural ??= { kind, node };
			}
			return;
		}
		if (!aux && isMeaningfulAux(node)) {
			aux = { kind, node };
		}
	});
	if (hierarchy) {
		return { kind: 'hierarchy', node: hierarchy };
	}
	if (chosen) {
		return chosen;
	}
	if (compositeSlot) {
		return { kind: 'composite', node: compositeSlot };
	}
	return structural ?? aux;
}

// Arranger `dgm:param` readers + linear flow-direction resolution moved to
// `smartart-layout-interpreter-flow-direction.ts` (the per-file line
// budget); re-exported here so every existing import site is unaffected.
export {
	algorithmParam,
	type FlowDirection,
	itemNode,
	numericParam,
	resolveFlowDirection,
} from './smartart-layout-interpreter-flow-direction';
