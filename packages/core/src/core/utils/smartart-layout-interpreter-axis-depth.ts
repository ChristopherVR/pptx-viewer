/**
 * SmartArt DiagramML interpreter - ECMA-376 21.4.7.5 `dgm:if/@func="maxDepth"`
 * axis-aware, anchor-relative depth measurement.
 *
 * Split out of `smartart-layout-interpreter-when.ts` (the file-size budget):
 * `evaluateWhen`'s `maxDepth` case calls {@link resolveAxisMaxDepth} here when
 * a `dgm:if` declares its own `@axis` and the caller supplies an ANCHOR point
 * set to navigate it from - the SAME generalisation `smartart-layout-
 * interpreter-axis-count.ts`'s `resolveAxisCount` already makes for
 * `func="cnt"` (root- or anchor-relative real tree navigation instead of a
 * flat, context-blind number), applied here to "how many tree levels deep
 * does this hop reach, counted from the anchor" instead of "how many points
 * does this hop reach".
 *
 * Derivation: `radial-cluster--hier5.pptx`'s own `Name40` (`<dgm:if
 * axis="des" func="maxDepth" op="lte" val="1">`, nested inside a `dgm:forEach
 * axis="ch" cnt="1"` binding the diagram's sole top-level point, "Node One",
 * as anchor - captured as that layout node's `forEachOrigin`) needs "how deep
 * does Node One's own descendant tree go" (2: Node One -> Four -> Five, so
 * the `lte 1` guard is false and the diagram must take the OTHER `dgm:choose`
 * branch), NOT "how deep is the LAYOUT DEFINITION's own `dgm:layoutNode` XML
 * nesting" - what `smartart-layout-interpreter-tree-location.ts`'s
 * `treeMaxDepth` measures, and the ONLY source `discoverArrangement`
 * (`smartart-layout-interpreter-model.ts`) had for `WhenContext.maxDepth`
 * before this module existed. Those are two unrelated numbers that happen to
 * share a name: one is a property of the layoutDef's own XML shape (constant
 * for a given layout, independent of the diagram's real data), the other a
 * property of the diagram's actual data tree, anchored at the point a
 * `dgm:forEach` bound. Confusing them makes `func="maxDepth"` either
 * undecidable (defaulting to "allow" wherever a caller does not even attempt
 * `context.maxDepth`, e.g. every `dgm:choose`-guarded composite slot today)
 * or, worse, decidable but WRONG (a constant unrelated to the real tree
 * shape, silently deciding the branch the same way for every dataset).
 *
 * NOT YET WIRED into production `dgm:choose` resolution as of this module's
 * introduction: the two real call sites that decide `singleCycle` vs
 * `textCenter`/`cycle_N` for `radial-cluster--hier5.pptx`
 * (`guardAllows`, `smartart-layout-interpreter-composite-choose.ts`, and
 * `winningOrdinalFor`, `smartart-layout-interpreter-composite-choose-
 * groups.ts`) both call `evaluateWhen` with no anchor at all today
 * (`{ nodes: flat }`), so this mechanism stays dormant for every existing
 * caller until one of those (composite-owned, outside this module's own
 * structural-interpreter ownership) threads a resolved anchor through - see
 * the round 13 successor doc (`smartart-track-s-successor-round13.md` in the
 * scratchpad) for the exact diff. Landed anyway, ahead of that wiring,
 * because it is a genuine, independently-testable, zero-regression-risk unit
 * (no existing caller populates `WhenContext.anchor`, so behaviour is
 * unchanged everywhere until one does).
 *
 * Pure tree navigation; no framework code.
 */

import type { PptxSmartArtNode } from '../types';
import { resolveAxisNodes } from './smartart-layout-interpreter-axis-count';

/**
 * Depth (edge count) of `node` from the point whose id is `anchorId`,
 * walking `parentId` links. `0` when `node` IS the anchor; `undefined` when
 * `node` is not a descendant of it at all (a disconnected point, or a cycle-
 * free tree walked past its own root without ever reaching `anchorId` -
 * defensive only, real SmartArt data models are always a proper tree).
 */
function depthFromAnchor(
	node: PptxSmartArtNode,
	anchorId: string,
	byId: Map<string, PptxSmartArtNode>,
): number | undefined {
	let depth = 0;
	let current: PptxSmartArtNode | undefined = node;
	const seen = new Set<string>();
	while (current) {
		if (current.id === anchorId) {
			return depth;
		}
		if (seen.has(current.id)) {
			return undefined;
		}
		seen.add(current.id);
		current = current.parentId ? byId.get(current.parentId) : undefined;
		depth += 1;
	}
	return undefined;
}

/**
 * ECMA-376 `dgm:if/@func="maxDepth"`: the deepest level reached by the
 * `@axis`-resolved point set, counted from `anchor` (the enclosing
 * `dgm:forEach`'s own bound point(s) - see `PptxSmartArtLayoutNode.
 * forEachOrigin`, the SAME anchor {@link resolveAxisNodes}'s own `context`
 * parameter already threads through for `des`/`desOrSelf`/etc navigation
 * reached through a forEach). `anchor` is a set (mirroring `resolveAxisNodes`
 * itself) because a multi-point `forEachOrigin` (an unbounded second hop)
 * can bind more than one point at once; the returned depth is the MAXIMUM
 * across every anchor point's own resolved set.
 *
 * Returns `undefined` (undecidable) when `anchor` is empty (nothing to
 * navigate from at all), or exactly when {@link resolveAxisNodes} itself
 * would for this `axis` (an unrecognised token, or - deliberately, see that
 * function's own doc comment - a bare non-`root` axis with no anchor at all)
 * - a caller with nothing to navigate keeps its pre-existing fallback. A
 * REAL, non-empty anchor whose own axis-resolved set is empty (a childless
 * point) is a real, decidable `0` - not undecidable.
 */
export function resolveAxisMaxDepth(
	nodes: PptxSmartArtNode[],
	axis: string[],
	pointTypes: string[] | undefined,
	start: number[] | undefined,
	count: number[] | undefined,
	anchor: PptxSmartArtNode[],
): number | undefined {
	if (anchor.length === 0) {
		return undefined;
	}
	const byId = new Map(nodes.map((n) => [n.id, n] as const));
	let max = 0;
	for (const anchorPoint of anchor) {
		const resolved = resolveAxisNodes(nodes, axis, pointTypes, start, count, [anchorPoint]);
		if (resolved === undefined) {
			return undefined;
		}
		for (const point of resolved) {
			const depth = depthFromAnchor(point, anchorPoint.id, byId);
			if (depth !== undefined && depth > max) {
				max = depth;
			}
		}
	}
	return max;
}
