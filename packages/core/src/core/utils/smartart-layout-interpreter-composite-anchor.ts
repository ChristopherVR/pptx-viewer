/**
 * SmartArt DiagramML interpreter - `forEachOrigin`-anchored `presOf`
 * content resolution.
 *
 * A `presOf`-bearing layoutNode's own axis (`self`/`des`/`desOrSelf`/a
 * compound chain) is resolved relative to the DIAGRAM ROOT by default (every
 * `dgm:if`-level guard, and a composite's own root-relative slots -
 * `smartart-layout-interpreter-composite-choose.ts`'s `cycle-matrix`/
 * `balance` shape). That default is wrong for a node reached through a
 * `dgm:forEach` (its own {@link PptxSmartArtLayoutNode.forEachOrigin}):
 * such a node's content is scoped to THAT forEach's own resolved point(s),
 * not the whole diagram - `Phased Process`'s `circ1Tx` (`presOf
 * axis="desOrSelf"`) sits inside a `dgm:forEach axis="ch ch" ptType="node
 * node" st="2 1" cnt="1 1"` ("point 2's first child"), so its `desOrSelf`
 * must fold in THAT point's own descendants, not the entire diagram's.
 * {@link resolveAnchoredContent} is the ONE place this anchor/root split is
 * decided, shared by every composite content-resolution path so it is fixed
 * once, not per caller (`smartart-layout-interpreter-composite-choose.ts`'s
 * root-relative collection and `smartart-layout-interpreter-composite-
 * foreach.ts`'s compound-forEachOrigin slots both consume it).
 *
 * Pure geometry; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { resolveAxisNodes } from './smartart-layout-interpreter-axis-count';

/**
 * Resolve `node`'s own `presOf` axis, anchored by its `forEachOrigin` when
 * present (the forEach's OWN axis is itself resolved root-relatively - a
 * `dgm:forEach` always describes "which points, starting from the diagram" -
 * then `node`'s `presOf` axis navigates from THAT anchor set instead of the
 * root), falling back to plain root-relative resolution for a node with no
 * enclosing forEach (`cycle-matrix`'s `child1Text`, `quadrant1..4`: bare
 * `chooseGuard`-gated content, never forEach-wrapped). Returns `[]` when
 * `presOf` is absent, its axis is empty, or the anchor itself resolves to
 * nothing (the forEach's own axis matched no point, e.g. a phase slot whose
 * count guard excludes it).
 */
export function resolveAnchoredContent(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
): PptxSmartArtNode[] {
	const presOf = node.presentationOf;
	if (!presOf?.axis || presOf.axis.length === 0) {
		return [];
	}
	const origin = node.forEachOrigin;
	if (!origin?.axis || origin.axis.length === 0) {
		return resolveAxisNodes(flat, presOf.axis, presOf.pointTypes, presOf.start, presOf.count) ?? [];
	}
	const anchors =
		resolveAxisNodes(flat, origin.axis, origin.pointTypes, origin.start, origin.count) ?? [];
	if (anchors.length === 0) {
		return [];
	}
	return (
		resolveAxisNodes(flat, presOf.axis, presOf.pointTypes, presOf.start, presOf.count, anchors) ??
		[]
	);
}
