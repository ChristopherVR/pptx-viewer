/**
 * SmartArt DiagramML interpreter - `dgm:choose`-resolved structural
 * algorithm depth.
 *
 * `discoverArrangement`'s choose-branch (`smartart-layout-interpreter-
 * model.ts`) lets a decidable `dgm:choose` pick the diagram's WHOLE
 * structural algorithm, ranked above a genuine top-level `composite`
 * arranger by design (`cycle-matrix--fallback-n2.pptx`'s own `dgm:choose`
 * genuinely decides between `composite`/other alternatives for the WHOLE
 * diagram). That precedence is wrong when the choose-decided algorithm was
 * found by tunnelling several `dgm:layoutNode` levels DOWN INTO one of the
 * composite's own child slots, rather than at the winning branch's own
 * top level - `nested-target--hier5.pptx`'s `Name0` carries a direct
 * `dgm:alg type="composite"` AND a separate content-flattening `.choose`
 * (deciding which concentric target ring is live); that choose's winning
 * branch's raw XML nests `outerBox` -> `outerBoxChildren` -> a genuinely
 * choose-wrapped `dgm:alg type="lin"` TWO `dgm:layoutNode` levels down (a
 * small per-slot item arrangement for the 3 boxes inside ONE of `Name0`'s
 * own slots, not a competing whole-diagram algorithm).
 *
 * {@link structuralChooseAlgDepth} measures this: how many `dgm:layoutNode`
 * boundaries the winning branch's raw XML crosses before the FIRST
 * structural (`lin`/`cycle`/`pyra`/`snake`/`hierChild`/`hierRoot`) `dgm:alg`
 * is found, or `undefined` when none is found at all. Corpus-measured
 * (`bunx tsx` a one-off scratchpad script over the whole 227-fixture
 * gallery, every fixture whose root carries both a direct `composite` alg
 * and its own `.choose`) against every fixture where the resolved
 * structural type is `lin`: `accented-picture`, `horizontal-picture-list`,
 * `pyramid-list` (x3 datasets) all resolve at depth 1 and are all ALREADY
 * correctly `'linear'` (unaffected by any change here); `nested-target` is
 * the ONLY one at depth 2, and is the ONLY one that is WRONG (should be
 * `'composite'`) - a clean, monotonic separator across the measured corpus.
 * `discoverArrangement` uses `depth >= 2` (paired with the SAME "does this
 * node ALSO independently qualify as its own genuine composite" check
 * `compositeSlot`'s own assignment uses) to decide when to let the node's
 * own composite identity win instead of the tunnelled choose result.
 *
 * Deliberately a SEPARATE, standalone walk from `smartart-layout-
 * interpreter-choose-algorithm.ts`'s own `branchAlg` (not exported, and
 * that file explicitly documents TWO prior attempts to change its search
 * scope that each regressed a different fixture set - not a function to
 * extend casually) rather than an extension of it - this only ever reads
 * `PptxSmartArtLayoutNode.choose` via the already-exported `activeBranch`/
 * `nestedChooseBranch`/`localName` (`smartart-layout-interpreter-choose-
 * branch.ts`), so it needs no change to that file or to `branchAlg` at all.
 * Restricted to STRUCTURAL types only (never `composite`), mirroring
 * `branchAlg`'s own `CHOOSE_ALG_TYPES` set (duplicated here rather than
 * imported, since it is not exported).
 *
 * {@link tunnelsPastOwnCompositeSlot} is the single combined check
 * `discoverArrangement` actually calls. Blocking only `Name0`'s OWN attempt
 * was measured NOT sufficient on its own: `discoverArrangement`'s walk
 * visits every flattened choose-alternative unconditionally (chooseGuard
 * "is this branch live" filtering happens elsewhere, never during this
 * walk), so `nested-target`'s `middleBox`/`centerBox` - each flattened
 * onto `Name0.children` the exact same way `outerBox` is, each with its OWN
 * separate, SHALLOW-resolving nested `.choose` for its own 3-box `lin`
 * direction - would otherwise be visited next and independently re-assert
 * the identical wrong whole-diagram pick. `discoverArrangement` handles
 * this by excluding `node`'s WHOLE subtree (not just the specific crossed
 * path) once `tunnelsPastOwnCompositeSlot` returns `true` for it - see its
 * own `blockedSubtreeRoots` + `isLayoutNodeOrDescendantOf`
 * (`smartart-layout-interpreter-composite-detect.ts`).
 *
 * Pure TypeScript - no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode, XmlObject } from '../types';
import {
	activeBranch,
	localName,
	nestedChooseBranch,
} from './smartart-layout-interpreter-choose-branch';
import { hasStructuralDescendant, mapsSlots } from './smartart-layout-interpreter-composite-detect';
import type { WhenContext } from './smartart-layout-interpreter-when';

/** Mirrors `smartart-layout-interpreter-choose-algorithm.ts`'s own (non-exported) `CHOOSE_ALG_TYPES` - see this module's own doc comment for why this is a deliberate, standalone duplication. */
const STRUCTURAL_CHOOSE_ALG_TYPES = new Set([
	'lin',
	'cycle',
	'pyra',
	'snake',
	'hierChild',
	'hierRoot',
]);

