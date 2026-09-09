/**
 * SmartArt DiagramML interpreter - control-flow execution (forEach / choose).
 *
 * The typed layout model (see `smartart-layout-definition.ts`) flattens the
 * `dgm:forEach` / `dgm:choose` wrappers when it collects nested `layoutNode`s,
 * but it preserves the iterator attributes (`axis`/`ptType`/`st`/`cnt`/`step`/
 * `hideLastTrans`) on each node's `forEach`, and the branch conditions on each
 * node's `choose`. This module executes the decidable parts of that control flow
 * so the interpreter selects the right number of data points and, where a
 * `dgm:choose` is decidable from the node count, the right branch's arrangement
 * algorithm.
 *
 * Scope / honesty: this is still a partial interpreter. It does NOT resolve
 * point references or run the full recursive solver. `selectArrangedNodes` maps
 * one flat data point per iteration slot and folds transitions into that stream,
 * so `hideLastTrans` trims one trailing slot rather than a separate connector.
 * Pure TypeScript - no framework code, no DOM.
 */

import type { PptxSmartArtForEach, PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';

export type { WhenContext } from './smartart-layout-interpreter-when';
// Re-exported so existing callers (`smartart-layout-interpreter-model.ts`,
// `index.ts`'s barrel) keep importing choose/alg resolution from this module;
// the implementation itself lives in
// `smartart-layout-interpreter-choose-algorithm.ts` (split out to stay under
// the repo's per-file line budget).
export { chooseAlgorithm, chooseAlgType } from './smartart-layout-interpreter-choose-algorithm';

/** Point types that denote a real data node (vs a transition placeholder). */
const NODE_POINT_TYPES = new Set(['node', 'norm', 'nonNorm', 'asst', 'nonAsst', 'doc', 'all']);

/** First finite entry of a per-axis attribute list, or `undefined`. */
function firstNumber(values: number[] | undefined): number | undefined {
	const value = values?.[0];
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Every `dgm:forEach` on `node` that qualifies as a POINT-consuming iterator
 * (as opposed to a decorative/transition one), in document order. Built-ins
 * usually declare exactly ONE (`axis="ch" ptType="node"`) - `selectArrangedNodes`
 * used to pick just that ONE via `drivingIterator` (still the fallback rule
 * below when nothing node-typed is found). Some built-ins declare SEVERAL
 * INDEPENDENT node-point iterators on the SAME `layoutNode`, each covering a
 * different slice of the point set - `Target List`'s `Name0` composite
 * declares 7 (`st="1".."7" cnt="1"`, one per named ring slot); `Table List`/
 * `Stacked List`'s continuation arranger has just 1 (handled separately by
 * `isContinuationForEach`, a Track S file). {@link selectArrangedNodes}
 * resolves and UNIONS every entry here, so a diagram whose points are split
 * across N independent iterators arranges the union, not just the first.
 */
function qualifyingIterators(node: PptxSmartArtLayoutNode): PptxSmartArtForEach[] {
	const list = node.forEach;
	if (!list || list.length === 0) {
		return [];
	}
	const nodeIters = list.filter((each) =>
		each.pointTypes?.some((type) => NODE_POINT_TYPES.has(type)),
	);
	if (nodeIters.length > 0) {
		return nodeIters;
	}
	const axisIter = list.find((each) =>
		each.axis?.some((axis) => axis === 'ch' || axis === 'des' || axis === 'self'),
	);
	return [axisIter ?? list[0]];
}

/** One iterator's own `st`/`cnt`/`step` selection against a base of `length`, as 0-based indices. */
function resolveIteratorIndices(iter: PptxSmartArtForEach, length: number): number[] {
	const start = firstNumber(iter.start);
	const st0 = start !== undefined ? Math.max(0, start - 1) : 0;
	const stepRaw = firstNumber(iter.step);
	const step = stepRaw !== undefined && stepRaw > 0 ? stepRaw : 1;
	const cnt = firstNumber(iter.count) ?? 0;
	const indices: number[] = [];
	for (let i = st0; i < length; i += step) {
		indices.push(i);
		if (cnt > 0 && indices.length >= cnt) {
			break;
		}
	}
	return indices;
}

/**
 * A SECOND kind of multi-iterator shape, distinct from {@link
 * qualifyingIterators}'s "N independent entries on the SAME node": one
 * iterator's item template nests ANOTHER, `axis="followSib" ptType="node"`
 * iterator inside its own body - `Alternating Flow`'s `process` arranger has
 * ONE direct `dgm:forEach` (`step="2"`, every OTHER point via `composite1`),
 * but `composite1`'s own body ALSO nests a `followSib`/`ptType="node"
 * cnt="1"` iterator reaching `composite2` - "the point immediately
 * following the current one", rendered through a DIFFERENT (but, in every
 * gallery fixture measured, role-compatible - see `smartart-layout-
 * interpreter-item-roles.ts`'s `isPartialForEachOrigin`) item template. The
 * typed model flattens this nesting onto `arranger.children`, so it is only
 * reachable via each child's OWN `forEachOrigin`, not `node.forEach`
 * (`followSib` never denotes an absolute position, so it cannot be resolved
 * by {@link resolveIteratorIndices} against `base` directly - each count
 * found here is applied RELATIVE TO every already-selected index instead).
 * A `followSib`/`ptType="sibTrans"`/`"parTrans"` transition (a connector,
 * decorative) is excluded by the SAME `NODE_POINT_TYPES` filter every other
 * iterator here uses.
 */
function collectFollowSibNodeCounts(node: PptxSmartArtLayoutNode): number[] {
	const counts: number[] = [];
	for (const child of node.children ?? []) {
		const origin = child.forEachOrigin;
		if (
			origin?.axis?.includes('followSib') &&
			origin.pointTypes?.some((type) => NODE_POINT_TYPES.has(type))
		) {
			counts.push(firstNumber(origin.count) ?? 1);
		}
	}
	return counts;
}

/**
 * `true` when an iterator's `axis` is EXACTLY `ch` (children of the current
 * scope, no combined `des`/`desOrSelf`/`all` token). Real built-in layoutDefs
 * drive their top-level item arrangement with `axis="ch" ptType="node"` (see
 * `basic-process--hier5.pptx`'s `layout1.xml`: `<dgm:forEach name="nodesForEach"
 * axis="ch" ptType="node">`, paired with `<dgm:bulletEnabled val="1"/>` on the
 * SAME layoutNode): PowerPoint arranges one box per DIRECT top-level node and
 * folds any deeper node (added via the text-pane's Tab/"Add Bullet") into that
 * box as extra paragraphs rather than a sibling box. A combined axis (e.g.
 * `"ch des"`) deliberately wants the full descendant set, so it is left alone.
 */
function isChildOnlyAxis(iter: PptxSmartArtForEach): boolean {
	return iter.axis?.length === 1 && iter.axis[0] === 'ch';
}

/**
 * Apply the driving `dgm:forEach` selection semantics (`st` / `cnt` / `step`) to
 * the flat data-model points and, when the iterator declares `hideLastTrans`,
 * drop the trailing slot. `st` is 1-based (DiagramML default 1); `cnt` of 0
 * means "all"; `step` defaults to 1. Returns `flat` unchanged when the arranger
 * node carries no iterator.
 *
 * When `node` declares MORE THAN ONE qualifying iterator ({@link
 * qualifyingIterators}), or nests a `followSib`/`ptType="node"` iterator
 * inside one iterator's own item template ({@link
 * collectFollowSibNodeCounts}), the result is the UNION of every iterator's
 * own selection, in data order - `Target List`'s 7 independent single-point
 * ring iterators, and `Alternating Flow`'s `step="2"` primary paired with a
 * nested `followSib` "next point" secondary, both resolve this way. The
 * common case (exactly one iterator, no nested pairing) is unaffected: the
 * union of one iterator's own indices is exactly its own selection, same as
 * before this generalisation.
 *
 * @param roots The original (un-flattened) top-level nodes. When EVERY
 *   qualifying iterator's axis is exactly `ch` (see {@link isChildOnlyAxis}),
 *   selection runs over `roots` instead of the depth-first-flattened `flat`,
 *   so a node with children gets exactly one box; the caller
 *   (`interpretedLayoutToElements`) folds each unrendered descendant's text
 *   into its ancestor's box as additional paragraphs. Omit `roots` (or pass
 *   it equal to `flat`) to keep the previous flat-only behaviour, e.g. for
 *   callers with no tree to offer.
 */
export function selectArrangedNodes(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
	roots?: PptxSmartArtNode[],
): PptxSmartArtNode[] {
	const iterators = qualifyingIterators(node);
	if (iterators.length === 0) {
		// No driving iterator at all does not mean "no restriction": the
		// arranger's own per-item structure can live entirely inside a
		// nested `dgm:choose`/`composite` with no forEach of its own
		// (`basic-chevron-process--hier8`'s `Name0`), in which case the
		// top-level points are still the right arranged set - `flat` (every
		// node, including grandchildren) produced a box per DESCENDANT too.
		// Requires MORE THAN ONE root: a single root with no forEach here is
		// ambiguous with the "hub + satellites" shape
		// (`smartart-layout-interpreter-hub.ts` decides that one separately,
		// from `flat`) and with a genuinely single-root-but-flat dataset
		// (`table-hierarchy`) that still needs every node, not just the root.
		// [w6-c-s, per coordinator instruction: minimal Track-G-file edit,
		// re-read before editing.]
		return roots && roots.length > 1 ? roots : flat;
	}
	const base = roots && roots.length > 0 && iterators.every(isChildOnlyAxis) ? roots : flat;
	const indices = new Set<number>();
	for (const iter of iterators) {
		for (const i of resolveIteratorIndices(iter, base.length)) {
			indices.add(i);
		}
	}
	const followSibCounts = collectFollowSibNodeCounts(node);
	if (followSibCounts.length > 0) {
		for (const i of [...indices]) {
			for (const count of followSibCounts) {
				for (let k = 1; k <= count; k++) {
					const j = i + k;
					if (j < base.length) {
						indices.add(j);
					}
				}
			}
		}
	}
	const selected = [...indices].sort((a, b) => a - b).map((i) => base[i]);
	// `hideLastTrans` only has an unambiguous meaning for a single driving
	// iterator (drop ITS OWN trailing slot) - a genuine multi-iterator union
	// has no single "last" iterator's trailing slot to drop.
	if (
		iterators.length === 1 &&
		iterators[0].hideLastTransition?.[0] === true &&
		selected.length > 0
	) {
		selected.pop();
	}
	return selected;
}
