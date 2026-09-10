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
 * {@link resolveAnchoredContentPerAnchor} is the SAME anchor resolution, but
 * kept as one content array PER anchor instead of folded into one - the
 * genuine "one item template, N `dgm:forEach` iterations" reading ECMA-376
 * 21.4.2.13 describes for a forEach with an UNBOUNDED second hop (`axis="ch
 * ch" st="1 1" cnt="1 0"`, "every child of point 1", `nested-target--
 * hier5.pptx`'s `oChild`) - as opposed to a forEach that always resolves to
 * exactly ONE anchor (`Phased Process`'s per-phase slots, `st="N M" cnt="1
 * 1"`), where the two readings coincide. See
 * `smartart-layout-interpreter-composite-choose.ts` for how a multi-anchor
 * result becomes one rendered box per anchor instead of one box with every
 * anchor's text folded together.
 *
 * Pure geometry; no framework code.
 */

import type {
	PptxSmartArtIteratorAttributes,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import { resolveAxisNodes } from './smartart-layout-interpreter-axis-count';
import { resolvePresentationOf } from './smartart-layout-interpreter-when';

/** `node`'s own `forEachOrigin`, resolved root-relatively (a `dgm:forEach` always describes "which points, starting from the diagram") - `[]` when there is none, or it matches nothing. */
function resolveOrigin(node: PptxSmartArtLayoutNode, flat: PptxSmartArtNode[]): PptxSmartArtNode[] {
	const origin = node.forEachOrigin;
	if (!origin?.axis || origin.axis.length === 0) {
		return [];
	}
	return resolveAxisNodes(flat, origin.axis, origin.pointTypes, origin.start, origin.count) ?? [];
}

/**
 * Resolve `node`'s own `presOf` axis, anchored by its `forEachOrigin` when
 * present (`node`'s `presOf` axis navigates from the origin's own resolved
 * anchor set instead of the root), falling back to plain root-relative
 * resolution for a node with no enclosing forEach (`cycle-matrix`'s
 * `child1Text`, `quadrant1..4`: bare `chooseGuard`-gated content, never
 * forEach-wrapped). Returns `[]` when `presOf` is absent, its axis is empty,
 * or the anchor itself resolves to nothing (the forEach's own axis matched
 * no point, e.g. a phase slot whose count guard excludes it). When the
 * forEach resolves to MULTIPLE anchors, every anchor's content is folded
 * into this ONE array - see {@link resolveAnchoredContentPerAnchor} for the
 * per-anchor reading a genuine multi-iteration forEach needs instead.
 */
export function resolveAnchoredContent(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
): PptxSmartArtNode[] {
	const presOf = resolvePresentationOf(node, flat);
	if (!presOf?.axis || presOf.axis.length === 0) {
		return [];
	}
	const anchors = resolveOrigin(node, flat);
	if (!node.forEachOrigin?.axis || node.forEachOrigin.axis.length === 0) {
		return resolveAxisNodes(flat, presOf.axis, presOf.pointTypes, presOf.start, presOf.count) ?? [];
	}
	if (anchors.length === 0) {
		return [];
	}
	return (
		resolveAxisNodes(flat, presOf.axis, presOf.pointTypes, presOf.start, presOf.count, anchors) ??
		[]
	);
}

/**
 * Like {@link resolveAnchoredContent}, but returns ONE content array PER
 * anchor instead of folding every anchor's content into one - see this
 * module's own doc comment for the ECMA-376 reading this implements. For a
 * node with no `forEachOrigin`, or one that resolves to a single anchor,
 * this returns exactly the same single-element (or empty) result
 * `resolveAnchoredContent` itself would, wrapped in an outer array - a
 * strict generalisation, not a separate mechanism. Drops any anchor whose
 * own content resolves empty (a `presOf` axis that matched nothing for that
 * particular anchor).
 */
export function resolveAnchoredContentPerAnchor(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
): PptxSmartArtNode[][] {
	const presOf = resolvePresentationOf(node, flat);
	if (!presOf?.axis || presOf.axis.length === 0) {
		return [];
	}
	if (!node.forEachOrigin?.axis || node.forEachOrigin.axis.length === 0) {
		const content = resolveAnchoredContent(node, flat);
		return content.length > 0 ? [content] : [];
	}
	const anchors = resolveOrigin(node, flat);
	const groups: PptxSmartArtNode[][] = [];
	for (const anchor of anchors) {
		const content =
			resolveAxisNodes(flat, presOf.axis, presOf.pointTypes, presOf.start, presOf.count, [
				anchor,
			]) ?? [];
		if (content.length > 0) {
			groups.push(content);
		}
	}
	return groups;
}

/** One anchor's resolved content, plus its position among EVERY anchor (not
 * just the non-empty ones) - see {@link resolveAnchoredContentPerAnchorFrom}. */
export interface AnchoredContentGroup {
	content: PptxSmartArtNode[];
	/** 0-based position of this group's anchor among every anchor `origin` resolved (not just the non-empty ones). */
	anchorIndex: number;
	/** Total anchor count `origin` resolved (including empty ones) - the divisor a sibling role's OWN per-anchor slicing must stay aligned to. */
	anchorCount: number;
}

/**
 * Like {@link resolveAnchoredContentPerAnchor}, but for a `presOf`-bearing
 * `node` that has NO `forEachOrigin` of its OWN - `origin` is supplied by an
 * ANCESTOR bare (non-`presOf`) layoutNode's own `forEachOrigin` instead
 * (`continuous-arrow-process--hier5.pptx`'s `parTx`/`desTx`: both sit two
 * `dgm:layoutNode` levels inside `linV`, the actual per-point item template
 * that carries the real `axis="ch" ptType="node"` origin - see
 * `smartart-layout-interpreter-composite-choose.ts`'s `collectRawCandidates`,
 * the one caller that threads an ancestor's origin down this way).
 *
 * Keeps EVERY anchor's `anchorIndex`/`anchorCount` aligned to the FULL
 * anchor list, dropping only the individual groups whose own content
 * resolves empty (`Node Three` has no child, so `desTx`'s own per-anchor
 * resolution for it is empty) - unlike {@link resolveAnchoredContentPerAnchor},
 * which renumbers around the gaps. Renumbering would misalign a `des`-axis
 * sibling role (`desTx`, 2 non-empty anchors) against a `self`-axis one
 * (`parTx`, 3 non-empty anchors) that shares the SAME anchor list: both need
 * `resolveIterationRect` (`smartart-layout-interpreter-composite-
 * iteration.ts`) to slice the SAME shared container into the SAME 3 columns,
 * so `Node Four`'s own `desTx` must stay at `anchorIndex=2` of `3`, not
 * shift to `1` of `2` just because `Node Three`'s own group was empty.
 */
export function resolveAnchoredContentPerAnchorFrom(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
	origin: PptxSmartArtIteratorAttributes,
): AnchoredContentGroup[] {
	const presOf = resolvePresentationOf(node, flat);
	if (!presOf?.axis || presOf.axis.length === 0 || !origin.axis || origin.axis.length === 0) {
		return [];
	}
	const anchors =
		resolveAxisNodes(flat, origin.axis, origin.pointTypes, origin.start, origin.count) ?? [];
	const anchorCount = anchors.length;
	const presOfAxis = presOf.axis;
	const groups: AnchoredContentGroup[] = [];
	anchors.forEach((anchor, anchorIndex) => {
		const content =
			resolveAxisNodes(flat, presOfAxis, presOf.pointTypes, presOf.start, presOf.count, [anchor]) ??
			[];
		if (content.length > 0) {
			groups.push({ content, anchorIndex, anchorCount });
		}
	});
	return groups;
}
