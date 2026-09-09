/**
 * SmartArt DiagramML interpreter - position-guarded structural arranger
 * siblings.
 *
 * A `dgm:if func="pos"`-guarded `layoutNode` describes ONE position's own
 * hand-duplicated branch of a `dgm:choose`, not a shared template for every
 * point - `sub-step-process--hier5.pptx`'s `Name0` declares `chLin1`..
 * `chLin7`, one `dgm:alg type="lin"` template per top-level point position
 * (`dgm:varLst/dgm:chMax val="7"` caps the family at 7), each individually
 * guarded by a two-level `chooseGuard` chain: an outer `func="pos" op="equ"
 * val="N"` (which position this copy is for) and an inner, nearly-vacuous
 * `func="cnt" op="gte" val="1"` (does this point have >= 1 own child). See
 * `smartart-layout-interpreter-model.ts`'s `discoverArrangement`, the one
 * consumer: a pos-guarded child is disqualified from being ITS single
 * `chosen` arranger (falls back to the choose-owning node's own resolved,
 * position-independent algorithm instead) - {@link hasPositionGuard} is
 * that one-line check.
 *
 * {@link detectPositionFamily} is the broader classifier: given a parent
 * `layoutNode`, finds every group of 2+ DIRECT children sharing the same
 * `algorithm.type`, each individually `chooseGuard`-gated by a `pos`
 * condition with a DISTINCT value, and otherwise-identical guard shape (same
 * non-pos conditions) - the full "family of position-guarded duplicate
 * structural arranger siblings" shape, sorted ascending by the guard's own
 * `pos` value. Corpus-measured (`bunx tsx` a one-off scratchpad script over
 * the whole 227-fixture gallery, every `dgm:layoutNode`'s own `.children`,
 * for a STRUCTURAL algorithm type): `sub-step-process--hier5.pptx`'s
 * `chLin1`..`chLin7` (parent `Name0`) is the ONLY family anywhere in the
 * corpus, and disqualifying ANY structural, pos-guarded node from being a
 * `chosen` arranger (not only ones grouped into a 2+ family) affects ONLY
 * that same one fixture (a SEPARATE, broader corpus scan: every structural
 * `dgm:alg` node anywhere in the gallery whose OWN `chooseGuard` carries a
 * `pos` condition, family or not - 7 hits, all `chLin1`..`chLin7`). Both
 * scans are what make {@link hasPositionGuard}'s disqualification safe by
 * construction, not just by measurement: nothing else in the built-in
 * gallery can be affected. Exported for documentation/testing and as
 * general-purpose per-point dispatch infrastructure; `discoverArrangement`
 * itself only needs {@link hasPositionGuard}, not the full family, since
 * disqualifying the arranger and falling back to the choose-owning node's
 * own resolved algorithm is sufficient to fix `sub-step-process`'s own
 * shape-count/text-key structure (COM-verified: `cached=5 interp=3
 * matched=1` -> `cached=5 interp=5 matched=5`, every OTHER fixture in the
 * 227-corpus dashboard unchanged).
 *
 * Pure TypeScript - no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtWhen } from '../types';

/** `true` when `node`'s own `chooseGuard` chain carries a `func="pos"` condition. */
export function hasPositionGuard(node: PptxSmartArtLayoutNode): boolean {
	return node.chooseGuard?.some((guard) => guard.function === 'pos') ?? false;
}

/** The `pos` guard's own value from `node`'s `chooseGuard` chain, or `undefined`. */
function positionValue(node: PptxSmartArtLayoutNode): string | undefined {
	return node.chooseGuard?.find((guard) => guard.function === 'pos')?.value;
}

/** `node`'s `chooseGuard` chain, minus any `pos` entries, as a comparison key. */
function nonPositionGuardShape(guard: PptxSmartArtWhen[]): string {
	return JSON.stringify(
		guard
			.filter((w) => w.function !== 'pos')
			.map((w) => ({ f: w.function, op: w.operator, v: w.value, axis: w.axis })),
	);
}

/**
 * Sibling `layoutNode`s of `parent` forming a "family of position-guarded
 * duplicate structural arranger siblings" - see this module's own doc
 * comment. Sorted ascending by the guard's own `pos` value. `undefined` when
 * fewer than 2 of `parent.children` share `type`, are `hasPositionGuard`,
 * and agree on {@link nonPositionGuardShape}.
 */
export function detectPositionFamily(
	parent: PptxSmartArtLayoutNode,
	type: string,
): PptxSmartArtLayoutNode[] | undefined {
	const candidates = (parent.children ?? []).filter(
		(child) => child.algorithm?.type === type && hasPositionGuard(child),
	);
	if (candidates.length < 2) {
		return undefined;
	}
	const baseline = nonPositionGuardShape(candidates[0].chooseGuard ?? []);
	const seenPositions = new Set<string>();
	for (const candidate of candidates) {
		if (nonPositionGuardShape(candidate.chooseGuard ?? []) !== baseline) {
			return undefined;
		}
		const pos = positionValue(candidate);
		if (pos === undefined || seenPositions.has(pos)) {
			return undefined;
		}
		seenPositions.add(pos);
	}
	return [...candidates].sort((a, b) => Number(positionValue(a)) - Number(positionValue(b)));
}
