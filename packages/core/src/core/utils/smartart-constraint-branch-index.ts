/**
 * SmartArt DiagramML interpreter - choose-aware constraint selection.
 *
 * `smartart-constraint-solver.ts`'s `buildConstraintIndex` has always indexed
 * `PptxSmartArtLayoutNode.allConstraints`: every `dgm:constr` reachable
 * through a `dgm:choose`/`dgm:if`/`dgm:else` wrapping a node's own
 * `constrLst`, BLINDLY UNIONED with no guard evaluation at all (that field's
 * own doc comment documents this as deliberate: "this interpreter does not
 * evaluate `dgm:choose` conditions when indexing constraints"). That
 * degrades correctly when only one branch ever declares a given (role, type)
 * pair, but `basic-venn--flat3.pptx`'s composite `Name9` choose declares a
 * SEPARATE, genuinely different `ctrX`/`ctrY`/`w`/`h` for `circ1` (and every
 * other named slot) per data-point-count branch - `resolveInternal`
 * (`smartart-constraint-solver.ts`) then picks whichever branch's constraint
 * sits FIRST in raw-XML document order, regardless of which branch is
 * actually live for the current diagram.
 *
 * {@link selectConstraints} is the choose-aware alternative: it groups
 * `PptxSmartArtLayoutNode.constraintCandidates` (round 39,
 * `smartart-layout-definition-constraint-candidates.ts`) by guard chain (one
 * group per `dgm:if`/`dgm:else` branch) and returns the constraints of the
 * FIRST branch, in document order, whose ENTIRE guard chain evaluates
 * DEFINITIVELY true via `evaluateWhen` - deliberately stricter than this
 * interpreter's usual "undecidable defaults to allow" convention, since a
 * wrongly-selected branch here silently swaps in a DIFFERENT numeric
 * constant, not merely an extra/missing shape. A group with an EMPTY guard
 * chain (an unconditional constraint sitting alongside a choose, or an
 * outermost `dgm:else` with no ancestor `dgm:if`) is never treated as
 * decidably selected either: nothing proves its siblings false, so it stays
 * a fallback candidate, never a positive match.
 *
 * `undefined` whenever nothing resolves decidably - no candidates, `nodeCount`
 * omitted, or every branch (the `else` included) stays undecided - so the
 * caller falls back to `buildConstraintIndex`'s pre-existing blind union
 * exactly as before. A node whose `constrLst` is not choose-guarded at all
 * (`constraintCandidates` absent, the overwhelmingly common case) is
 * completely unaffected: this returns `undefined` on the very first check.
 *
 * Pure geometry; no framework code.
 */

import type { PptxSmartArtConstraint, PptxSmartArtLayoutNode, PptxSmartArtWhen } from '../types';
import type { WhenContext } from './smartart-layout-interpreter-when';
import { evaluateWhen } from './smartart-layout-interpreter-when';

/** Stable string key for a guard chain, so every `dgm:constr` declared under
 * the SAME `dgm:if`/`dgm:else` branch regroups into one entry even when the
 * parser does not guarantee handing back the exact same array instance. */
function chainKey(guard: readonly PptxSmartArtWhen[]): string {
	return guard
		.map(
			(when) =>
				`${when.function}|${when.argument ?? ''}|${when.operator}|${when.value}|${(when.axis ?? []).join(',')}`,
		)
		.join('>>');
}

interface Branch {
	guard: readonly PptxSmartArtWhen[];
	constraints: PptxSmartArtConstraint[];
}

/** Group `candidates` by guard chain, preserving first-seen (document) order. */
function groupByBranch(
	candidates: readonly { guard: PptxSmartArtWhen[]; constraint: PptxSmartArtConstraint }[],
): Branch[] {
	const order: string[] = [];
	const byKey = new Map<string, Branch>();
	for (const { guard, constraint } of candidates) {
		const key = chainKey(guard);
		let branch = byKey.get(key);
		if (!branch) {
			branch = { guard, constraints: [] };
			byKey.set(key, branch);
			order.push(key);
		}
		branch.constraints.push(constraint);
	}
	return order.map((key) => byKey.get(key)) as Branch[];
}

/**
 * The constraints of the one genuinely LIVE branch for `node`'s
 * `constrLst`, or `undefined` when nothing resolves decidably (see this
 * module's own doc comment for the full contract).
 */
export function selectConstraints(
	node: PptxSmartArtLayoutNode,
	nodeCount: number | undefined,
	context: WhenContext | undefined,
): PptxSmartArtConstraint[] | undefined {
	const candidates = node.constraintCandidates;
	if (!candidates || candidates.length === 0 || nodeCount === undefined) {
		return undefined;
	}
	for (const branch of groupByBranch(candidates)) {
		if (branch.guard.length === 0) {
			continue;
		}
		const decided = branch.guard.every(
			(when) => evaluateWhen(when, nodeCount, context ?? {}) === true,
		);
		if (decided) {
			return branch.constraints;
		}
	}
	return undefined;
}