/** A found structural `dgm:alg`, plus the ordered `@_name`s of every `dgm:layoutNode` crossed to reach it (outermost first) - see {@link structuralChooseAlgDepth}. */
export interface StructuralChooseAlgResult {
	depth: number;
	/** `@_name` of each `dgm:layoutNode` crossed on the way to the found alg, outermost first (`['outerBox', 'outerBoxChildren']` for `nested-target`'s own tunnelled `lin`) - empty when `depth` is 0 (found at the winning branch's own top level, no crossing at all). */
	crossedNames: string[];
}

/**
 * Depth-first search for the first structural `dgm:alg` in `raw`, counting
 * `dgm:layoutNode` boundaries crossed along the way (and recording each
 * crossed node's own `@_name`) - mirrors `branchAlg`'s own walk (unbounded
 * recursion through every key, a nested `dgm:choose` EVALUATED via
 * `nestedChooseBranch` rather than blindly recursed into) but additionally
 * threads a depth counter + name list, extended only when the walk descends
 * into a `dgm:layoutNode`.
 */
function findStructuralAlgDepth(
	raw: unknown,
	crossedNames: string[],
	nodeCount: number,
	context: WhenContext,
): StructuralChooseAlgResult | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	if (Array.isArray(raw)) {
		for (const item of raw) {
			const found = findStructuralAlgDepth(item, crossedNames, nodeCount, context);
			if (found) {
				return found;
			}
		}
		return undefined;
	}
	for (const [key, entry] of Object.entries(raw as XmlObject)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const name = localName(key);
		if (name === 'alg') {
			for (const candidate of Array.isArray(entry) ? entry : [entry]) {
				const type =
					candidate && typeof candidate === 'object'
						? String((candidate as XmlObject)['@_type'] ?? '')
						: '';
				if (STRUCTURAL_CHOOSE_ALG_TYPES.has(type)) {
					return { depth: crossedNames.length, crossedNames: [...crossedNames] };
				}
			}
		} else if (name === 'layoutNode') {
			for (const candidate of Array.isArray(entry) ? entry : [entry]) {
				if (!candidate || typeof candidate !== 'object') {
					continue;
				}
				const crossedName = String((candidate as XmlObject)['@_name'] ?? '');
				const found = findStructuralAlgDepth(
					candidate,
					[...crossedNames, crossedName],
					nodeCount,
					context,
				);
				if (found) {
					return found;
				}
			}
		} else if (name === 'choose') {
			for (const candidate of Array.isArray(entry) ? entry : [entry]) {
				if (!candidate || typeof candidate !== 'object') {
					continue;
				}
				const winningBranch = nestedChooseBranch(candidate as XmlObject, nodeCount, context);
				if (winningBranch) {
					const found = findStructuralAlgDepth(winningBranch, crossedNames, nodeCount, context);
					if (found) {
						return found;
					}
				}
			}
		} else if (entry && typeof entry === 'object') {
			const found = findStructuralAlgDepth(entry, crossedNames, nodeCount, context);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

/**
 * `node`'s own `.choose` (its parsed top-level `dgm:choose` list), resolved
 * to the `dgm:layoutNode`-crossing depth at which the first STRUCTURAL
 * (`lin`/`cycle`/`pyra`/`snake`/`hierChild`/`hierRoot`) algorithm is found
 * in the winning branch, plus the ordered `@_name`s of every `dgm:layoutNode`
 * crossed to reach it (kept for diagnostics/tests; `discoverArrangement`
 * itself keys its own exclusion off `node` as a whole - see
 * {@link tunnelsPastOwnCompositeSlot}) - or `undefined` when `node` has no
 * choose, no branch is decidable, or none resolves to a structural type at
 * all. See this module's own doc comment for the full derivation and the
 * corpus measurement behind the `depth >= 2` threshold.
 */
export function structuralChooseAlgDepth(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	context: WhenContext,
): StructuralChooseAlgResult | undefined {
	if (!node.choose || node.choose.length === 0) {
		return undefined;
	}
	for (const choose of node.choose) {
		const branch = activeBranch(choose, nodeCount, context);
		if (branch === undefined) {
			continue;
		}
		const found = findStructuralAlgDepth(branch, [], nodeCount, context);
		if (found) {
			return found;
		}
	}
	return undefined;
}

/**
 * `true` when `node` ALSO independently qualifies as its own genuine
 * top-level composite (the SAME three conditions `discoverArrangement`'s
 * own `compositeSlot` assignment checks: a direct, non-choose-wrapped
 * `composite` algorithm, not a per-item template, no DIRECT structural
 * descendant of its own, and real mapped slots) AND its `.choose` resolves
 * a structural type by tunnelling 2+ `dgm:layoutNode` levels down - see
 * this module's own doc comment for the corpus-measured, monotonic
 * threshold. `discoverArrangement` uses this single combined check to
 * decide when to let `node`'s own composite identity win instead of a
 * choose result that only ever described one of its own child slots.
 */
export function tunnelsPastOwnCompositeSlot(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	context: WhenContext,
	itemTemplates: ReadonlySet<PptxSmartArtLayoutNode>,
): boolean {
	const looksLikeOwnComposite =
		node.algorithm?.type === 'composite' &&
		!itemTemplates.has(node) &&
		!hasStructuralDescendant(node) &&
		mapsSlots(node);
	if (!looksLikeOwnComposite) {
		return false;
	}
	const found = structuralChooseAlgDepth(node, nodeCount, context);
	return found !== undefined && found.depth >= 2;
}
