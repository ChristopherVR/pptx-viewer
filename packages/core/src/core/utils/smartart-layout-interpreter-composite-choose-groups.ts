/**
 * SmartArt DiagramML interpreter - `dgm:choose` first-match-wins group
 * resolution.
 *
 * `smartart-layout-definition.ts`'s `nestedLayoutNodes` flattens every
 * `dgm:choose` branch onto its parent `layoutNode`'s own `.children`
 * unconditionally (never evaluating conditions at parse time), so a real
 * ECMA-376 `dgm:choose` - "evaluate each `dgm:if` in order, the FIRST whose
 * condition holds wins, siblings never coexist" - becomes an ordinary flat
 * sibling list once parsed. `smartart-layout-interpreter-composite-
 * choose.ts`'s `collectRawCandidates` used to treat every choose-flattened
 * sibling as an INDEPENDENT candidate (each checked only against its own
 * `chooseGuard` AND-chain), which is correct for a genuinely independent
 * set of guarded slots (`cycle-matrix`'s `child1group`..`child4group`, each
 * gated on a DIFFERENT top-level point) but wrong for a MUTUALLY EXCLUSIVE
 * family: `balance--hier5.pptx`'s `balance_NN`/`left_NN_M`/`right_NN_M`
 * (127 members across ~30 nested `dgm:choose` instances) describes ONE
 * "pick exactly one arrangement" decision tree, and evaluating every branch
 * independently can leave SEVERAL simultaneously "live" when the real
 * DiagramML semantics wants exactly one.
 *
 * {@link selectFirstMatchChildren} recovers the real semantics from
 * `PptxSmartArtLayoutNode.chooseGroups` (populated during flattening - see
 * that field's own doc comment): for every distinct `dgm:choose` GROUP
 * reachable from a list of siblings, keep only the LOWEST-ordinal member
 * whose own branch condition holds (an `dgm:else` entry, `guard`
 * `undefined`, always holds when reached - it is the fallback), and drop
 * every other member of that SAME group (and, since filtering runs BEFORE
 * the caller recurses into a dropped sibling's own subtree, everything
 * nested inside it too). A sibling with NO `chooseGroups` at all (never
 * reached through a `dgm:choose`) is always kept, unaffected.
 *
 * Pure TypeScript - no framework code, no DOM.
 */

import type {
	PptxSmartArtIteratorAttributes,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	PptxSmartArtWhen,
} from '../types';
import { resolveAxisNodes } from './smartart-layout-interpreter-axis-count';
import { evaluateWhen } from './smartart-layout-interpreter-when';

/** One `chooseGroups` ordinal's own guard, plus the `forEachOrigin` of the layoutNode it was collected from - the anchor a `func="maxDepth"`/`"cnt"`-family `@axis` condition in that guard needs (see {@link winningOrdinalFor}). */
interface OrdinalEntry {
	guard: PptxSmartArtWhen | undefined;
	forEachOrigin: PptxSmartArtIteratorAttributes | undefined;
}

/**
 * The winning ordinal for one `dgm:choose` GROUP: the lowest ordinal among
 * every member of `guardsByOrdinal` (already deduplicated by ordinal - every
 * member sharing one `(groupId, ordinal)` pair carries the SAME branch, so
 * one representative condition suffices) whose own condition resolves
 * `!== false` (an `undefined` guard - a `dgm:else` entry - always resolves
 * true, matching every other `chooseGuard` consumer's own "no condition ->
 * allow" convention). `undefined` when NO member's condition resolves true
 * (every branch decidably false, or the group is otherwise empty) - callers
 * treat this permissively (see {@link selectFirstMatchChildren}), matching
 * the pre-existing "undecidable defaults to allow" philosophy rather than
 * dropping content this cannot confidently resolve.
 *
 * Each ordinal's OWN `forEachOrigin` (round 13) resolves the anchor a
 * `func="maxDepth"`-family condition's `@axis` navigates from
 * (`radial-cluster--hier5.pptx`'s `singleCycle`/`textCenter` choose, both
 * anchored to `Name38`'s `axis="ch" cnt="1"` binding) - see
 * `evaluateWhen`'s `maxDepth` case.
 */
function winningOrdinalFor(
	guardsByOrdinal: Map<number, OrdinalEntry>,
	nodeCount: number,
	flat: PptxSmartArtNode[],
): number | undefined {
	const ordinals = [...guardsByOrdinal.keys()].sort((a, b) => a - b);
	for (const ordinal of ordinals) {
		const entry = guardsByOrdinal.get(ordinal);
		const origin = entry?.forEachOrigin;
		const anchor =
			origin?.axis && origin.axis.length > 0
				? resolveAxisNodes(flat, origin.axis, origin.pointTypes, origin.start, origin.count)
				: undefined;
		const allows =
			!entry?.guard || evaluateWhen(entry.guard, nodeCount, { nodes: flat, anchor }) !== false;
		if (allows) {
			return ordinal;
		}
	}
	return undefined;
}

/**
 * Filter `children` to first-match-wins survivors - see this module's own
 * doc comment. A fast, allocation-free no-op when none of `children` carries
 * `chooseGroups` at all (every fixture NOT shaped like `balance`'s own
 * mutually-exclusive family), so every pre-existing caller/fixture is
 * byte-for-byte unaffected.
 */
export function selectFirstMatchChildren(
	children: PptxSmartArtLayoutNode[],
	flat: PptxSmartArtNode[],
): PptxSmartArtLayoutNode[] {
	if (children.every((child) => (child.chooseGroups?.length ?? 0) === 0)) {
		return children;
	}
	const guardsByGroup = new Map<string, Map<number, OrdinalEntry>>();
	for (const child of children) {
		for (const entry of child.chooseGroups ?? []) {
			let byOrdinal = guardsByGroup.get(entry.id);
			if (!byOrdinal) {
				byOrdinal = new Map();
				guardsByGroup.set(entry.id, byOrdinal);
			}
			if (!byOrdinal.has(entry.ordinal)) {
				byOrdinal.set(entry.ordinal, { guard: entry.guard, forEachOrigin: child.forEachOrigin });
			}
		}
	}
	const nodeCount = flat.length;
	const winningOrdinal = new Map<string, number | undefined>();
	for (const [groupId, guardsByOrdinal] of guardsByGroup) {
		winningOrdinal.set(groupId, winningOrdinalFor(guardsByOrdinal, nodeCount, flat));
	}
	return children.filter((child) =>
		(child.chooseGroups ?? []).every((entry) => {
			const winner = winningOrdinal.get(entry.id);
			// A group with no decidable winner defaults to permissive (see
			// `winningOrdinalFor`'s own doc comment) - keep every member rather
			// than drop content this cannot confidently resolve.
			return winner === undefined || winner === entry.ordinal;
		}),
	);
}
